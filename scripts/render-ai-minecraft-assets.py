from __future__ import annotations

import json
import math
from pathlib import Path

from bidi.algorithm import get_display
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
QUIZ_ROOT = ROOT / "assets/season-1/quizzes"
CARD_ROOT = ROOT / "assets/season-1/cards-wave2-he"
PACK_ROOT = ROOT / "assets/season-1/packs-wave2-he"
MANIFEST_PATH = CARD_ROOT / "manifest-ai-minecraft.json"

FONT_REGULAR = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

W, H = 512, 716


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


def add_noise(img, amount=12):
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for y in range(0, img.height, 7):
        for x in range(0, img.width, 7):
            alpha = int((math.sin(x * 0.17 + y * 0.13) + 1) * amount / 2)
            draw.point((x, y), fill=(255, 255, 255, alpha))
    return Image.alpha_composite(img.convert("RGBA"), overlay)


def fit_text(draw, text, max_width, start_size, bold=True, min_size=15):
    size = start_size
    while size >= min_size:
        fnt = font(size, bold)
        bbox = draw.textbbox((0, 0), rtl(text), font=fnt)
        if bbox[2] - bbox[0] <= max_width:
            return fnt
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


def draw_text_center(draw, xy, text, size, fill, bold=True, stroke=0, stroke_fill=(0, 0, 0)):
    draw.text(xy, rtl(text), font=font(size, bold), fill=fill, anchor="mm", stroke_width=stroke, stroke_fill=stroke_fill)


def draw_cube(draw, cx, cy, size, top, left, right, outline=(56, 50, 62)):
    h = size * 0.56
    top_pts = [(cx, cy - h), (cx + size, cy), (cx, cy + h), (cx - size, cy)]
    left_pts = [(cx - size, cy), (cx, cy + h), (cx, cy + h + size), (cx - size, cy + size)]
    right_pts = [(cx + size, cy), (cx, cy + h), (cx, cy + h + size), (cx + size, cy + size)]
    draw.polygon(left_pts, fill=left)
    draw.polygon(right_pts, fill=right)
    draw.polygon(top_pts, fill=top)
    draw.line(top_pts + [top_pts[0]], fill=outline, width=2)
    draw.line(left_pts + [left_pts[0]], fill=outline, width=2)
    draw.line(right_pts + [right_pts[0]], fill=outline, width=2)


def draw_nodes(draw, nodes, line_color, fill_color):
    for a, b in zip(nodes, nodes[1:]):
        draw.line((a[0], a[1], b[0], b[1]), fill=line_color, width=4)
    for x, y in nodes:
        draw.ellipse((x - 14, y - 14, x + 14, y + 14), fill=fill_color, outline=(255, 236, 166), width=3)


