"""Generate the 1200x630 Open Graph cards used for link previews.

Link-preview crawlers (LinkedIn, Slack, Discord, X) render a wide card, so a
square logo is not enough: each page gets its own branded card in the arcade's
navy/mint palette.  Committed to ``public/og/`` so the build never needs Pillow;
re-run this script only when a page's wording changes.

    python tools/generate_og_images.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(ROOT, "public", "og")

WIDTH, HEIGHT = 1200, 630
NAVY = (5, 7, 12)
PANEL = (13, 18, 25)
MINT = (141, 235, 196)
TEXT = (242, 245, 243)
MUTED = (156, 166, 178)
RULE = (38, 48, 63)

FONTS = os.path.join(os.environ.get("WINDIR", "C:\\Windows"), "Fonts")

SITE = "arcade.pattygcoding.com"

# eyebrow, title lines (text, is_accent), body lines, tags
CARDS = {
    "home": {
        "eyebrow": "PG / ARCADE",
        "title": [("Patrick Goodwin", False), ("Arcade", True)],
        "body": [
            "A collection of the games, tools and",
            "experiments I build.",
        ],
        "tags": ["ALKALAB", "SNAKE", "SUPREMEMC"],
    },
    "alkalab": {
        "eyebrow": "CHEMISTRY SANDBOX",
        "title": [("Alkalab", False)],
        "body": [
            "A powder-sand chemistry lab that runs",
            "in the browser.",
        ],
        "tags": ["RUST", "WEBASSEMBLY"],
    },
    "snake": {
        "eyebrow": "ARCADE GAME",
        "title": [("Snake", False)],
        "body": [
            "The classic snake game, written in Rust",
            "and compiled to WebAssembly.",
        ],
        "tags": ["RUST", "WEBASSEMBLY", "MINIQAD"],
    },
    "suprememc": {
        "eyebrow": "MINECRAFT MOD",
        "title": [("SupremeMC", False)],
        "body": [
            "330+ items, 260+ blocks, new mobs,",
            "dimensions and structures.",
        ],
        "tags": ["JAVA", "KOTLIN", "FABRIC", "NEOFORGE"],
    },
}


def font(name: str, size: int):
    try:
        return ImageFont.truetype(os.path.join(FONTS, name), size)
    except OSError:
        return ImageFont.load_default(size)


MONO = lambda size: font("consola.ttf", size)
SANS = lambda size: font("segoeui.ttf", size)
SANS_BOLD = lambda size: font("segoeuib.ttf", size)


def draw_card(spec: dict) -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), NAVY)
    draw = ImageDraw.Draw(image)

    # Mint accent bar along the top edge, plus a soft panel block behind the text.
    draw.rectangle((0, 0, WIDTH, 8), fill=MINT)
    draw.rectangle((0, 0, 14, HEIGHT), fill=PANEL)

    left = 76
    y = 96

    draw.text((left, y), spec["eyebrow"], font=MONO(20), fill=MINT)
    y += 42
    draw.rectangle((left, y, left + 64, y + 3), fill=MINT)
    y += 34

    title_font = SANS_BOLD(66)
    for text, accent in spec["title"]:
        draw.text((left, y), text, font=title_font, fill=MINT if accent else TEXT)
        y += 78

    y += 14
    body_font = SANS(28)
    for line in spec["body"]:
        draw.text((left, y), line, font=body_font, fill=MUTED)
        y += 42

    # Tech chips, outlined in mint so the card echoes the site's tag styling.
    y += 26
    chip_font = MONO(19)
    x = left
    for tag in spec["tags"]:
        w = int(draw.textlength(tag, font=chip_font))
        box = (x, y, x + w + 32, y + 38)
        draw.rectangle(box, outline=RULE, width=1)
        draw.text((x + 16, y + 9), tag, font=chip_font, fill=TEXT)
        x = box[2] + 10

    draw.text((left, HEIGHT - 64), SITE, font=MONO(24), fill=MINT)

    return image


def main() -> int:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    for name, spec in CARDS.items():
        path = os.path.join(OUTPUT_DIR, f"{name}.png")
        draw_card(spec).save(path, optimize=True)
        print(f"wrote {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
