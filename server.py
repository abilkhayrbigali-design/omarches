"""Serve Ottisk and its local generation endpoints on the loopback interface."""

import argparse
import base64
import binascii
from getpass import getpass
import http.client
import ipaddress
import os
import socket
import sys
import tempfile
import json
import subprocess
from functools import partial
from importlib.util import find_spec
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from urllib import error, request
from urllib.parse import quote, urljoin, urlsplit

from tools.story_reading import ReadingError, default_model, read_story


if find_spec("tools.neural_voice") is not None:
    from tools import neural_voice
else:
    neural_voice = None

if find_spec("tools.narration_style") is not None:
    from tools.narration_style import plan_narration
else:
    plan_narration = None


APP = Path(__file__).resolve().parent / "app"
OPENAI_MODEL = "gpt-image-2.6-flare"
IMAGE_KEY_FILE = APP.parent / ".ottisk-secrets" / "openai-image-key"
MAX_IMAGE = 16 * 1024 * 1024
MAX_REQUEST = 64 * 1024
generation_lock = Lock()
voice_lock = Lock()
reading_lock = Lock()
music_lock = Lock()
MAX_TRACK = 25 * 1024 * 1024
MAX_AUDIO = 128 * 1024 * 1024


class ApiError(Exception):
    def __init__(self, status, code, message):
        super().__init__(message)
        self.status = status
        self.code = code


def image_key():
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if key:
        return key
    try:
        return IMAGE_KEY_FILE.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return ""


def set_image_key():
    if not sys.stdin.isatty():
        raise SystemExit("Запустите команду в интерактивном терминале.")
    key = getpass("Вставьте ключ OpenAI API (ввод скрыт): ").strip()
    if not key or not key.isascii() or not key.isprintable() or any(ch.isspace() for ch in key):
        raise SystemExit("Введите непустой ключ без пробелов.")
    directory = IMAGE_KEY_FILE.parent
    directory.mkdir(mode=0o700, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=directory, mode="w", encoding="utf-8", delete=False) as output:
        output.write(key)
    try:
        os.replace(output.name, IMAGE_KEY_FILE)
    finally:
        Path(output.name).unlink(missing_ok=True)
    print("Ключ сохранён. На шаге с кадрами нажмите «Проверить настройки».")


