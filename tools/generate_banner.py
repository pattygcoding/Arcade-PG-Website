"""Generate the README banners.

Self-contained SVGs in the arcade's navy/mint palette, matching the banners in
the Connect Four showcase: the brand label, the title, the toolchain and a row of
chips.  No web fonts, no scripts and no network, so they render on GitHub, in a
preview pane and offline.

    python tools/generate_banner.py

The hero banner groups its chips by language, framework and skill; the smaller
per-project banners use the same one-row layout as the Connect Four language
banners, with the language as the accent chip followed by its skills.
"""

from __future__ import annotations

import sys
import xml.sax.saxutils as sax
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT / "docs"

# Palette: the dark-theme variables declared in src/styles.css (`:root`).
CANVAS = "#05070c"  # ink-950
PANEL = "#0a0e15"  # ink-900
SLOT = "#0d1219"  # ink-850
LINE = "#1a2230"  # ink-700 hairline
LINE_SOFT = "#26303f"  # ink-600 chip stroke
FG = "#f2f5f3"  # fg-strong
SOFT = "#c3cad3"  # fg-soft
MUTED = "#8a93a0"  # fg-muted
MINT = "#8debc4"  # mint-400 / the accent in dark mode
MINT_EDGE = "#3d7c64"  # dimmed mint for chip borders
MINT_DEEP = "#12291f"  # mint-tinted chip fill

SANS = "Inter, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
MONO = "'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', monospace"

WIDTH = 1200
HERO_HEIGHT = 320
ROW_HEIGHT = 250

CHIP_H = 34
CHIP_PAD = 15
CHIP_GAP = 10
CHIP_TEXT_SIZE = 13
CHIP_LIMIT = 760  # right edge the chips may reach; the card motif starts at x=780

# The hero's three groups: the accent chip names the group, the rest are entries.
HERO_ROWS = [
    ("Languages", ["TypeScript", "HTML + CSS", "Rust", "Java", "Kotlin"]),
    ("Frameworks", ["Angular 21", "Tailwind CSS", "WebAssembly", "wasm-bindgen"]),
    ("Skills", ["Angular signals", "Lazy routes", "Static OG pages", "GitHub Actions"]),
]

# One banner per page, in the same shape as the Connect Four language banners.
PROJECTS = [
    {
        "file": "banner-alkalab.svg",
        "name": "Alkalab",
        "toolchain": "Rust compiled to WebAssembly",
        "category": "Rust + WASM",
        "skills": ["wasm-bindgen glue", "Zero-copy pixels", "RAF render loop"],
    },
    {
        "file": "banner-snake.svg",
        "name": "Snake",
        "toolchain": "Rust + miniquad, compiled to WebAssembly",
        "category": "Rust + WASM",
        "skills": ["miniquad runtime", "Keyboard + touch input"],
    },
    {
        "file": "banner-suprememc.svg",
        "name": "SupremeMC",
        "toolchain": "Java + Kotlin, Fabric and NeoForge",
        "category": "Java + Kotlin",
        "skills": ["Inline SVG icons", "Data-driven cards", "Timeline layout"],
    },
]


def esc(text: str) -> str:
    """Escape a string for use in XML text or an attribute value."""
    return sax.escape(text, {'"': "&quot;", "'": "&apos;"})


def text_width(text: str, size: float, ratio: float) -> float:
    """Rough width of `text` in px; a mono glyph is ~0.62em, a sans one ~0.55em.

    Only used to lay chips out, so an estimate is enough - and it keeps the banner
    independent of any font-metrics library.
    """
    return len(text) * size * ratio


def chips_for(category: str, skills: list[str], limit: float) -> list[tuple[str, str]]:
    """Pick the chips that fit on one row: the category first, then skills."""
    picked: list[tuple[str, str]] = []
    used = 0.0
    for kind, label in [("category", category)] + [("skill", skill) for skill in skills]:
        width = CHIP_PAD * 2 + text_width(label, CHIP_TEXT_SIZE, 0.62)
        step = width + (CHIP_GAP if picked else 0)
        if used + step > limit:
            break
        used += step
        picked.append((kind, label))
    return picked