def draw_ai_art(draw, key, accent):
    cx, cy = W // 2, 252
    draw.rounded_rectangle((70, 145, W - 70, 375), 26, fill=(232, 252, 255, 175), outline=(70, 128, 158), width=3)
    for i in range(9):
        x = 92 + i * 38
        draw.line((x, 160, x - 50, 364), fill=(255, 255, 255, 60), width=2)

    if key == "algorithm":
        boxes = [(cx, 182, "1"), (160, 250, "2"), (352, 250, "3"), (cx, 324, "4")]
        for x, y, label in boxes:
            rounded(draw, (x - 44, y - 24, x + 44, y + 24), 12, (*accent, 230), (28, 45, 72), 2)
            draw_text_center(draw, (x, y), label, 24, (255, 255, 255), True)
        draw.line((cx, 206, 160, 226), fill=(28, 45, 72), width=4)
        draw.line((cx, 206, 352, 226), fill=(28, 45, 72), width=4)
        draw.line((160, 274, cx, 300), fill=(28, 45, 72), width=4)
        draw.line((352, 274, cx, 300), fill=(28, 45, 72), width=4)
    elif key == "data":
        colors = [(54, 156, 219), (80, 198, 158), (242, 190, 72)]
        for i in range(4):
            for j, col in enumerate(colors):
                rounded(draw, (132 + i * 64, 176 + j * 48, 182 + i * 64, 214 + j * 48), 8, col, (28, 45, 72), 2)
        draw_text_center(draw, (cx, 334), "101", 42, (25, 58, 89), True)
    elif key == "model-training":
        draw.line((130, 330, 370, 330), fill=(28, 45, 72), width=4)
        draw.line((130, 330, 130, 180), fill=(28, 45, 72), width=4)
        pts = [(132, 315), (180, 292), (225, 274), (270, 234), (322, 210), (370, 185)]
        draw.line(pts, fill=accent, width=8, joint="curve")
        for x, y in pts:
            draw.ellipse((x - 9, y - 9, x + 9, y + 9), fill=(255, 236, 166), outline=(28, 45, 72), width=2)
    elif key == "neural-network":
        layers = [[(150, 190), (150, 252), (150, 314)], [(256, 174), (256, 232), (256, 290), (256, 348)], [(362, 220), (362, 300)]]
        for left, right in zip(layers, layers[1:]):
            for a in left:
                for b in right:
                    draw.line((a[0], a[1], b[0], b[1]), fill=(50, 130, 160, 92), width=2)
        for layer in layers:
            for x, y in layer:
                draw.ellipse((x - 16, y - 16, x + 16, y + 16), fill=accent, outline=(255, 236, 166), width=3)
    elif key == "computer-vision":
        draw.ellipse((126, 190, 386, 326), fill=(247, 255, 255), outline=(28, 45, 72), width=5)
        draw.ellipse((210, 205, 302, 297), fill=accent, outline=(255, 236, 166), width=5)
        draw.ellipse((236, 231, 276, 271), fill=(22, 35, 56))
        for x in [150, 186, 326, 362]:
            draw.line((x, 170, x, 345), fill=(255, 236, 166, 115), width=2)
    elif key == "language-model":
        for x, y, w in [(132, 180, 168), (210, 254, 172), (108, 310, 198)]:
            rounded(draw, (x, y, x + w, y + 48), 18, (255, 255, 255, 230), (28, 45, 72), 3)
        draw_text_center(draw, (216, 204), "אבג", 28, accent, True)
        draw_text_center(draw, (296, 278), "רעיון", 25, accent, True)
        draw_text_center(draw, (207, 334), "סיכום", 25, accent, True)
    elif key == "learning-robot":
        rounded(draw, (174, 190, 338, 318), 34, (238, 248, 255), (28, 45, 72), 4)
        draw.ellipse((202, 230, 236, 264), fill=accent)
        draw.ellipse((276, 230, 310, 264), fill=accent)
        draw.arc((214, 254, 298, 300), 15, 165, fill=(28, 45, 72), width=4)
        draw.line((256, 190, 256, 160), fill=(28, 45, 72), width=4)
        draw.ellipse((244, 146, 268, 170), fill=(255, 236, 166), outline=(28, 45, 72), width=2)
    elif key == "bias":
        draw.line((256, 180, 256, 335), fill=(28, 45, 72), width=5)
        draw.line((160, 220, 352, 220), fill=(28, 45, 72), width=5)
        draw.polygon([(160, 220), (118, 300), (202, 300)], fill=(255, 236, 166), outline=(28, 45, 72))
        draw.polygon([(352, 220), (318, 286), (394, 286)], fill=accent, outline=(28, 45, 72))
        draw.ellipse((230, 328, 282, 356), fill=(28, 45, 72))
    elif key == "privacy":
        draw.rounded_rectangle((184, 230, 328, 330), 18, fill=(255, 255, 255), outline=(28, 45, 72), width=5)
        draw.arc((206, 172, 306, 270), 180, 360, fill=(28, 45, 72), width=12)
        draw.ellipse((240, 268, 272, 300), fill=accent)
        draw.rectangle((252, 292, 260, 318), fill=accent)
    else:
        draw.ellipse((140, 194, 300, 354), fill=(255, 236, 166), outline=(28, 45, 72), width=4)
        draw.line((304, 198, 372, 160), fill=accent, width=10)
        draw.line((306, 234, 390, 226), fill=accent, width=10)
        draw.line((300, 280, 368, 330), fill=accent, width=10)
        for p in [(184, 230), (226, 282), (270, 222)]:
            draw.ellipse((p[0] - 10, p[1] - 10, p[0] + 10, p[1] + 10), fill=accent)