def capability():
    return {"available": bool(image_key()), "provider": "openai", "model": OPENAI_MODEL}


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def generate_openai(description, style, key):
    prompt = (
        "Create a single landscape image for a personal diary. Use the concrete details "
        "and atmosphere in the scene description. No captions, logos or graphic borders.\n"
        f"Visual treatment: {style or 'natural light, photographic film'}.\n"
        f"Scene description: {description}"
    )
    payload = {"model": OPENAI_MODEL, "prompt": prompt, "n": 1, "size": "1536x1024",
               "quality": "medium", "output_format": "png"}
    api_request = request.Request(
        "https://api.openai.com/v1/images/generations", method="POST", data=json.dumps(payload).encode(),
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"}
    )
    limit = 4 * ((MAX_IMAGE + 2) // 3) + 65536
    try:
        with request.build_opener(NoRedirect()).open(api_request, timeout=180) as response:
            raw = response.read(limit + 1)
    except error.HTTPError as exc:
        with exc:
            if exc.code in (401, 403):
                raise ApiError(502, "provider_access", "Проверьте ключ API и доступ к генерации изображений OpenAI.") from exc
            if exc.code == 429:
                raise ApiError(429, "provider_limit", "Достигнут лимит OpenAI. Проверьте баланс и лимиты API.") from exc
            if exc.code == 400:
                raise ApiError(422, "provider_rejected", "OpenAI отклонил запрос. Попробуйте изменить описание.") from exc
            raise ApiError(502, "provider_error", "Сервис изображений OpenAI временно недоступен.") from exc
    except (OSError, http.client.HTTPException) as exc:
        raise ApiError(502, "provider_network", "Не удалось связаться с OpenAI. Проверьте соединение.") from exc
    if len(raw) > limit:
        raise ApiError(502, "image_too_large", "Изображение превышает доступный размер.")
    try:
        encoded = json.loads(raw)["data"][0]["b64_json"]
        image = base64.b64decode(encoded, validate=True)
        if not image.startswith(b"\x89PNG\r\n\x1a\n") or len(image) > MAX_IMAGE:
            raise ValueError("invalid image")
        return image
    except (ValueError, KeyError, IndexError, TypeError, binascii.Error) as exc:
        raise ApiError(502, "invalid_image", "OpenAI вернул ответ без читаемого изображения.") from exc


def render_image(data):
    if not isinstance(data, dict) or data.get("provider") != "openai":
        raise ApiError(409, "provider_changed", "Обновите форму и подтвердите создание кадра через OpenAI.")
    description = data.get("story")
    style = data.get("style", "")
    if not isinstance(description, str) or not 1 <= len(description.strip()) <= 6000:
        raise ApiError(400, "invalid_prompt", "Введите описание кадра длиной до 6000 знаков.")
    if not isinstance(style, str) or len(style) > 300:
        raise ApiError(400, "invalid_style", "Выберите стиль кадра.")
    key = image_key()
    if not key:
        raise ApiError(503, "key_missing", "Подключите ключ OpenAI командой python3 server.py --set-image-key.")
    return generate_openai(description.strip(), style.strip(), key)


def reading_capability():
    return {"available": bool(image_key()), "provider": "openai", "model": default_model()}


def render_reading(data):
    """Read one diary entry with a language model: eight feelings and a folder name."""
    story = data.get("story") if isinstance(data, dict) else None
    if not isinstance(story, str) or not 1 <= len(story.strip()) <= 6000:
        raise ApiError(400, "invalid_story", "Передайте текст записи длиной до 6000 знаков.")
    key = image_key()
    if not key:
        raise ApiError(503, "key_missing", "Ключ OpenAI не подключён. Настроение оценит словарь на устройстве.")
    try:
        return read_story(story.strip(), key)
    except ReadingError as exc:
        raise ApiError(exc.status, exc.code, str(exc)) from exc


def public_https(url):
    """Accept only https addresses of hosts on the public internet."""
    parts = urlsplit(url)
    if parts.scheme != "https" or not parts.hostname or parts.username or parts.password or parts.port not in (None, 443):
        return False
    try:
        addresses = {info[4][0] for info in socket.getaddrinfo(parts.hostname, 443, proto=socket.IPPROTO_TCP)}
    except OSError:
        return False
    return bool(addresses) and all(ipaddress.ip_address(address).is_global for address in addresses)


def fetch_track(data):
    """Download a catalogue track so the page can analyse its sound.

    The publisher does not let a web page read the audio it plays, so the local
    server fetches it. The file is handed to the page and is not kept on disk.
    """
    url = data.get("url") if isinstance(data, dict) else None
    if not isinstance(url, str) or not 1 <= len(url) <= 2000:
        raise ApiError(400, "invalid_url", "Передайте адрес трека.")
    for _ in range(4):
        if not public_https(url):
            raise ApiError(400, "invalid_url", "Трек должен лежать по открытому https-адресу.")
        track_request = request.Request(url, headers={"User-Agent": "Ottisk/1.0", "Accept": "audio/*"})
        try:
            with request.build_opener(NoRedirect()).open(track_request, timeout=25) as response:
                kind = response.headers.get_content_type()
                if not kind.startswith("audio/"):
                    raise ApiError(502, "not_audio", "По адресу трека лежит не аудиофайл.")
                audio = response.read(MAX_TRACK + 1)
        except error.HTTPError as exc:
            with exc:
                target = exc.headers.get("Location") if exc.code in (301, 302, 303, 307, 308) else None
            if not target:
                raise ApiError(502, "track_unavailable", "Источник не отдал аудиофайл.") from exc
            url = urljoin(url, target)
            continue
        except (OSError, http.client.HTTPException) as exc:
            raise ApiError(502, "track_network", "Не удалось скачать трек для анализа.") from exc
        if len(audio) > MAX_TRACK:
            raise ApiError(413, "track_too_large", "Трек больше 25 МБ, анализ по звуку недоступен.")
        return audio, kind
    raise ApiError(502, "track_redirects", "Источник трека слишком много раз перенаправил запрос.")


def voice_capability():
    ready = neural_voice is not None and plan_narration is not None and neural_voice.available()
    voices = neural_voice.voices() if ready else []
    return {
        "available": bool(voices),
        "model": neural_voice.MODEL_NAME if voices else None,
        "voices": voices,
        "defaultVoice": voices[0]["id"] if voices else None,
    }


def render_voice(data):
    if not isinstance(data, dict):
        raise ApiError(400, "invalid_input", "Передайте текст и выбранный голос.")
    text = data.get("text")
    voice = data.get("voice")
    if not isinstance(text, str) or not 1 <= len(text.strip()) <= 6000:
        raise ApiError(400, "invalid_text", "Введите для озвучки от 1 до 6000 символов.")
    if not isinstance(voice, str) or not voice:
        raise ApiError(400, "invalid_voice", "Выберите голос из списка.")
    config = voice_capability()
    if not config["available"]:
        raise ApiError(503, "voice_unavailable", "Локальные голоса не установлены. Проверьте настройку озвучки.")
    if voice not in {entry["id"] for entry in config["voices"]}:
        raise ApiError(400, "invalid_voice", "Выберите доступный голос из списка.")
    # The diary sends the overall pace it derived from the day's feelings.
    pace = data.get("pace", 1)
    if isinstance(pace, bool) or not isinstance(pace, (int, float)) or not .85 <= pace <= 1.15:
        raise ApiError(400, "invalid_pace", "Темп чтения должен быть от 0,85 до 1,15.")
    try:
        parts = plan_narration(text.strip())
        for part in parts:
            part["rate"] = round(min(1.25, max(.8, part["rate"] * pace)), 3)
        audio = neural_voice.synthesize(parts, voice)
    except ValueError as exc:
        raise ApiError(422, "invalid_narration", "Не удалось прочитать этот текст. Проверьте слова и знаки препинания.") from exc
    except (OSError, ImportError, RuntimeError, subprocess.SubprocessError) as exc:
        raise ApiError(503, "voice_failed", "Не удалось озвучить текст. Проверьте локальную модель и повторите попытку.") from exc
    if not (44 < len(audio) <= MAX_AUDIO and audio[:4] == b"RIFF" and audio[8:12] == b"WAVE"):
        raise ApiError(502, "invalid_audio", "Модель вернула нечитаемый звуковой файл.")
    return audio


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # The page is several modules and a stylesheet that change together:
        # make the browser revalidate them instead of mixing old and new files.
        if not getattr(self, "_cache_set", False):
            self.send_header("Cache-Control", "no-cache")
        self._cache_set = False
        super().end_headers()

    def send_body(self, status, content_type, body, model=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self._cache_set = True
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if model:
            self.send_header("X-Ottisk-Model", quote(model[:160], safe=""))
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def send_json(self, status, data):
        self.send_body(status, "application/json; charset=utf-8",
                       json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def local_host(self):
        port = self.server.server_port
        allowed = (f"127.0.0.1:{port}", f"localhost:{port}")
        return self.headers.get("Host", "").lower() in allowed

    def do_GET(self):
        path = urlsplit(self.path).path
        status = {"/api/image/status": capability, "/api/voice/status": voice_capability,
                  "/api/reading/status": reading_capability}
        if path in status:
            if not self.local_host():
                self.send_error(403)
                return
            self.send_json(200, status[path]())
        else:
            super().do_GET()

    def do_POST(self):
        path = urlsplit(self.path).path
        if path == "/api/image":
            lock = generation_lock
            busy_message = "Уже создаётся кадр. Дождитесь его завершения."
        elif path == "/api/voice/render":
            lock = voice_lock
            busy_message = "Уже идёт озвучка. Дождитесь завершения и повторите попытку."
        elif path == "/api/reading":
            lock = reading_lock
            busy_message = "Дневник уже читает запись. Дождитесь ответа."
        elif path == "/api/music/audio":
            lock = music_lock
            busy_message = "Дневник уже слушает другой трек. Дождитесь окончания."
        else:
            self.send_error(404)
            return
        try:
            host = self.headers.get("Host", "").lower()
            if not self.local_host() or self.headers.get("Origin") != f"http://{host}":
                raise ApiError(403, "wrong_origin", "Откройте генератор в локальном дневнике.")
            if self.headers.get_content_type() != "application/json":
                raise ApiError(415, "invalid_type", "Для запроса требуется JSON.")
            try:
                size = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                size = 0
            if not 0 < size <= MAX_REQUEST:
                raise ApiError(413, "invalid_size", "Превышен размер запроса или описание отсутствует.")
            self.connection.settimeout(15)
            try:
                data = json.loads(self.rfile.read(size))
            except (ValueError, RecursionError, TimeoutError) as exc:
                raise ApiError(400, "invalid_json", "Не удалось прочитать запрос.") from exc
            if not lock.acquire(blocking=False):
                raise ApiError(429, "busy", busy_message)
            try:
                if path == "/api/reading":
                    reading = render_reading(data)
                elif path == "/api/music/audio":
                    media, content_type = fetch_track(data)
                    model = None
                elif path == "/api/image":
                    media, content_type, model = render_image(data), "image/png", OPENAI_MODEL
                else:
                    media, content_type, model = render_voice(data), "audio/wav", None
            finally:
                lock.release()
            if path == "/api/reading":
                self.send_json(200, reading)
            else:
                self.send_body(200, content_type, media, model=model)
        except ApiError as exc:
            self.send_json(exc.status, {"code": exc.code, "message": str(exc)})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--set-image-key", action="store_true", help="Сохранить ключ OpenAI: генерация изображений и чтение записей")
    args = parser.parse_args()
    if args.set_image_key:
        set_image_key()
        return
    with ThreadingHTTPServer(("127.0.0.1", args.port), partial(Handler, directory=str(APP))) as server:
        print(f"Оттиск: http://127.0.0.1:{server.server_port}/", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
