from __future__ import annotations

import json
import math
from pathlib import Path

from bidi.algorithm import get_display
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
CARD_ROOT = ROOT / "assets/season-1/cards-wave2-he"
QUIZ_ROOT = ROOT / "assets/season-1/quizzes"
FINALIZED = ROOT / "assets/season-1/finalized/colors-shapes-closed.json"

FONT_REGULAR = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

W, H = 1024, 1432
OUT_W, OUT_H = 512, 716


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, size)


def rtl(text: str) -> str:
    return get_display(text)


def rounded(draw: ImageDraw.ImageDraw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def gradient(size, top, bottom):
    img = Image.new("RGB", size, top)
    pix = img.load()
    for y in range(size[1]):
        t = y / max(1, size[1] - 1)
        color = tuple(int(top[i] * (1 - t) + bottom[i] * t) for i in range(3))
        for x in range(size[0]):
            pix[x, y] = color
    return img.convert("RGBA")


def text_center(draw, xy, text, size, fill, bold=True, stroke=0, stroke_fill=(0, 0, 0)):
    draw.text(xy, rtl(text), font=font(size, bold), fill=fill, anchor="mm", stroke_width=stroke, stroke_fill=stroke_fill)


def text_right(draw, xy, text, size, fill, bold=False, stroke=0, stroke_fill=(0, 0, 0)):
    draw.text(xy, rtl(text), font=font(size, bold), fill=fill, anchor="ra", stroke_width=stroke, stroke_fill=stroke_fill)


def wrap_he(draw, text, max_width, size, bold=True):
    f = font(size, bold)
    words = text.split()
    lines, current = [], ""
    for word in words:
        candidate = f"{current} {word}".strip()
        bbox = draw.textbbox((0, 0), rtl(candidate), font=f)
        if bbox[2] - bbox[0] <= max_width or not current:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def add_shadow(base, layer, offset=(0, 18), blur=18, alpha=100):
    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    mask = layer.getchannel("A").filter(ImageFilter.GaussianBlur(blur))
    tint = Image.new("RGBA", base.size, (0, 0, 0, alpha))
    shadow.alpha_composite(tint, offset)
    shadow.putalpha(mask)
    return Image.alpha_composite(Image.alpha_composite(base, shadow), layer)


def draw_corner_ornaments(draw, x0, y0, x1, y1):
    gold = (230, 172, 58)
    dark_gold = (121, 77, 23)
    for sx, sy in [(1, 1), (-1, 1), (1, -1), (-1, -1)]:
        cx = x0 if sx == 1 else x1
        cy = y0 if sy == 1 else y1
        draw.arc((cx - sx * 95 - (sx < 0) * 190, cy - sy * 95 - (sy < 0) * 190,
                  cx + sx * 95 + (sx < 0) * 190, cy + sy * 95 + (sy < 0) * 190),
                 0, 360, fill=dark_gold, width=8)
        draw.ellipse((cx - sx * 28 - 28, cy - sy * 28 - 28, cx - sx * 28 + 28, cy - sy * 28 + 28), fill=gold, outline=dark_gold, width=5)


def draw_frame(base, pack_title, title, index, badge_color):
    draw = ImageDraw.Draw(base)
    # Card body and collectible frame.
    rounded(draw, (36, 28, W - 36, H - 28), 58, (19, 48, 73), (15, 24, 42), 8)
    rounded(draw, (54, 48, W - 54, H - 48), 46, (245, 199, 76), (97, 66, 28), 8)
    rounded(draw, (76, 70, W - 76, H - 70), 36, (22, 95, 110), (255, 238, 151), 5)
    draw_corner_ornaments(draw, 88, 82, W - 88, H - 82)

    # Main art window.
    rounded(draw, (104, 176, W - 104, 796), 34, (241, 248, 249), (40, 56, 83), 5)
    rounded(draw, (122, 194, W - 122, 778), 24, (220, 244, 248), (214, 164, 48), 4)

    # Side badges.
    for x, label in [(128, "עונה 1"), (W - 128, f"{index}/10")]:
        draw.regular_polygon((x, 120, 54), 6, rotation=math.pi / 6, fill=(21, 94, 116), outline=(245, 199, 76), width=5)
        text_center(draw, (x, 120), label, 27, (255, 255, 255), True, 1, (8, 34, 54))

    # Title banner.
    draw.rounded_rectangle((190, 74, W - 190, 174), 22, fill=(240, 218, 166), outline=(119, 80, 29), width=4)
    draw.polygon([(172, 92), (222, 126), (172, 160)], fill=(197, 135, 36), outline=(99, 65, 24))
    draw.polygon([(W - 172, 92), (W - 222, 126), (W - 172, 160)], fill=(197, 135, 36), outline=(99, 65, 24))
    text_center(draw, (W // 2, 124), title, 64 if len(title) < 8 else 54, (15, 32, 59), True)

    # Pack tag.
    rounded(draw, (350, 790, W - 350, 858), 24, badge_color, (245, 199, 76), 5)
    text_center(draw, (W // 2, 824), pack_title, 34, (255, 255, 255), True, 1, (0, 0, 0))

    # Facts parchment panel.
    rounded(draw, (118, 880, W - 118, 1212), 34, (239, 224, 185), (131, 91, 37), 5)
    rounded(draw, (142, 902, W - 142, 1192), 24, (248, 238, 211), (209, 181, 119), 2)

    # Bottom logo.
    rounded(draw, (286, 1218, W - 286, 1328), 28, (13, 63, 91), (245, 199, 76), 6)
    text_center(draw, (W // 2, 1256), "אוספים", 45, (255, 255, 255), True, 2, (4, 29, 48))
    text_center(draw, (W // 2, 1304), "עובדות", 49, (255, 224, 74), True, 2, (4, 29, 48))


def draw_art_background(draw, pack_id):
    if pack_id == "colors":
        # Painted, glowing educational fantasy backdrop.
        for i, col in enumerate([(229, 55, 66), (242, 132, 34), (247, 208, 57), (56, 171, 88), (42, 127, 224), (133, 70, 202)]):
            y = 230 + i * 72
            draw.rounded_rectangle((128, y, W - 128, y + 120), 60, fill=(*col, 120))
        for i in range(42):
            x = 130 + (i * 73) % 760
            y = 216 + (i * 47) % 520
            r = 5 + (i % 5) * 3
            draw.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, 130))
    else:
        # Toy blocks over a starry chalkboard-like magical table.
        for i in range(11):
            x = 130 + i * 76
            draw.line((x, 210, x - 120, 770), fill=(255, 255, 255, 34), width=3)
        for i in range(36):
            x = 135 + (i * 97) % 760
            y = 210 + (i * 61) % 530
            draw.regular_polygon((x, y, 7 + i % 4), 5, rotation=.3, fill=(255, 226, 98, 120))


def paint_blob(draw, cx, cy, color, label=None):
    dark = tuple(max(0, c - 70) for c in color)
    light = tuple(min(255, c + 70) for c in color)
    draw.ellipse((cx - 166, cy - 116, cx + 166, cy + 216), fill=dark)
    draw.ellipse((cx - 172, cy - 148, cx + 148, cy + 172), fill=color, outline=(255, 232, 126), width=8)
    draw.ellipse((cx - 105, cy - 112, cx - 8, cy - 18), fill=(*light, 230))
    draw.ellipse((cx - 56, cy - 70, cx - 12, cy - 26), fill=(255, 255, 255, 190))
    for a in range(0, 360, 45):
        r = math.radians(a)
        sx = cx + math.cos(r) * 215
        sy = cy + math.sin(r) * 155
        draw.ellipse((sx - 28, sy - 28, sx + 28, sy + 28), fill=color, outline=(255, 255, 255), width=4)


def rainbow_art(draw, cx, cy):
    colors = [(229, 55, 66), (242, 132, 34), (247, 208, 57), (56, 171, 88), (42, 127, 224), (133, 70, 202)]
    for i, col in enumerate(colors):
        draw.arc((cx - 250, cy - 150 + i * 30, cx + 250, cy + 350 + i * 30), 190, 350, fill=col, width=28)
    draw.ellipse((cx - 84, cy + 110, cx + 84, cy + 278), fill=(255, 255, 255), outline=(245, 199, 76), width=8)
    for dx in [-210, 210]:
        draw.rounded_rectangle((cx + dx - 90, cy + 210, cx + dx + 90, cy + 285), 35, fill=(255, 255, 255, 230), outline=(174, 198, 219), width=3)


def shape_polygon(draw, key, cx, cy, color):
    shadow = tuple(max(0, c - 70) for c in color)
    outline = (255, 232, 126)
    if key == "circle":
        draw.ellipse((cx - 160, cy - 160, cx + 160, cy + 160), fill=shadow)
        draw.ellipse((cx - 170, cy - 188, cx + 150, cy + 132), fill=color, outline=outline, width=8)
    elif key == "square":
        rounded(draw, (cx - 148, cy - 148, cx + 148, cy + 148), 34, shadow)
        rounded(draw, (cx - 162, cy - 180, cx + 136, cy + 118), 34, color, outline, 8)
    elif key == "triangle":
        pts = [(cx, cy - 196), (cx - 190, cy + 136), (cx + 190, cy + 136)]
        draw.polygon([(x + 16, y + 32) for x, y in pts], fill=shadow)
        draw.polygon(pts, fill=color)
        draw.line(pts + [pts[0]], fill=outline, width=8, joint="curve")
    elif key == "rectangle":
        rounded(draw, (cx - 220, cy - 100, cx + 220, cy + 100), 30, shadow)
        rounded(draw, (cx - 238, cy - 132, cx + 202, cy + 68), 30, color, outline, 8)
    elif key == "star":
        pts = []
        for i in range(10):
            rr = 185 if i % 2 == 0 else 82
            a = -math.pi / 2 + i * math.pi / 5
            pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
        draw.polygon([(x + 18, y + 28) for x, y in pts], fill=shadow)
        draw.polygon(pts, fill=color)
        draw.line(pts + [pts[0]], fill=outline, width=8, joint="curve")
    elif key == "heart":
        draw.ellipse((cx - 155, cy - 150, cx, cy + 10), fill=color)
        draw.ellipse((cx, cy - 150, cx + 155, cy + 10), fill=color)
        draw.polygon([(cx - 156, cy - 55), (cx + 156, cy - 55), (cx, cy + 205)], fill=color)
        draw.line([(cx - 156, cy - 55), (cx, cy + 205), (cx + 156, cy - 55)], fill=outline, width=8)
    elif key == "diamond":
        pts = [(cx, cy - 190), (cx + 175, cy), (cx, cy + 190), (cx - 175, cy)]
        draw.polygon([(x + 18, y + 30) for x, y in pts], fill=shadow)
        draw.polygon(pts, fill=color)
        draw.line(pts + [pts[0]], fill=outline, width=8)
    elif key == "oval":
        draw.ellipse((cx - 230, cy - 124, cx + 230, cy + 124), fill=shadow)
        draw.ellipse((cx - 242, cy - 154, cx + 204, cy + 92), fill=color, outline=outline, width=8)
    elif key == "hexagon":
        pts = [(cx + math.cos(math.pi / 6 + i * math.pi / 3) * 172, cy + math.sin(math.pi / 6 + i * math.pi / 3) * 172) for i in range(6)]
        draw.polygon([(x + 18, y + 30) for x, y in pts], fill=shadow)
        draw.polygon(pts, fill=color)
        draw.line(pts + [pts[0]], fill=outline, width=8)
    elif key == "spiral":
        pts = []
        for i in range(210):
            a = i * 0.22
            rr = 4 + i * 0.85
            pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
        draw.line([(x + 15, y + 24) for x, y in pts], fill=shadow, width=42, joint="curve")
        draw.line(pts, fill=color, width=42, joint="curve")
        draw.line(pts, fill=outline, width=10, joint="curve")
    draw.ellipse((cx - 95, cy - 150, cx - 20, cy - 75), fill=(255, 255, 255, 120))


def draw_facts(draw, facts, accent):
    y = 942
    for fact in facts:
        lines = wrap_he(draw, fact, 600, 33, True)
        draw.ellipse((828, y + 7, 858, y + 37), fill=accent, outline=(33, 47, 71), width=3)
        for line in lines[:2]:
            text_right(draw, (806, y), line, 33, (22, 33, 54), True)
            y += 42
        y += 22


def render_card(pack_id, card):
    if pack_id == "colors":
        base = gradient((W, H), (26, 106, 125), (16, 47, 74))
        badge = (24, 114, 156)
    else:
        base = gradient((W, H), (72, 49, 125), (18, 55, 85))
        badge = (105, 69, 190)

    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow, "RGBA")
    gd.ellipse((-180, 80, 430, 650), fill=(255, 220, 86, 70))
    gd.ellipse((580, 140, 1210, 820), fill=(83, 206, 215, 60))
    gd.ellipse((180, 420, 850, 1160), fill=(255, 255, 255, 34))
    base = Image.alpha_composite(base, glow.filter(ImageFilter.GaussianBlur(30)))

    draw_frame(base, "צבעים" if pack_id == "colors" else "צורות", card["title_he"], card["index"], badge)
    draw = ImageDraw.Draw(base, "RGBA")
    draw_art_background(draw, pack_id)

    slug = card["card_id"].split("-", 2)[-1]
    color_map = {
        "red": (223, 48, 60), "blue": (38, 127, 224), "yellow": (245, 202, 48),
        "green": (44, 170, 83), "orange": (242, 123, 35), "purple": (129, 72, 201),
        "pink": (235, 91, 156), "brown": (139, 88, 52), "black-white": (34, 36, 42),
        "rainbow": (255, 255, 255),
    }
    shape_color = {
        "circle": (62, 146, 228), "square": (230, 70, 64), "triangle": (78, 183, 83),
        "rectangle": (245, 190, 56), "star": (144, 80, 204), "heart": (235, 82, 135),
        "diamond": (42, 185, 207), "oval": (241, 132, 50), "hexagon": (245, 164, 48),
        "spiral": (159, 82, 198),
    }
    if pack_id == "colors":
        if slug == "rainbow":
            rainbow_art(draw, W // 2, 392)
        elif slug == "black-white":
            paint_blob(draw, W // 2, 420, (35, 36, 42))
            draw.pieslice((W // 2 - 172, 272, W // 2 + 148, 592), -90, 90, fill=(245, 245, 237), outline=(255, 232, 126), width=8)
        else:
            paint_blob(draw, W // 2, 420, color_map[slug])
        accent = color_map.get(slug, (245, 199, 76))
        if slug == "black-white":
            accent = (40, 40, 45)
        if slug == "rainbow":
            accent = (42, 127, 224)
    else:
        shape_polygon(draw, slug, W // 2, 430, shape_color[slug])
        accent = shape_color[slug]

    # Repaint frame on top of art edges where needed for the premium layered look.
    rounded(draw, (104, 176, W - 104, 796), 34, None, (39, 54, 80), 6)
    rounded(draw, (122, 194, W - 122, 778), 24, None, (245, 199, 76), 4)

    # Title and tag need to sit above the art.
    rounded(draw, (190, 74, W - 190, 174), 22, (240, 218, 166), (119, 80, 29), 4)
    text_center(draw, (W // 2, 124), card["title_he"], 64 if len(card["title_he"]) < 8 else 54, (15, 32, 59), True)
    rounded(draw, (350, 790, W - 350, 858), 24, badge, (245, 199, 76), 5)
    text_center(draw, (W // 2, 824), "צבעים" if pack_id == "colors" else "צורות", 34, (255, 255, 255), True, 1, (0, 0, 0))

    draw_facts(draw, card["facts_he"], accent if isinstance(accent, tuple) else badge)

    out_path = ROOT / card["asset_path"]
    out_path.parent.mkdir(parents=True, exist_ok=True)
    final = base.convert("RGB").resize((OUT_W, OUT_H), Image.Resampling.LANCZOS)
    final.save(out_path.with_suffix(".png"), quality=96)
    final.save(out_path, quality=90, method=6)
    return out_path


def contact_sheet(paths, out_path, cols=5):
    thumb_w, thumb_h = 184, 258
    pad = 18
    rows = math.ceil(len(paths) / cols)
    sheet = Image.new("RGB", (cols * thumb_w + (cols + 1) * pad, rows * thumb_h + (rows + 1) * pad), (246, 241, 232))
    for i, path in enumerate(paths):
        img = Image.open(path).convert("RGB").resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        x = pad + (i % cols) * (thumb_w + pad)
        y = pad + (i // cols) * (thumb_h + pad)
        sheet.paste(img, (x, y))
    sheet.save(out_path, quality=90, method=6)


def main():
    manifest = json.loads(FINALIZED.read_text("utf-8"))
    manifest["status_he"] = "סגור - תוקן לסגנון פרימיום עונה 1"
    manifest["visual_fix_he"] = "קלפי צבעים וצורות הוחלפו מרינדור שטוח לרינדור תמונה פרימיום עם מסגרת זהב, איור מרכזי ופאנל עובדות, באותו כיוון של קלפי עונה 1."
    all_paths = []
    for pack_id in ["colors", "shapes"]:
        quiz = json.loads((QUIZ_ROOT / f"{pack_id}.json").read_text("utf-8"))
        paths = []
        for card in quiz["cards"]:
            paths.append(render_card(pack_id, card))
        contact_sheet(paths, CARD_ROOT / f"{pack_id}-contact-sheet.webp", cols=5)
        all_paths.extend(paths)
    contact_sheet(all_paths, CARD_ROOT / "colors-shapes-split-20-contact-sheet.webp", cols=5)
    FINALIZED.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), "utf-8")


if __name__ == "__main__":
    main()
