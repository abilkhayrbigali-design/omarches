"""The hosted copy's image endpoint: OpenAI draws one frame from a scene description.

    GET  /api/image/status  ->  {"available", "provider", "model", "hosted": true}
    POST /api/image         ->  image/jpeg

The key is the host's environment variable OPENAI_IMAGE_KEY; without it the page
offers photographs only. Nothing is stored on the host. The prompt is the same
as in the local server.py. The frame is a JPEG and not a PNG because a
function's reply on this host may not exceed 4.5 MB.
"""
import base64
import binascii
import http.client
import json
import os
import time
from http.server import BaseHTTPRequestHandler
from urllib import error, request
from urllib.parse import quote, urlsplit

MODEL = "gpt-image-2.6-flare"
MAX_REQUEST = 64 * 1024
MAX_IMAGE = 4 * 1024 * 1024
# A public endpoint spends its owner's money. The count lives in one warm
# instance, so it is a brake and not a guarantee: the hard limit is the budget
# of the OpenAI project.
WINDOW = 60
LIMIT = 3
recent = {}


class Problem(Exception):
    def __init__(self, status, code, message):
        super().__init__(message)
        self.status = status
        self.code = code


def allowed(address):
    now = time.time()
    hits = [moment for moment in recent.get(address, []) if now - moment < WINDOW]
    if len(recent) > 2000:
        recent.clear()
    if len(hits) >= LIMIT:
        recent[address] = hits
        return False
    recent[address] = hits + [now]
    return True


def key():
    return os.environ.get("OPENAI_IMAGE_KEY", "").strip()


def generate(description, style):
    prompt = (
        "Create a single landscape image for a personal diary. Use the concrete details "
        "and atmosphere in the scene description. No captions, logos or graphic borders.\n"
        f"Visual treatment: {style or 'natural light, photographic film'}.\n"
        f"Scene description: {description}"
    )
    payload = {"model": MODEL, "prompt": prompt, "n": 1, "size": "1536x1024",
               "quality": "medium", "output_format": "jpeg", "output_compression": 90}
    api_request = request.Request(
        "https://api.openai.com/v1/images/generations", method="POST", data=json.dumps(payload).encode(),
        headers={"Authorization": "Bearer " + key(), "Content-Type": "application/json"}
    )
    try:
        with request.urlopen(api_request, timeout=55) as response:
            raw = response.read()
    except error.HTTPError as exc:
        with exc:
            if exc.code in (401, 403):
                raise Problem(502, "provider_access", "Проверьте ключ API и доступ к генерации изображений OpenAI.") from exc
            if exc.code == 429:
                raise Problem(429, "provider_limit", "Достигнут лимит OpenAI. Проверьте баланс и лимиты API.") from exc
            if exc.code == 400:
                raise Problem(422, "provider_rejected", "OpenAI отклонил запрос. Попробуйте изменить описание.") from exc
            raise Problem(502, "provider_error", "Сервис изображений OpenAI временно недоступен.") from exc
    except (OSError, http.client.HTTPException) as exc:
        raise Problem(502, "provider_network", "Не удалось связаться с OpenAI. Проверьте соединение.") from exc
    try:
        image = base64.b64decode(json.loads(raw)["data"][0]["b64_json"], validate=True)
        if not image.startswith(b"\xff\xd8\xff") or len(image) > MAX_IMAGE:
            raise ValueError("invalid image")
        return image
    except (ValueError, KeyError, IndexError, TypeError, binascii.Error) as exc:
        raise Problem(502, "invalid_image", "OpenAI вернул ответ без читаемого изображения.") from exc


class handler(BaseHTTPRequestHandler):
    def send(self, status, content_type, body, model=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if model:
            self.send_header("X-Ottisk-Model", quote(model, safe=""))
        self.end_headers()
        self.wfile.write(body)

    def reply(self, status, data):
        self.send(status, "application/json; charset=utf-8", json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def own_page(self):
        """Only the diary served from this same host may ask."""
        host = (self.headers.get("X-Forwarded-Host") or self.headers.get("Host") or "").lower()
        origin = urlsplit(self.headers.get("Origin") or "")
        return bool(host) and origin.scheme == "https" and origin.netloc.lower() == host

    def do_GET(self):
        self.reply(200, {"available": bool(key()), "provider": "openai", "model": MODEL, "hosted": True})

    def do_POST(self):
        try:
            if not self.own_page():
                raise Problem(403, "wrong_origin", "Откройте дневник на этом сайте.")
            if self.headers.get_content_type() != "application/json":
                raise Problem(415, "invalid_type", "Для запроса требуется JSON.")
            try:
                size = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                size = 0
            if not 0 < size <= MAX_REQUEST:
                raise Problem(413, "invalid_size", "Превышен размер запроса или описание отсутствует.")
            try:
                data = json.loads(self.rfile.read(size))
            except (ValueError, RecursionError) as exc:
                raise Problem(400, "invalid_json", "Не удалось прочитать запрос.") from exc
            if not isinstance(data, dict) or data.get("provider") != "openai":
                raise Problem(409, "provider_changed", "Обновите форму и подтвердите создание кадра через OpenAI.")
            description = data.get("story")
            style = data.get("style", "")
            if not isinstance(description, str) or not 1 <= len(description.strip()) <= 6000:
                raise Problem(400, "invalid_prompt", "Введите описание кадра длиной до 6000 знаков.")
            if not isinstance(style, str) or len(style) > 300:
                raise Problem(400, "invalid_style", "Выберите стиль кадра.")
            if not key():
                raise Problem(503, "key_missing", "Ключ OpenAI не подключён на сайте.")
            address = (self.headers.get("X-Forwarded-For") or self.client_address[0]).split(",")[0].strip()
            if not allowed(address):
                raise Problem(429, "busy", "Слишком много картинок подряд. Подождите минуту.")
            self.send(200, "image/jpeg", generate(description.strip(), style.strip()), model=MODEL)
        except Problem as exc:
            self.reply(exc.status, {"code": exc.code, "message": str(exc)})

    def log_message(self, *args):
        """Entries are private: keep request lines out of the host's log."""