def draw_block_art(draw, key, accent):
    cx, cy = W // 2, 245
    rounded(draw, (70, 145, W - 70, 375), 26, (245, 252, 231, 180), (86, 103, 65), 3)
    ground = [(96, 306), (236, 226), (416, 306), (270, 374)]
    draw.polygon(ground, fill=(120, 173, 90), outline=(68, 87, 54))
    for x in range(130, 390, 45):
        draw.line((x, 288, x + 80, 330), fill=(255, 255, 255, 38), width=2)

    if key == "cube":
        draw_cube(draw, cx, 196, 74, (120, 190, 93), (94, 135, 70), (138, 88, 54))
    elif key == "pickaxe":
        draw.line((210, 180, 318, 328), fill=(126, 82, 48), width=18)
        draw.line((184, 178, 328, 178), fill=(94, 104, 118), width=22)
        draw.line((184, 178, 154, 214), fill=(94, 104, 118), width=18)
        draw.line((328, 178, 358, 214), fill=(94, 104, 118), width=18)
    elif key == "shelter":
        for dx, dy in [(-70, 24), (0, -16), (70, 24), (-5, 64)]:
            draw_cube(draw, cx + dx, cy + dy, 42, (168, 117, 72), (128, 82, 50), (104, 69, 44))
        draw.polygon([(150, 218), (256, 146), (362, 218), (318, 242), (256, 194), (194, 242)], fill=(100, 74, 48), outline=(54, 45, 38))
    elif key == "cave":
        draw.ellipse((134, 166, 380, 350), fill=(92, 87, 93), outline=(54, 54, 62), width=5)
        draw.ellipse((194, 220, 318, 360), fill=(36, 39, 52))
        for x, y in [(150, 200), (350, 218), (180, 324), (330, 310)]:
            draw_cube(draw, x, y, 24, (130, 128, 126), (88, 86, 84), (108, 106, 104))
    elif key == "resources":
        for i, col in enumerate([(144, 93, 58), (138, 142, 148), (232, 186, 80), (104, 170, 190)]):
            draw_cube(draw, 146 + i * 72, 210 + (i % 2) * 38, 32, tuple(min(255, c + 32) for c in col), tuple(max(0, c - 28) for c in col), col)
    elif key == "crafting":
        rounded(draw, (150, 188, 362, 326), 18, (173, 113, 67), (70, 52, 38), 4)
        for x in [220, 292]:
            draw.line((x, 190, x, 324), fill=(94, 62, 40), width=4)
        for y in [234, 280]:
            draw.line((152, y, 360, y), fill=(94, 62, 40), width=4)
        draw_cube(draw, 256, 214, 25, (235, 204, 130), (150, 106, 62), (188, 136, 78))
    elif key == "farm":
        for i in range(5):
            draw.line((130 + i * 54, 325, 176 + i * 36, 240), fill=(92, 60, 39), width=16)
            draw.ellipse((136 + i * 50, 216, 174 + i * 50, 254), fill=(76, 174, 83), outline=(52, 102, 58))
        draw.rectangle((170, 300, 348, 320), fill=(72, 146, 214))
    elif key == "biome":
        draw_cube(draw, 180, 230, 38, (238, 206, 112), (202, 160, 76), (188, 136, 65))
        draw_cube(draw, 256, 202, 38, (78, 166, 94), (64, 122, 72), (98, 143, 78))
        draw_cube(draw, 332, 230, 38, (230, 238, 244), (152, 184, 198), (180, 208, 220))
        draw.ellipse((226, 155, 286, 215), fill=(72, 166, 92), outline=(55, 96, 62))
    elif key == "map":
        draw.polygon([(138, 190), (238, 168), (370, 204), (342, 330), (218, 306), (118, 334)], fill=(244, 230, 172), outline=(91, 73, 50))
        draw.line((162, 300, 214, 250, 274, 268, 330, 218), fill=accent, width=5)
        draw.ellipse((320, 206, 344, 230), fill=(220, 70, 80), outline=(76, 48, 44))
    else:
        for x in [150, 210, 270, 330]:
            draw.ellipse((x - 18, 248 - 18, x + 18, 248 + 18), fill=(232, 70, 68), outline=(64, 45, 45), width=3)
        draw.line((150, 248, 330, 248), fill=(232, 70, 68), width=8)
        rounded(draw, (212, 170, 300, 224), 12, (235, 224, 150), (74, 60, 38), 3)
        draw.line((256, 224, 256, 248), fill=(232, 70, 68), width=8)


