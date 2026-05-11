#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import shutil
import subprocess
from io import BytesIO
from pathlib import Path

from bidi.algorithm import get_display
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
GAME_DATA_PATHS = [
    ROOT / "assets/season-1/game-data.json",
    ROOT / "backend/data/game-data.json",
    ROOT / "converstion to angular/public/assets/season-1/game-data.json",
]
PUBLIC_ASSETS = ROOT / "converstion to angular/public"
SOURCE_ART_ROOT = ROOT / "assets/season-1/cards-native-he/source-art"
TARGET_PACKS = {
    "animals": "חיות חמודות",
    "crystals": "אבני חן",
    "security": "צה״ל והצלה",
}
FONT_REGULAR = Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf")
FONT_BOLD = Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf")
CARD_SIZE = (1024, 1432)
PACK_SIZE = (1024, 1432)


PALETTES = {
    "animals": {
        "outer": (10, 111, 132),
        "inner": (29, 172, 161),
        "glow": (111, 226, 156),
        "art": (238, 170, 84),
    },
    "crystals": {
        "outer": (62, 31, 122),
        "inner": (23, 205, 211),
        "glow": (194, 107, 255),
        "art": (79, 236, 238),
    },
    "security": {
        "outer": (18, 88, 120),
        "inner": (48, 173, 217),
        "glow": (255, 213, 91),
        "art": (69, 150, 199),
    },
}


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_BOLD if bold else FONT_REGULAR), size=size)


def rtl(text: str) -> str:
    return get_display(text.replace("'", "׳"))


def text_size(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont) -> tuple[int, int]:
    box = draw.textbbox((0, 0), rtl(text), font=fnt)
    return box[2] - box[0], box[3] - box[1]


def draw_centered(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    text: str,
    fnt: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int, int] | tuple[int, int, int],
    stroke_width: int = 0,
    stroke_fill: tuple[int, int, int, int] | tuple[int, int, int] | None = None,
) -> None:
    visual = rtl(text)
    bbox = draw.textbbox((0, 0), visual, font=fnt, stroke_width=stroke_width)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = box[0] + (box[2] - box[0] - tw) / 2
    y = box[1] + (box[3] - box[1] - th) / 2 - bbox[1] / 2
    draw.text((x, y), visual, font=fnt, fill=fill, stroke_width=stroke_width, stroke_fill=stroke_fill)


def wrap_text(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont, width: int, max_lines: int = 2) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if text_size(draw, candidate, fnt)[0] <= width or not current:
            current = candidate
            continue
        lines.append(current)
        current = word
        if len(lines) >= max_lines - 1:
            break
    if current and len(lines) < max_lines:
        lines.append(current)
    return lines[:max_lines]


def rounded_layer(size: tuple[int, int], radius: int, fill: tuple[int, int, int, int]) -> Image.Image:
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    mask = Image.new("L", size, 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    ImageDraw.Draw(layer).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=fill)
    layer.putalpha(mask)
    return layer


def gradient(size: tuple[int, int], top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    img = Image.new("RGBA", size)
    pix = img.load()
    for y in range(size[1]):
        t = y / max(1, size[1] - 1)
        color = tuple(int(top[i] * (1 - t) + bottom[i] * t) for i in range(3)) + (255,)
        for x in range(size[0]):
            pix[x, y] = color
    return img


def paste_rounded(base: Image.Image, img: Image.Image, box: tuple[int, int, int, int], radius: int) -> None:
    resized = img.resize((box[2] - box[0], box[3] - box[1]), Image.Resampling.LANCZOS)
    mask = Image.new("L", resized.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, resized.size[0] - 1, resized.size[1] - 1), radius=radius, fill=255)
    base.paste(resized, (box[0], box[1]), mask)


def crop_card_art(src: Image.Image, pack_id: str) -> Image.Image:
    src = src.convert("RGBA")
    w, h = src.size
    # Pull only the illustration window out of the previous cards. Crystal and
    # security art had generated title text inside the image, so crop lower.
    crop_boxes = {
        "animals": (0.33, 0.31, 0.76, 0.61),
        "crystals": (0.30, 0.36, 0.76, 0.55),
        "security": (0.30, 0.37, 0.76, 0.58),
    }
    lx, ty, rx, by = crop_boxes[pack_id]
    left = int(w * lx)
    top = int(h * ty)
    right = int(w * rx)
    bottom = int(h * by)
    crop = src.crop((left, top, right, bottom))
    return crop.resize((730, 474), Image.Resampling.LANCZOS)


