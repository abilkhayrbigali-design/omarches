"""The hosted copy's listening endpoint: the start of a catalogue track for analysis.

    POST /api/music/audio  {"url": "https://…"}  ->  the first megabytes of the audio

A publisher lets a page play a track but not read its sound, so the page cannot
measure tempo and key itself. The local server fetches the whole file; a hosted
function may answer with 4.5 MB at most, and the analysis needs about a minute
of sound, so this one sends only the beginning. Nothing is kept on the host.
Only the catalogues the diary searches are fetched: this is not an open proxy.
The address checks repeat fetch_track in server.py.
"""
import http.client
import ipaddress
import json
import socket
from http.server import BaseHTTPRequestHandler
from urllib import error, request
from urllib.parse import urljoin, urlsplit

MAX_REQUEST = 8 * 1024
PART = 3_400_000
SOURCES = ("jamendo.com", "freesound.org", "wikimedia.org", "ccmixter.org")


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def catalogue_address(url):
    """An https address of a known catalogue that resolves to the public internet."""
    parts = urlsplit(url)
    host = (parts.hostname or "").lower()
    if parts.scheme != "https" or parts.username or parts.password or parts.port not in (None, 443):
        return False
    if not any(host == source or host.endswith("." + source) for source in SOURCES):
        return False
    try:
        addresses = {info[4][0] for info in socket.getaddrinfo(host, 443, proto=socket.IPPROTO_TCP)}
    except OSError:
        return False
    return bool(addresses) and all(ipaddress.ip_address(address).is_global for address in addresses)


def beginning(url):
    for _ in range(4):
        if not catalogue_address(url):
            return 400, "Трек должен лежать в каталоге, где дневник ищет музыку.", None, None
        ask = request.Request(url, headers={"User-Agent": "Ottisk/1.0", "Accept": "audio/*", "Range": f"bytes=0-{PART - 1}"})
        try:
            with request.build_opener(NoRedirect()).open(ask, timeout=20) as response:
                kind = response.headers.get_content_type()
                if not kind.startswith("audio/"):
                    return 502, "По адресу трека лежит не аудиофайл.", None, None
                return 200, "", response.read(PART), kind
        except error.HTTPError as exc:
            with exc:
                target = exc.headers.get("Location") if exc.code in (301, 302, 303, 307, 308) else None
            if not target:
                return 502, "Источник не отдал аудиофайл.", None, None
            url = urljoin(url, target)
        except (OSError, http.client.HTTPException):
            return 502, "Не удалось скачать трек для анализа.", None, None
    return 502, "Источник трека слишком много раз перенаправил запрос.", None, None


class handler(BaseHTTPRequestHandler):
    def reply(self, status, kind, body):
        self.send_response(status)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def fail(self, status, message):
        self.reply(status, "application/json; charset=utf-8", json.dumps({"message": message}, ensure_ascii=False).encode("utf-8"))

    def do_POST(self):
        host = (self.headers.get("X-Forwarded-Host") or self.headers.get("Host") or "").lower()
        origin = urlsplit(self.headers.get("Origin") or "")
        if not host or origin.scheme != "https" or origin.netloc.lower() != host:
            return self.fail(403, "Откройте дневник на этом сайте.")
        try:
            size = int(self.headers.get("Content-Length", "0"))
            data = json.loads(self.rfile.read(size)) if 0 < size <= MAX_REQUEST else None
        except (ValueError, RecursionError):
            data = None
        url = data.get("url") if isinstance(data, dict) else None
        if not isinstance(url, str) or not 1 <= len(url) <= 2000:
            return self.fail(400, "Передайте адрес трека.")
        status, message, audio, kind = beginning(url)
        if status != 200:
            return self.fail(status, message)
        self.reply(200, kind, audio)

    def log_message(self, *args):
        """Keep request lines out of the host's log."""