def draw_card_frame(draw, pack_title, title, index, accent):
    rounded(draw, (18, 16, W - 18, H - 16), 34, (21, 48, 70), (14, 25, 42), 4)
    rounded(draw, (30, 28, W - 30, H - 28), 28, (246, 200, 78), (114, 75, 26), 4)
    rounded(draw, (44, 42, W - 44, H - 42), 22, (22, 98, 112), (255, 239, 156), 3)

    rounded(draw, (62, 62, W - 62, 118), 18, (241, 222, 174), (116, 77, 29), 3)
    title_font = fit_text(draw, title, 300, 34, True, 22)
    draw.text((W / 2, 91), rtl(title), font=title_font, fill=(18, 36, 59), anchor="mm")

    for x, label in [(92, "עונה 1"), (W - 92, f"{index}/10")]:
        draw.regular_polygon((x, 137, 30), 6, rotation=math.pi / 6, fill=(18, 86, 106), outline=(246, 200, 78), width=3)
        draw_text_center(draw, (x, 137), label, 15, (255, 255, 255), True, 1, (8, 34, 54))

    rounded(draw, (72, 136, W - 72, 386), 25, (236, 250, 252), (40, 56, 83), 3)
    rounded(draw, (66, 394, W - 66, 444), 18, accent, (246, 200, 78), 3)
    pack_font = fit_text(draw, pack_title, 250, 24, True, 16)
    draw.text((W / 2, 419), rtl(pack_title), font=pack_font, fill=(255, 255, 255), anchor="mm", stroke_width=1, stroke_fill=(0, 0, 0))
    rounded(draw, (70, 462, W - 70, 608), 18, (248, 239, 213), (131, 91, 37), 3)
    rounded(draw, (86, 476, W - 86, 594), 14, (255, 248, 229), (209, 181, 119), 1)
    rounded(draw, (110, 626, W - 110, 680), 18, (13, 63, 91), (246, 200, 78), 4)
    draw_text_center(draw, (W / 2, 646), "אוספים", 23, (255, 255, 255), True, 1, (4, 29, 48))
    draw_text_center(draw, (W / 2, 672), "עובדות", 24, (255, 224, 74), True, 1, (4, 29, 48))


def draw_facts(draw, facts, accent):
    fact_font = font(18, True)
    y = 492
    for fact in facts[:3]:
        lines = wrap_he(draw, fact, 310, fact_font)
        draw.ellipse((W - 103, y + 3, W - 89, y + 17), fill=accent, outline=(33, 47, 71), width=1)
        for line in lines[:2]:
            draw.text((W - 112, y), rtl(line), font=fact_font, fill=(22, 33, 54), anchor="ra")
            y += 23
        y += 6


def slug_for(card):
    prefix = f"{card['pack_id'] if 'pack_id' in card else ''}-"
    raw = card["card_id"]
    parts = raw.split("-")
    return "-".join(parts[2:])


def render_card(pack, card):
    card = {**card, "pack_id": pack["pack_id"]}
    pack_id = pack["pack_id"]
    accent = (33, 122, 174) if pack_id == "ai" else (84, 144, 76)
    top = (24, 90, 116) if pack_id == "ai" else (63, 112, 76)
    bottom = (18, 43, 76) if pack_id == "ai" else (45, 65, 58)

    base = gradient((W, H), top, bottom)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-90, 50, 220, 360), fill=(255, 222, 88, 68))
    gd.ellipse((288, 80, 628, 410), fill=(*accent, 58))
    gd.ellipse((108, 320, 438, 690), fill=(255, 255, 255, 28))
    base = Image.alpha_composite(add_noise(base, 12), glow.filter(ImageFilter.GaussianBlur(18)))
    draw = ImageDraw.Draw(base, "RGBA")

    draw_card_frame(draw, pack["pack_title_he"], card["title_he"], card["index"], accent)
    key = slug_for(card)
    if pack_id == "ai":
        draw_ai_art(draw, key, accent)
    else:
        draw_block_art(draw, key, accent)

    rounded(draw, (72, 136, W - 72, 386), 25, None, (40, 56, 83), 3)
    rounded(draw, (62, 62, W - 62, 118), 18, (241, 222, 174), (116, 77, 29), 3)
    title_font = fit_text(draw, card["title_he"], 300, 34, True, 22)
    draw.text((W / 2, 91), rtl(card["title_he"]), font=title_font, fill=(18, 36, 59), anchor="mm")
    rounded(draw, (66, 394, W - 66, 444), 18, accent, (246, 200, 78), 3)
    draw.text((W / 2, 419), rtl(pack["pack_title_he"]), font=fit_text(draw, pack["pack_title_he"], 250, 24, True, 16), fill=(255, 255, 255), anchor="mm", stroke_width=1, stroke_fill=(0, 0, 0))
    draw_facts(draw, card["facts_he"], accent)

    out_path = ROOT / card["asset_path"]
    out_path.parent.mkdir(parents=True, exist_ok=True)
    base.convert("RGB").save(out_path.with_suffix(".png"), quality=96)
    base.convert("RGB").save(out_path, quality=90, method=6)
    return out_path