def load_git_version(asset_path: str) -> Image.Image | None:
    try:
        raw = subprocess.check_output(["git", "show", f"HEAD:{asset_path}"], cwd=ROOT)
    except subprocess.CalledProcessError:
        return None
    return Image.open(BytesIO(raw)).convert("RGBA")


def load_card_art(pack_id: str, card: dict) -> Image.Image:
    source_path = SOURCE_ART_ROOT / pack_id / Path(card["asset_path"]).name
    if source_path.exists():
        return Image.open(source_path).convert("RGBA").resize((730, 474), Image.Resampling.LANCZOS)

    original = load_git_version(card["asset_path"])
    if original is None:
        original_path = ROOT / card["asset_path"]
        original = Image.open(original_path).convert("RGBA") if original_path.exists() else gradient((730, 474), PALETTES[pack_id]["inner"], PALETTES[pack_id]["outer"])

    art = crop_card_art(original, pack_id)
    source_path.parent.mkdir(parents=True, exist_ok=True)
    art.save(source_path, "WEBP", quality=96, method=6)
    return art


def draw_sparkle(draw: ImageDraw.ImageDraw, cx: int, cy: int, color: tuple[int, int, int, int]) -> None:
    draw.polygon([(cx, cy - 20), (cx + 8, cy - 6), (cx + 20, cy), (cx + 8, cy + 6), (cx, cy + 20), (cx - 8, cy + 6), (cx - 20, cy), (cx - 8, cy - 6)], fill=color)
    draw.ellipse((cx - 4, cy - 4, cx + 4, cy + 4), fill=(255, 245, 186, 255))


def clean_fact(text: str, fallback: str) -> str:
    text = (text or fallback).strip()
    text = text.replace("\n", " ")
    if len(text) > 62:
        text = text[:59].rstrip() + "..."
    return text


def draw_crystal_art(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], palette: dict) -> None:
    x1, y1, x2, y2 = box
    cx = (x1 + x2) // 2
    cy = (y1 + y2) // 2
    colors = [(94, 239, 242), (164, 94, 244), (255, 214, 91)]
    for i, off in enumerate([-170, -70, 65, 155]):
        top = (cx + off, y1 + 70 + (i % 2) * 26)
        mid_l = (cx + off - 56, cy + 70)
        mid_r = (cx + off + 56, cy + 70)
        bot = (cx + off, y2 - 44)
        draw.polygon([top, mid_r, bot, mid_l], fill=colors[i % 3] + (180,), outline=(255, 245, 188, 230))
        draw.line([top, bot], fill=(255, 255, 255, 130), width=4)
    for r in range(8):
        angle = r * math.pi / 4
        px = cx + int(math.cos(angle) * 250)
        py = cy + int(math.sin(angle) * 150)
        draw.ellipse((px - 5, py - 5, px + 5, py + 5), fill=(255, 243, 155, 180))


def draw_security_art(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], palette: dict) -> None:
    x1, y1, x2, y2 = box
    cx = (x1 + x2) // 2
    cy = (y1 + y2) // 2
    draw.rounded_rectangle((cx - 190, y1 + 88, cx + 190, y2 - 54), radius=80, fill=(33, 126, 172, 210), outline=(255, 224, 116, 240), width=8)
    draw.polygon([(cx, y1 + 56), (cx + 180, cy - 4), (cx + 120, y2 - 56), (cx, y2 - 8), (cx - 120, y2 - 56), (cx - 180, cy - 4)], fill=(11, 67, 106, 230), outline=(255, 224, 116, 240))
    draw.line((cx, cy - 110, cx, cy + 100), fill=(255, 255, 255, 230), width=26)
    draw.line((cx - 88, cy - 4, cx + 88, cy - 4), fill=(255, 255, 255, 230), width=26)
    draw.arc((cx - 260, cy - 220, cx + 260, cy + 220), 214, 326, fill=(255, 224, 116, 170), width=12)


