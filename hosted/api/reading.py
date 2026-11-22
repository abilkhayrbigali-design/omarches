"""The hosted copy's reading endpoint: a language model reads one diary entry.

    GET  /api/reading/status  ->  {"available", "provider", "model", "hosted": true}
    POST /api/reading         ->  {"feelings", "title", "reason", "model", "source"}

The key is the host's environment variable OPENAI_API_KEY; without it the page
falls back to the dictionary on the device. Nothing is stored on the host.
The prompt and the checks are the same as in the local server: this file imports
tools/story_reading.py, which tools/vercel_site.py copies next to it.
"""
import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlsplit

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _story_reading import ReadingError, default_model, read_story  # noqa: E402

MAX_REQUEST = 64 * 1024
# A public endpoint spends its owner's money. A few readings a minute from one
# address is plenty for a diary. The count lives in one warm instance, so it is
# a brake and not a guarantee: the hard limit is the budget of the OpenAI project.
WINDOW = 60
LIMIT = 6
recent = {}


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
    return os.environ.get("OPENAI_API_KEY", "").strip()


class handler(BaseHTTPRequestHandler):
    def reply(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def own_page(self):
        """Only the diary served from this same host may ask."""
        host = (self.headers.get("X-Forwarded-Host") or self.headers.get("Host") or "").lower()
        origin = urlsplit(self.headers.get("Origin") or "")
        return bool(host) and origin.scheme == "https" and origin.netloc.lower() == host

    def do_GET(self):
        self.reply(200, {"available": bool(key()), "provider": "openai", "model": default_model(), "hosted": True})

    def do_POST(self):
        if not self.own_page():
            return self.reply(403, {"code": "wrong_origin", "message": "Откройте дневник на этом сайте."})
        if self.headers.get_content_type() != "application/json":
            return self.reply(415, {"code": "invalid_type", "message": "Для запроса требуется JSON."})
        try:
            size = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            size = 0
        if not 0 < size <= MAX_REQUEST:
            return self.reply(413, {"code": "invalid_size", "message": "Превышен размер запроса или текст отсутствует."})
        try:
            data = json.loads(self.rfile.read(size))
        except (ValueError, RecursionError):
            return self.reply(400, {"code": "invalid_json", "message": "Не удалось прочитать запрос."})
        story = data.get("story") if isinstance(data, dict) else None
        if not isinstance(story, str) or not 1 <= len(story.strip()) <= 6000:
            return self.reply(400, {"code": "invalid_story", "message": "Передайте текст записи длиной до 6000 знаков."})
        if not key():
            return self.reply(503, {"code": "key_missing", "message": "Ключ OpenAI не подключён. Настроение оценит словарь на устройстве."})
        address = (self.headers.get("X-Forwarded-For") or self.client_address[0]).split(",")[0].strip()
        if not allowed(address):
            return self.reply(429, {"code": "busy", "message": "Слишком много записей подряд. Подождите минуту."})
        try:
            self.reply(200, read_story(story.strip(), key(), data.get("reasonLanguage", "ru")))
        except ReadingError as exc:
            self.reply(exc.status, {"code": exc.code, "message": str(exc)})

    def log_message(self, *args):
        """Entries are private: keep request lines out of the host's log."""
