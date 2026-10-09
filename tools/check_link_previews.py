"""Simulate a link-preview crawler against the built site.

LinkedIn, Slack, Discord and X fetch a shared URL and read the raw HTML without
running JavaScript.  This serves the build the way GitHub Pages would
(extensionless paths resolve to ``<route>.html``, directories to
``<route>/index.html``) and then reports exactly which Open Graph tags each
shared URL would receive -- including whether the card image resolves at 1200x630.

    npm run build
    python tools/check_link_previews.py

Exits non-zero if any page would produce a broken preview.
"""

from __future__ import annotations

import re
import struct
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist" / "arcade-pg-website" / "browser"
ORIGIN = "https://arcade.pattygcoding.com"

ROUTES = ["/", "/alkalab", "/snake", "/suprememc"]

REQUIRED_META = [
    ("property", "og:type"),
    ("property", "og:site_name"),
    ("property", "og:title"),
    ("property", "og:description"),
    ("property", "og:url"),
    ("property", "og:image"),
    ("property", "og:image:width"),
    ("property", "og:image:height"),
    ("property", "og:image:alt"),
    ("name", "twitter:card"),
    ("name", "twitter:title"),
    ("name", "twitter:description"),
    ("name", "twitter:image"),
]


def resolve(path: str) -> Path | None:
    """Mirror how a static Pages host maps a URL onto a file."""
    rel = path.strip("/")
    if not rel:
        return DIST / "index.html"
    if path.endswith("/"):
        candidate = DIST / rel / "index.html"
        return candidate if candidate.is_file() else None
    direct = DIST / rel
    if direct.is_file():
        return direct
    for candidate in (DIST / f"{rel}.html", DIST / rel / "index.html"):
        if candidate.is_file():
            return candidate
    return None


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST), **kwargs)

    def do_GET(self):  # noqa: N802 - stdlib naming
        target = resolve(urlsplit(self.path).path)
        if target is None:
            fallback = DIST / "404.html"
            if not fallback.is_file():
                self.send_error(404)
                return
            body = fallback.read_bytes()
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        body = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", self.guess_type(str(target)))
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):  # keep the report clean
        pass


def meta(html: str, attr: str, key: str) -> str | None:
    match = re.search(rf'<meta\s+{attr}="{re.escape(key)}"\s+content="([^"]*)"', html)
    return match.group(1) if match else None


def png_size(data: bytes) -> tuple[int, int] | None:
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    return struct.unpack(">II", data[16:24])


def main() -> int:
    if not (DIST / "index.html").is_file():
        print(f'No build found at {DIST}. Run "npm run build" first.')
        return 1

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_address[1]}"

    problems: list[str] = []
    cards: dict[str, str] = {}

    print(f"{'URL':<12} {'STATUS':<7} PAGE TITLE")
    print("-" * 78)

    try:
        for route in ROUTES:
            try:
                with urlopen(f"{base}{route}", timeout=10) as response:
                    status = response.status
                    html = response.read().decode("utf-8")
            except HTTPError as error:
                problems.append(f"{route}: HTTP {error.code} - the deep link does not resolve")
                print(f"{route:<12} {error.code:<7} <no page served>")
                continue

            title = re.search(r"<title>([^<]*)</title>", html)
            print(f"{route:<12} {status:<7} {title.group(1) if title else '<missing title>'}")

            for attr, key in REQUIRED_META:
                if not meta(html, attr, key):
                    problems.append(f'{route}: missing <meta {attr}="{key}">')

            canonical = re.search(r'<link\s+rel="canonical"\s+href="([^"]*)"', html)
            if not canonical:
                problems.append(f'{route}: missing <link rel="canonical">')
            elif not canonical.group(1).startswith("https://"):
                problems.append(f"{route}: canonical is not absolute ({canonical.group(1)})")

            og_url = (meta(html, "property", "og:url") or "").rstrip("/")
            expected = (ORIGIN + (route.rstrip("/") or "/")).rstrip("/")
            if og_url != expected:
                problems.append(f"{route}: og:url is {og_url!r}, expected {expected!r}")

            image = meta(html, "property", "og:image") or ""
            cards[route] = image
            if not image.startswith("https://"):
                problems.append(f"{route}: og:image is not absolute ({image!r})")
                continue

            # Fetch the card exactly as the crawler would.
            try:
                with urlopen(f"{base}{urlsplit(image).path}", timeout=10) as response:
                    data = response.read()
            except HTTPError as error:
                problems.append(f"{route}: og:image is unreachable (HTTP {error.code})")
                continue

            size = png_size(data)
            if size is None:
                problems.append(f"{route}: og:image is not a PNG")
            elif size != (1200, 630):
                problems.append(f"{route}: og:image is {size[0]}x{size[1]}, expected 1200x630")
            else:
                name = image.rsplit("/", 1)[-1]
                print(f"{'':<12} {'':<7}   card {name} {size[0]}x{size[1]} OK")
    finally:
        server.shutdown()

    if len(set(cards.values())) != len(cards):
        problems.append(f"og:image is not unique per page: {cards}")

    print()
    if problems:
        print(f"FAIL - {len(problems)} problem(s):")
        for problem in problems:
            print(f"  - {problem}")
        return 1

    print(f"PASS - {len(ROUTES)} shared URLs all serve distinct, crawler-readable OG tags.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