def render_card(pack_id: str, pack_title: str, card: dict) -> None:
    palette = PALETTES[pack_id]
    out_path = ROOT / card["asset_path"]
    art = load_card_art(pack_id, card)

    img = Image.new("RGBA", CARD_SIZE, (0, 0, 0, 0))
    shadow = rounded_layer((900, 1300), 72, (0, 0, 0, 70)).filter(ImageFilter.GaussianBlur(20))
    img.alpha_composite(shadow, (70, 76))

    card_layer = rounded_layer((880, 1260), 60, (254, 246, 216, 255))
    img.alpha_composite(card_layer, (72, 72))
    d = ImageDraw.Draw(img, "RGBA")

    d.rounded_rectangle((72, 72, 952, 1332), radius=60, outline=(113, 73, 13, 255), width=22)
    d.rounded_rectangle((104, 104, 920, 1300), radius=46, outline=(255, 218, 91, 255), width=18)
    d.rounded_rectangle((132, 132, 892, 1270), radius=34, outline=palette["inner"] + (255,), width=10)

    for i in range(32):
        x = 134 + (i * 73) % 740
        y = 140 + (i * 113) % 1120
        d.ellipse((x, y, x + 5, y + 5), fill=(255, 238, 160, 120))

    d.rounded_rectangle((126, 130, 258, 190), radius=24, fill=(255, 211, 82, 255), outline=(128, 83, 10, 255), width=4)
    draw_centered(d, (126, 130, 258, 190), "עונה 1", font(32, True), (43, 50, 45, 255))
    d.rounded_rectangle((630, 130, 888, 190), radius=24, fill=(255, 211, 82, 255), outline=(128, 83, 10, 255), width=4)
    draw_centered(d, (630, 130, 888, 190), pack_title, font(30, True), (43, 50, 45, 255))

    draw_centered(d, (190, 178, 834, 250), "אוספים עובדות", font(62, True), (255, 221, 92, 255), 3, (80, 49, 11, 255))

    d.rounded_rectangle((170, 258, 854, 338), radius=32, fill=(255, 244, 205, 255), outline=(180, 122, 32, 255), width=5)
    draw_centered(d, (180, 258, 844, 338), card["title_he"], font(54, True), (47, 64, 70, 255))

    art_box = (150, 366, 874, 836)
    d.rounded_rectangle((art_box[0] - 10, art_box[1] - 10, art_box[2] + 10, art_box[3] + 10), radius=36, fill=(17, 65, 86, 255), outline=(255, 218, 91, 255), width=8)
    art_bg = gradient((art_box[2] - art_box[0], art_box[3] - art_box[1]), palette["outer"], palette["inner"])
    img.alpha_composite(art_bg, (art_box[0], art_box[1]))
    if pack_id == "crystals":
        draw_crystal_art(d, art_box, palette)
    elif pack_id == "security":
        draw_security_art(d, art_box, palette)
    paste_rounded(img, art, art_box, 26)
    d.rounded_rectangle(art_box, radius=26, outline=(255, 250, 210, 190), width=5)

    facts = [clean_fact(f, f"עובדה על {card['title_he']}") for f in (card.get("facts_he") or [])[:3]]
    while len(facts) < 3:
        facts.append(f"עובדה על {card['title_he']}")
    fact_y = 872
    for idx, fact in enumerate(facts):
        y = fact_y + idx * 108
        d.rounded_rectangle((150, y, 874, y + 82), radius=30, fill=(255, 243, 204, 255), outline=(195, 133, 36, 255), width=5)
        d.ellipse((174, y + 14, 228, y + 68), fill=palette["inner"] + (255,), outline=(98, 72, 24, 255), width=4)
        draw_centered(d, (174, y + 14, 228, y + 68), str(idx + 1), font(26, True), (255, 255, 239, 255))
        lines = wrap_text(d, fact, font(30, True), 560, 2)
        line_h = 34
        start_y = y + 42 - (len(lines) * line_h) / 2
        for li, line in enumerate(lines):
            draw_centered(d, (250, int(start_y + li * line_h), 798, int(start_y + (li + 1) * line_h)), line, font(30, True), (50, 55, 49, 255))
        draw_sparkle(d, 831, y + 42, (210, 148, 34, 255))

    d.rounded_rectangle((418, 1216, 606, 1282), radius=28, fill=(255, 211, 82, 255), outline=(118, 77, 13, 255), width=5)
    draw_centered(d, (418, 1216, 606, 1282), f"{card['index']}/10", font(36, True), (44, 51, 43, 255))

    final = img.resize((512, 716), Image.Resampling.LANCZOS)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    final.save(out_path, "WEBP", quality=96, method=6)
    public = PUBLIC_ASSETS / card["asset_path"]
    public.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(out_path, public)