def draw_pack_art(draw, pack_id, accent):
    if pack_id == "ai":
        draw.rounded_rectangle((108, 250, 404, 410), 34, fill=(232, 252, 255, 210), outline=(255, 230, 120), width=4)
        layers = [[(170, 292), (170, 350)], [(256, 270), (256, 322), (256, 374)], [(342, 306), (342, 356)]]
        for left, right in zip(layers, layers[1:]):
            for a in left:
                for b in right:
                    draw.line((a[0], a[1], b[0], b[1]), fill=(45, 136, 170, 120), width=2)
        for layer in layers:
            for x, y in layer:
                draw.ellipse((x - 15, y - 15, x + 15, y + 15), fill=accent, outline=(255, 236, 166), width=3)
    else:
        for x, y, s, colors in [
            (190, 250, 48, ((132, 194, 92), (93, 132, 68), (132, 88, 54))),
            (270, 214, 48, ((235, 208, 116), (190, 150, 74), (170, 118, 62))),
            (322, 298, 48, ((104, 158, 202), (70, 104, 148), (82, 126, 176))),
            (232, 332, 48, ((170, 116, 72), (128, 82, 50), (104, 69, 44))),
        ]:
            draw_cube(draw, x, y, s, *colors)


def render_pack(pack):
    pack_id = pack["pack_id"]
    accent = (33, 122, 174) if pack_id == "ai" else (84, 144, 76)
    base = gradient((W, H), (22, 84, 113) if pack_id == "ai" else (65, 117, 78), (18, 40, 70) if pack_id == "ai" else (44, 62, 54))
    base = add_noise(base, 20)
    draw = ImageDraw.Draw(base, "RGBA")
    rounded(draw, (38, 22, W - 38, H - 22), 30, (18, 54, 78, 245), (246, 200, 78), 5)
    for y in [50, 666]:
        for x in range(52, W - 52, 24):
            draw.polygon([(x, y), (x + 12, y + (18 if y < H / 2 else -18)), (x + 24, y)], fill=(246, 200, 78, 210), outline=(116, 77, 29))
    rounded(draw, (74, 86, W - 74, 154), 20, (241, 222, 174), (116, 77, 29), 4)
    draw_text_center(draw, (W / 2, 116), "אוספים עובדות", 29, (18, 36, 59), True)
    draw_text_center(draw, (W / 2, 178), "עונה 1", 23, (255, 244, 178), True, 1, (8, 34, 54))
    rounded(draw, (70, 202, W - 70, 474), 30, (255, 255, 255, 70), (246, 200, 78), 4)
    draw_pack_art(draw, pack_id, accent)
    rounded(draw, (82, 492, W - 82, 568), 22, accent, (246, 200, 78), 4)
    title_font = fit_text(draw, pack["pack_title_he"], 310, 34, True, 22)
    draw.text((W / 2, 530), rtl(pack["pack_title_he"]), font=title_font, fill=(255, 255, 255), anchor="mm", stroke_width=1, stroke_fill=(0, 0, 0))
    rounded(draw, (112, 594, W - 112, 640), 18, (241, 222, 174), (116, 77, 29), 3)
    draw_text_center(draw, (W / 2, 617), "10 קלפי עובדות", 24, (18, 36, 59), True)

    out_path = ROOT / pack["pack_asset_path"]
    out_path.parent.mkdir(parents=True, exist_ok=True)
    base.convert("RGB").save(out_path.with_suffix(".png"), quality=96)
    base.convert("RGB").save(out_path, quality=90, method=6)
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
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path, quality=90, method=6)


def main():
    manifest = json.loads(MANIFEST_PATH.read_text("utf-8"))
    rendered_all = []
    for pack_id in ["ai", "minecraft"]:
        pack = json.loads((QUIZ_ROOT / f"{pack_id}.json").read_text("utf-8"))
        render_pack(pack)
        rendered = [render_card(pack, card) for card in pack["cards"]]
        rendered_all.extend(rendered)
        contact_sheet(rendered, CARD_ROOT / f"{pack_id}-contact-sheet.webp", cols=5)
    contact_sheet(rendered_all, CARD_ROOT / "ai-minecraft-20-cards-contact-sheet.webp", cols=5)
    manifest["status_he"] = "נוצרו נכסי PNG/WebP עצמאיים לכל קלף וחבילה."
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), "utf-8")


if __name__ == "__main__":
    main()
