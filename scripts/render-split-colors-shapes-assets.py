from __future__ import annotations

import json
import math
import shutil
from pathlib import Path

from bidi.algorithm import get_display
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
PACK_ROOT = ROOT / "assets/season-1/packs-wave2-he"
CARD_ROOT = ROOT / "assets/season-1/cards-wave2-he"
QUIZ_ROOT = ROOT / "assets/season-1/quizzes"
MANIFEST_PATH = CARD_ROOT / "manifest-split-colors-shapes.json"

GENERATED_DIR = Path("/Users/orentzezana/.codex/generated_images/019e0cc2-2e6e-7a30-ae21-954032721624")
PACK_SOURCES = {
    "colors": GENERATED_DIR / "ig_0693f615c95f808d016a0012f70f508191873fe65ccba9885f.png",
    "shapes": GENERATED_DIR / "ig_0693f615c95f808d016a00133401c0819197407362ab195c23.png",
}

FONT_REGULAR = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

W, H = 512, 716


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, size)


def rtl(text: str) -> str:
    return get_display(text)


def rounded(draw: ImageDraw.ImageDraw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def fit_text(draw, text, max_width, start_size, bold=False, min_size=18):
    size = start_size
    while size >= min_size:
        f = font(size, bold)
        bbox = draw.textbbox((0, 0), rtl(text), font=f)
        if bbox[2] - bbox[0] <= max_width:
            return f
        size -= 1
    return font(min_size, bold)


def wrap_he(draw, text, max_width, text_font):
    words = text.split()
    lines = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        bbox = draw.textbbox((0, 0), rtl(candidate), font=text_font)
        if bbox[2] - bbox[0] <= max_width or not current:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def gradient(size, top, bottom):
    img = Image.new("RGB", size, top)
    pix = img.load()
    for y in range(size[1]):
        t = y / max(size[1] - 1, 1)
        color = tuple(int(top[i] * (1 - t) + bottom[i] * t) for i in range(3))
        for x in range(size[0]):
            pix[x, y] = color
    return img


def add_noise(img, amount=16):
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    step = 8
    for y in range(0, img.height, step):
        for x in range(0, img.width, step):
            alpha = int((math.sin(x * 0.21 + y * 0.11) + 1) * amount / 2)
            d.point((x, y), fill=(255, 255, 255, alpha))
    return Image.alpha_composite(img.convert("RGBA"), overlay)


def draw_color_art(draw, key, cx, cy):
    palette = {
        "red": (224, 45, 58),
        "blue": (35, 116, 219),
        "yellow": (246, 203, 51),
        "green": (37, 165, 82),
        "orange": (242, 126, 37),
        "purple": (128, 67, 197),
        "pink": (235, 95, 159),
        "brown": (141, 89, 52),
        "black-white": (42, 43, 48),
        "rainbow": (255, 255, 255),
    }
    if key == "rainbow":
        colors = [(232, 55, 61), (244, 144, 40), (250, 217, 59), (47, 170, 82), (40, 128, 220), (128, 71, 199)]
        for i, color in enumerate(colors):
            draw.arc((cx - 135, cy - 70 + i * 16, cx + 135, cy + 190 + i * 16), 190, 350, fill=color, width=18)
        draw.ellipse((cx - 52, cy + 50, cx + 52, cy + 154), fill=(255, 255, 255), outline=(244, 205, 80), width=5)
        return
    color = palette[key]
    shadow = tuple(max(0, c - 55) for c in color)
    draw.ellipse((cx - 92, cy - 76, cx + 92, cy + 108), fill=shadow)
    draw.ellipse((cx - 98, cy - 92, cx + 86, cy + 92), fill=color, outline=(255, 242, 179), width=5)
    draw.ellipse((cx - 54, cy - 56, cx + 8, cy + 4), fill=(255, 255, 255, 92))
    if key == "black-white":
        draw.pieslice((cx - 98, cy - 92, cx + 86, cy + 92), 90, 270, fill=(32, 34, 40))
        draw.pieslice((cx - 98, cy - 92, cx + 86, cy + 92), 270, 90, fill=(248, 248, 242))
        draw.ellipse((cx - 98, cy - 92, cx + 86, cy + 92), outline=(255, 216, 96), width=5)
    for dx, dy in [(-125, -62), (126, -42), (-105, 112), (116, 98)]:
        draw.ellipse((cx + dx - 16, cy + dy - 16, cx + dx + 16, cy + dy + 16), fill=color, outline=(255, 255, 255), width=3)


def draw_shape_art(draw, key, cx, cy):
    fill = {
        "circle": (70, 147, 229),
        "square": (232, 68, 62),
        "triangle": (88, 185, 87),
        "rectangle": (247, 190, 54),
        "star": (147, 79, 202),
        "heart": (235, 78, 130),
        "diamond": (45, 188, 208),
        "oval": (240, 132, 50),
        "hexagon": (247, 165, 51),
        "spiral": (162, 81, 196),
    }[key]
    outline = (255, 235, 145)
    if key == "circle":
        draw.ellipse((cx - 92, cy - 92, cx + 92, cy + 92), fill=fill, outline=outline, width=7)
    elif key == "square":
        rounded(draw, (cx - 86, cy - 86, cx + 86, cy + 86), 20, fill, outline, 7)
    elif key == "triangle":
        draw.polygon([(cx, cy - 105), (cx - 105, cy + 84), (cx + 105, cy + 84)], fill=fill, outline=outline)
        draw.line([(cx, cy - 105), (cx - 105, cy + 84), (cx + 105, cy + 84), (cx, cy - 105)], fill=outline, width=7)
    elif key == "rectangle":
        rounded(draw, (cx - 118, cy - 64, cx + 118, cy + 64), 18, fill, outline, 7)
    elif key == "star":
        pts = []
        for i in range(10):
            r = 105 if i % 2 == 0 else 46
            a = -math.pi / 2 + i * math.pi / 5
            pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
        draw.polygon(pts, fill=fill)
        draw.line(pts + [pts[0]], fill=outline, width=7, joint="curve")
    elif key == "heart":
        draw.ellipse((cx - 88, cy - 72, cx, cy + 16), fill=fill)
        draw.ellipse((cx, cy - 72, cx + 88, cy + 16), fill=fill)
        draw.polygon([(cx - 88, cy - 22), (cx + 88, cy - 22), (cx, cy + 116)], fill=fill)
        draw.line([(cx - 88, cy - 22), (cx, cy + 116), (cx + 88, cy - 22)], fill=outline, width=7)
    elif key == "diamond":
        draw.polygon([(cx, cy - 110), (cx + 100, cy), (cx, cy + 110), (cx - 100, cy)], fill=fill)
        draw.line([(cx, cy - 110), (cx + 100, cy), (cx, cy + 110), (cx - 100, cy), (cx, cy - 110)], fill=outline, width=7)
    elif key == "oval":
        draw.ellipse((cx - 120, cy - 74, cx + 120, cy + 74), fill=fill, outline=outline, width=7)
    elif key == "hexagon":
        pts = [(cx + math.cos(math.pi / 6 + i * math.pi / 3) * 104, cy + math.sin(math.pi / 6 + i * math.pi / 3) * 104) for i in range(6)]
        draw.polygon(pts, fill=fill)
        draw.line(pts + [pts[0]], fill=outline, width=7)
    elif key == "spiral":
        pts = []
        for i in range(150):
            a = i * 0.22
            r = 3 + i * 0.68
            pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
        draw.line(pts, fill=fill, width=18, joint="curve")
        draw.line(pts, fill=outline, width=5, joint="curve")
    draw.ellipse((cx - 52, cy - 82, cx - 12, cy - 42), fill=(255, 255, 255, 70))


def render_card(pack_id, card):
    title = card["title_he"]
    facts = card["facts_he"]
    slug = card["card_id"].split("-", 2)[-1]
    out_path = ROOT / card["asset_path"]
    out_path.parent.mkdir(parents=True, exist_ok=True)

    if pack_id == "colors":
        bg = gradient((W, H), (255, 247, 228), (224, 246, 247)).convert("RGBA")
        accent = (30, 126, 218)
        key = card["card_id"].replace("colors-", "").split("-", 1)[1]
    else:
        bg = gradient((W, H), (248, 244, 255), (225, 246, 238)).convert("RGBA")
        accent = (113, 76, 204)
        key = card["card_id"].replace("shapes-", "").split("-", 1)[1]

    bg = add_noise(bg, 12)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-90, 30, 220, 340), fill=(255, 220, 85, 70))
    gd.ellipse((280, 70, 620, 390), fill=(*accent, 52))
    gd.ellipse((115, 160, 405, 520), fill=(255, 255, 255, 96))
    bg = Image.alpha_composite(bg, glow.filter(ImageFilter.GaussianBlur(18)))

    d = ImageDraw.Draw(bg)
    rounded(d, (20, 18, W - 20, H - 18), 34, (255, 255, 252, 238), (45, 58, 88, 255), 4)
    rounded(d, (34, 32, W - 34, H - 32), 28, (255, 255, 255, 70), (245, 199, 76, 255), 5)
    rounded(d, (54, 62, W - 54, 120), 18, (32, 47, 83, 235), (245, 199, 76), 3)

    d.text((W / 2, 79), rtl("אוספים עובדות"), font=font(28, True), fill=(255, 236, 144), anchor="mm")
    d.text((82, 100), rtl("עונה 1"), font=font(15, True), fill=(255, 255, 255), anchor="mm")
    d.text((W - 84, 100), rtl(f"{card['index']} מתוך 10"), font=font(15, True), fill=(255, 255, 255), anchor="mm")

    rounded(d, (62, 132, W - 62, 394), 28, (255, 255, 255, 180), (87, 113, 159), 3)
    if pack_id == "colors":
        draw_color_art(d, key, W // 2, 250)
    else:
        draw_shape_art(d, key, W // 2, 250)

    rounded(d, (58, 410, W - 58, 466), 18, (32, 47, 83, 244), (245, 199, 76), 4)
    title_font = fit_text(d, title, 330, 34, True, 24)
    d.text((W / 2, 438), rtl(title), font=title_font, fill=(255, 255, 255), anchor="mm")
    rounded(d, (72, 478, W - 72, 612), 16, (255, 252, 242, 235), (207, 173, 96), 2)

    y = 500
    fact_font = font(19, True)
    for fact in facts:
        lines = wrap_he(d, fact, 322, fact_font)
        d.ellipse((W - 93, y + 5, W - 79, y + 19), fill=(245, 199, 76), outline=(32, 47, 83), width=1)
        for line in lines[:2]:
            d.text((W - 102, y), rtl(line), font=fact_font, fill=(32, 47, 83), anchor="ra")
            y += 24
        y += 6

    rounded(d, (82, 632, W - 82, 674), 15, (*accent, 230), (255, 235, 145), 3)
    d.text((W / 2, 653), rtl(card["tags_he"][0]), font=font(18, True), fill=(255, 255, 255), anchor="mm")

    source_path = out_path.with_suffix(".png")
    bg.convert("RGB").save(source_path, quality=96)
    bg.convert("RGB").save(out_path, quality=88, method=6)
    return out_path


def resize_pack(src, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    img = Image.open(src).convert("RGB")
    img.thumbnail((W, H), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (W, H), (255, 255, 255))
    canvas.paste(img, ((W - img.width) // 2, (H - img.height) // 2))
    canvas.save(dest.with_suffix(".png"), quality=96)
    canvas.save(dest, quality=90, method=6)


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
    sheet.save(out_path, quality=88, method=6)


def main():
    manifest = {
        "schema_version": 1,
        "product_name_he": "אוספים עובדות",
        "language": "he",
        "season": 1,
        "note_he": "חבילת צבעים וצורות פוצלה לשתי חבילות עצמאיות. כל קלף וחבילה הם תמונת WebP נפרדת.",
        "packs": [],
        "cards": [],
    }
    for pack_id in ["colors", "shapes"]:
        pack_json = json.loads((QUIZ_ROOT / f"{pack_id}.json").read_text("utf-8"))
        pack_path = PACK_ROOT / f"pack-{pack_id}.webp"
        resize_pack(PACK_SOURCES[pack_id], pack_path)
        manifest["packs"].append({
            "pack_id": pack_id,
            "title_he": pack_json["pack_title_he"],
            "asset_path": str(pack_path.relative_to(ROOT)),
        })
        rendered = []
        for card in pack_json["cards"]:
            out = render_card(pack_id, card)
            rendered.append(out)
            manifest["cards"].append({
                "card_id": card["card_id"],
                "title_he": card["title_he"],
                "asset_path": str(out.relative_to(ROOT)),
            })
        contact_sheet(rendered, CARD_ROOT / f"{pack_id}-contact-sheet.webp", cols=5)

    contact_sheet([ROOT / c["asset_path"] for c in manifest["cards"]], CARD_ROOT / "colors-shapes-split-20-contact-sheet.webp", cols=5)
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), "utf-8")


if __name__ == "__main__":
    main()