def build_pack_showcase(pack_id: str, pack: dict) -> Image.Image:
    palette = PALETTES[pack_id]
    showcase = gradient((650, 640), palette["outer"], palette["inner"])
    d = ImageDraw.Draw(showcase, "RGBA")
    for i in range(26):
        x = 28 + (i * 91) % 590
        y = 24 + (i * 67) % 570
        draw_sparkle(d, x, y, (255, 226, 112, 110))

    art_1 = load_card_art(pack_id, pack["cards"][0])
    art_2 = load_card_art(pack_id, pack["cards"][min(4, len(pack["cards"]) - 1)])
    art_3 = load_card_art(pack_id, pack["cards"][min(7, len(pack["cards"]) - 1)])
    paste_rounded(showcase, art_1, (70, 70, 580, 390), 34)
    paste_rounded(showcase, art_2, (62, 408, 318, 604), 28)
    paste_rounded(showcase, art_3, (332, 408, 588, 604), 28)
    d.rounded_rectangle((70, 70, 580, 390), radius=34, outline=(255, 241, 169, 230), width=7)
    d.rounded_rectangle((62, 408, 318, 604), radius=28, outline=(255, 241, 169, 215), width=6)
    d.rounded_rectangle((332, 408, 588, 604), radius=28, outline=(255, 241, 169, 215), width=6)
    return showcase


def render_pack(pack_id: str, pack: dict) -> None:
    palette = PALETTES[pack_id]
    out_path = ROOT / pack["pack_asset_path"]
    art = build_pack_showcase(pack_id, pack)
    title = TARGET_PACKS[pack_id]

    img = Image.new("RGBA", PACK_SIZE, (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    shadow = rounded_layer((690, 1190), 48, (0, 0, 0, 90)).filter(ImageFilter.GaussianBlur(24))
    img.alpha_composite(shadow, (176, 128))

    wrapper = rounded_layer((650, 1160), 52, palette["outer"] + (255,))
    img.alpha_composite(wrapper, (187, 120))
    for y in range(132, 1270, 38):
        d.line((204, y, 822, y + 18), fill=(255, 255, 255, 24), width=6)
    d.rounded_rectangle((187, 120, 837, 1280), radius=52, outline=(255, 226, 94, 255), width=16)
    d.rounded_rectangle((218, 155, 806, 1244), radius=40, outline=palette["inner"] + (255,), width=8)

    for y in [126, 1216]:
        for x in range(220, 808, 34):
            d.polygon([(x, y), (x + 18, y + 26), (x + 36, y)], fill=(255, 232, 118, 170))

    draw_centered(d, (242, 196, 782, 284), "אוספים עובדות", font(76, True), (255, 224, 91, 255), 3, (72, 43, 8, 255))
    d.rounded_rectangle((318, 296, 706, 370), radius=28, fill=(255, 242, 190, 255), outline=(120, 78, 16, 255), width=5)
    draw_centered(d, (318, 296, 706, 370), title, font(54, True), (37, 55, 58, 255))

    art_box = (226, 410, 798, 960)
    glow = Image.new("RGBA", CARD_SIZE, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow, "RGBA")
    gd.ellipse((200, 350, 824, 1030), fill=palette["glow"] + (54,))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(24)))
    paste_rounded(img, art, art_box, 38)
    d.rounded_rectangle(art_box, radius=38, outline=(255, 238, 152, 235), width=8)

    d.rounded_rectangle((292, 994, 732, 1072), radius=30, fill=(255, 232, 104, 255), outline=(93, 63, 12, 255), width=5)
    draw_centered(d, (292, 994, 732, 1072), "10 קלפי עובדות", font(44, True), (45, 56, 49, 255))
    d.rounded_rectangle((364, 1090, 660, 1148), radius=24, fill=(255, 245, 200, 230), outline=(255, 226, 94, 255), width=4)
    draw_centered(d, (364, 1090, 660, 1148), "עונה 1", font(34, True), (45, 56, 49, 255))

    final = img.resize((512, 716), Image.Resampling.LANCZOS)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    final.save(out_path, "WEBP", quality=96, method=6)
    source_png = out_path.with_name(out_path.stem + "-source.png")
    img.resize((512, 716), Image.Resampling.LANCZOS).save(source_png, "PNG")
    public = PUBLIC_ASSETS / pack["pack_asset_path"]
    public.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(out_path, public)