def chip_row(category: str, skills: list[str], top: int) -> str:
    """One label chip followed by as many skill chips as fit neatly."""
    parts = []
    x = 56.0
    for kind, label in chips_for(category, skills, CHIP_LIMIT - 56):
        width = CHIP_PAD * 2 + text_width(label, CHIP_TEXT_SIZE, 0.62)
        fill, stroke, colour = (
            (MINT_DEEP, MINT_EDGE, MINT) if kind == "category" else (PANEL, LINE_SOFT, SOFT)
        )
        parts.append(
            '    <rect x="%.0f" y="%d" width="%.0f" height="%d" rx="%d" fill="%s" '
            'stroke="%s" stroke-width="1"/>' % (x, top, width, CHIP_H, CHIP_H // 2, fill, stroke)
        )
        parts.append(
            '    <text x="%.0f" y="%d" font-family="%s" font-size="%d" fill="%s">%s</text>'
            % (x + CHIP_PAD, top + 22, MONO, CHIP_TEXT_SIZE, colour, esc(label))
        )
        x += width + CHIP_GAP
    return "\n".join(parts)


def bar(x: float, y: float, width: float, height: float, fill: str, opacity: float = 1.0) -> str:
    return (
        '    <rect x="%.0f" y="%.0f" width="%.0f" height="%.0f" rx="%.1f" fill="%s" opacity="%.2f"/>'
        % (x, y, width, height, height / 2, fill, opacity)
    )


def card_motif(top: int) -> str:
    """Three mini game cards, echoing the landing page's selection screen.

    The middle card takes the mint border, the way a hovered card does on the
    site.  Drawn from the right edge so it never collides with the chip rows.
    """
    card_w, card_h, gap = 118, 150, 22
    total = card_w * 3 + gap * 2
    left = WIDTH - 22 - total
    parts = []
    for index in range(3):
        x = left + index * (card_w + gap)
        accent = index == 1
        parts.append(
            '    <rect x="%d" y="%d" width="%d" height="%d" rx="12" fill="%s" stroke="%s" '
            'stroke-width="1"/>'
            % (x, top, card_w, card_h, PANEL, MINT_EDGE if accent else LINE)
        )
        parts.append(
            '    <rect x="%d" y="%d" width="30" height="30" rx="7" fill="%s" stroke="%s" '
            'stroke-width="1"/>'
            % (x + 18, top + 18, SLOT, MINT_EDGE if accent else LINE_SOFT)
        )
        parts.append(bar(x + 18, top + 66, 82, 7, SOFT))
        parts.append(bar(x + 18, top + 82, 58, 7, MUTED, 0.55))
        parts.append(bar(x + 18, top + 108, 46, 6, MINT))
    return "\n".join(parts)


def svg_open(height: int, label: str) -> list[str]:
    return [
        '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d" '
        'role="img" aria-label="%s">' % (WIDTH, height, WIDTH, height, esc(label)),
        "    <title>%s</title>" % esc(label),
        '    <rect width="%d" height="%d" rx="18" fill="%s"/>' % (WIDTH, height, CANVAS),
        '    <rect x="0.5" y="0.5" width="%d" height="%d" rx="17.5" fill="none" stroke="%s" '
        'stroke-width="1"/>' % (WIDTH - 1, height - 1, LINE),
    ]


def heading(eyebrow: str, title: str, toolchain: str) -> list[str]:
    """The shared left column: label, title, mint rule and toolchain line."""
    return [
        '    <text x="56" y="54" font-family="%s" font-size="13" letter-spacing="2.5" '
        'fill="%s">%s</text>' % (MONO, MINT, eyebrow),
        '    <text x="56" y="110" font-family="%s" font-size="46" font-weight="700" '
        'fill="%s">%s</text>' % (SANS, FG, esc(title)),
        '    <rect x="56" y="126" width="56" height="3" rx="1.5" fill="%s"/>' % MINT,
        '    <text x="56" y="152" font-family="%s" font-size="14" fill="%s">%s</text>'
        % (MONO, MUTED, toolchain),
    ]


def hero_svg() -> str:
    """The repo banner: chips grouped by language, framework and skill."""
    lines = svg_open(HERO_HEIGHT, "Patrick Goodwin Arcade")
    lines.append(card_motif((HERO_HEIGHT - 150) // 2))
    lines += heading(
        "PG &#183; ARCADE",
        "Patrick Goodwin Arcade",
        "Angular 21 &#183; TypeScript &#183; Tailwind CSS &#183; WebAssembly",
    )
    top = 172
    for label, items in HERO_ROWS:
        lines.append(chip_row(label, items, top))
        top += CHIP_H + 10
    lines += ["</svg>", ""]
    return "\n".join(lines)


def project_svg(project: dict) -> str:
    """A page banner: the language as the accent chip, then its skills."""
    lines = svg_open(ROW_HEIGHT, "%s - Patrick Goodwin Arcade" % project["name"])
    lines.append(card_motif((ROW_HEIGHT - 150) // 2))
    lines += heading("PG &#183; ARCADE", project["name"], project["toolchain"])
    lines.append(chip_row(project["category"], project["skills"], 172))
    lines += ["</svg>", ""]
    return "\n".join(lines)


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "banner.svg").write_text(hero_svg(), encoding="utf-8")
    print(f"wrote {OUTPUT_DIR / 'banner.svg'}")
    for project in PROJECTS:
        path = OUTPUT_DIR / project["file"]
        path.write_text(project_svg(project), encoding="utf-8")
        print(f"wrote {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
