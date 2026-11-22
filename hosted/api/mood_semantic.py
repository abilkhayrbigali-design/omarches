"""Semantic head for the Vercel mood endpoint. Does not retain request bodies."""
import json
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "mood-server" / "semantic"))
from runtime import MODEL, classify  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def reply(self, status, value):
        data = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        self.reply(200, {"model": MODEL, "available": True})

    def do_POST(self):
        try:
            size = int(self.headers.get("Content-Length") or "0")
            if not 0 < size <= 32_768:
                return self.reply(413, {"code": "invalid_size"})
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict) or not isinstance(data.get("text"), str):
                return self.reply(400, {"code": "invalid_text"})
            text = data["text"].strip()
            if not 1 <= len(text) <= 6000:
                return self.reply(400, {"code": "invalid_text"})
        except (ValueError, RecursionError):
            return self.reply(400, {"code": "invalid_request"})
        try:
            scores = classify(text)
            self.reply(200, {"model": MODEL, "scores": scores})
        except Exception:
            self.reply(503, {"code": "semantic_model_unavailable"})

    def log_message(self, *_):
        pass