def make_contact_sheet(pack_id: str, pack: dict) -> None:
    thumbs = []
    for card in pack["cards"]:
        im = Image.open(ROOT / card["asset_path"]).convert("RGBA").resize((154, 215), Image.Resampling.LANCZOS)
        thumbs.append((im, card["title_he"]))
    sheet = Image.new("RGBA", (5 * 188 + 24, 2 * 260 + 88), (4, 25, 45, 255))
    d = ImageDraw.Draw(sheet, "RGBA")
    draw_centered(d, (0, 14, sheet.size[0], 62), f"{TARGET_PACKS[pack_id]} - קלפים חדשים", font(36, True), (255, 224, 91, 255))
    for i, (im, title) in enumerate(thumbs):
        x = 22 + (i % 5) * 188
        y = 78 + (i // 5) * 260
        sheet.alpha_composite(im, (x + 17, y))
        draw_centered(d, (x, y + 220, x + 188, y + 254), title, font(22, True), (232, 248, 255, 255))
    out = ROOT / f"assets/season-1/cards-native-he/{pack_id}-clean-contact-sheet.webp"
    sheet.convert("RGB").save(out, "WEBP", quality=92)


def update_titles(data: dict) -> None:
    for pack in data["packs"]:
        if pack["pack_id"] in TARGET_PACKS:
            pack["pack_title_he"] = TARGET_PACKS[pack["pack_id"]]
            if pack["pack_id"] == "crystals":
                pack["domain_he"] = "קריסטלים ומינרלים"
            if pack["pack_id"] == "security":
                pack["domain_he"] = "ביטחון, הצלה ושירות"


def main() -> None:
    data = json.loads(GAME_DATA_PATHS[0].read_text())
    update_titles(data)

    manifest = {"generated_by": Path(__file__).name, "packs": []}
    for pack in data["packs"]:
        if pack["pack_id"] not in TARGET_PACKS:
            continue
        render_pack(pack["pack_id"], pack)
        for card in pack["cards"]:
            render_card(pack["pack_id"], TARGET_PACKS[pack["pack_id"]], card)
        make_contact_sheet(pack["pack_id"], pack)
        manifest["packs"].append({
            "pack_id": pack["pack_id"],
            "pack_title_he": TARGET_PACKS[pack["pack_id"]],
            "pack_asset_path": pack["pack_asset_path"],
            "card_asset_paths": [card["asset_path"] for card in pack["cards"]],
        })

    for path in GAME_DATA_PATHS:
        target = json.loads(path.read_text())
        update_titles(target)
        if "mvp_rules" in target:
            target["mvp_rules"]["quiz_reward_brain_coins"] = 8
        path.write_text(json.dumps(target, ensure_ascii=False, indent=2) + "\n")

    js_paths = [
        ROOT / "assets/season-1/game-data.js",
        ROOT / "converstion to angular/public/assets/season-1/game-data.js",
    ]
    for js_path in js_paths:
        json_path = js_path.with_suffix(".json")
        js_data = json.loads(json_path.read_text())
        js_path.write_text("window.FACT_COLLECTORS_GAME_DATA = " + json.dumps(js_data, ensure_ascii=False, indent=2) + ";\n")

    manifest_path = ROOT / "assets/season-1/cards-native-he/clean-rendered-manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
