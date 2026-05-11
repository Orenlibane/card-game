from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path

from bidi.algorithm import get_display
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
PACK_IDS = ["dinosaurs", "world-history", "kiro"]
W, H = 1024, 1432
FINAL = (512, 716)

GOLD = (212, 160, 64)
DARK_GOLD = (132, 91, 35)
TEAL = (28, 151, 155)
DEEP_TEAL = (13, 77, 92)
CREAM = (247, 235, 203)
PARCHMENT = (255, 247, 221)
INK = (49, 34, 30)

FONT_REG = "/System/Library/Fonts/SFHebrew.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)


def rtl(text: str) -> str:
    return get_display(str(text))


KIRO_TEXT_REPLACEMENTS = {
    "Kiro": "קירו",
    "Spec Driven": "מונחה מפרט",
    "EARS": "תבנית דרישה",
    "Steering": "הכוונה",
    "Hook": "וו פעולה",
    "Hooks": "ווי פעולה",
    "workflow": "זרימת עבודה",
    "IDE CLI Web": "סביבות עבודה",
    "IDE, CLI וממשק Web": "עורך, שורת פקודה וממשק רשת",
    "IDE": "עורך קוד",
    "CLI": "שורת פקודה",
    "Web": "רשת",
}


def display_text(pack_id: str, text: str) -> str:
    if pack_id != "kiro":
        return text
    out = text
    for source, target in KIRO_TEXT_REPLACEMENTS.items():
        out = out.replace(source, target)
    return out


def display_pack_title(pack: dict) -> str:
    return display_text(pack["pack_id"], pack["pack_title_he"])


def display_card_title(pack_id: str, card: dict) -> str:
    return display_text(pack_id, card["title_he"])


def text_size(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont) -> tuple[int, int]:
    box = draw.textbbox((0, 0), rtl(text), font=fnt)
    return box[2] - box[0], box[3] - box[1]


def draw_center(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    fnt: ImageFont.FreeTypeFont,
    fill=INK,
    stroke_fill=None,
    stroke_width=0,
) -> None:
    x, y = xy
    shaped = rtl(text)
    box = draw.textbbox((0, 0), shaped, font=fnt, stroke_width=stroke_width)
    draw.text(
        (x - (box[2] - box[0]) / 2, y - (box[3] - box[1]) / 2),
        shaped,
        font=fnt,
        fill=fill,
        stroke_fill=stroke_fill,
        stroke_width=stroke_width,
    )


def draw_right(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    fnt: ImageFont.FreeTypeFont,
    fill=INK,
) -> None:
    x, y = xy
    shaped = rtl(text)
    box = draw.textbbox((0, 0), shaped, font=fnt)
    draw.text((x - (box[2] - box[0]), y), shaped, font=fnt, fill=fill)


def wrap_text(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    line = ""
    for word in words:
        candidate = word if not line else f"{line} {word}"
        if text_size(draw, candidate, fnt)[0] <= max_width:
            line = candidate
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def rounded(draw: ImageDraw.ImageDraw, box, radius, fill, outline=None, width=1) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def vertical_gradient(top, bottom) -> Image.Image:
    img = Image.new("RGB", (W, H), top)
    pix = img.load()
    for y in range(H):
        t = y / (H - 1)
        c = tuple(round(top[i] * (1 - t) + bottom[i] * t) for i in range(3))
        for x in range(W):
            pix[x, y] = c
    return img


def foil_overlay(img: Image.Image, tint=(255, 255, 255), alpha=34) -> None:
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    for i in range(-H, W, 62):
        d.line([(i, H), (i + H, 0)], fill=(*tint, alpha), width=16)
    for x in range(90, W, 170):
        for y in range(140, H, 230):
            d.ellipse((x, y, x + 8, y + 8), fill=(255, 244, 189, 120))
    img.alpha_composite(overlay)


def subject_colors(pack_id: str) -> tuple[tuple[int, int, int], tuple[int, int, int]]:
    if pack_id == "dinosaurs":
        return (54, 129, 82), (217, 154, 80)
    if pack_id == "world-history":
        return (128, 76, 51), (44, 116, 145)
    return (74, 93, 205), (49, 188, 177)


def art_background(pack_id: str) -> Image.Image:
    top, bottom = subject_colors(pack_id)
    img = Image.new("RGBA", (760, 510), (*top, 255))
    d = ImageDraw.Draw(img)
    for y in range(510):
        t = y / 509
        c = tuple(round(top[i] * (1 - t) + bottom[i] * t) for i in range(3))
        d.line((0, y, 760, y), fill=(*c, 255))
    for i in range(0, 760, 90):
        d.ellipse((i - 80, 360 + (i % 3) * 20, i + 240, 580), fill=(255, 255, 255, 24))
    return img


def dinosaur_art(d: ImageDraw.ImageDraw, title: str) -> None:
    body = (92, 151, 83)
    dark = (35, 84, 56)
    if "טריצרטופס" in title:
        d.ellipse((230, 245, 545, 390), fill=body, outline=dark, width=7)
        d.polygon([(520, 235), (690, 260), (570, 360)], fill=(120, 180, 98), outline=dark)
        for p in [(625, 245), (690, 205), (660, 278), (706, 270), (650, 304), (615, 305)]:
            pass
        d.polygon([(625, 245), (705, 205), (660, 290)], fill=(236, 218, 144), outline=dark)
        d.polygon([(660, 270), (740, 245), (690, 318)], fill=(236, 218, 144), outline=dark)
        d.polygon([(580, 275), (625, 210), (625, 292)], fill=(236, 218, 144), outline=dark)
    elif "סטגוזאורוס" in title:
        d.ellipse((210, 265, 600, 395), fill=body, outline=dark, width=7)
        for x in range(260, 565, 62):
            d.polygon([(x, 265), (x + 28, 185), (x + 58, 270)], fill=(214, 121, 72), outline=dark)
        d.line((200, 340, 100, 300), fill=dark, width=20)
        d.line((590, 330, 710, 290), fill=dark, width=18)
    elif "פטרנודון" in title:
        d.polygon([(370, 245), (105, 360), (330, 345), (380, 395), (430, 345), (660, 360)], fill=(87, 139, 124), outline=dark)
        d.ellipse((330, 260, 445, 360), fill=body, outline=dark, width=6)
        d.polygon([(410, 260), (560, 225), (450, 300)], fill=(236, 218, 144), outline=dark)
    elif "מאובן" in title:
        d.rounded_rectangle((195, 170, 590, 410), radius=70, fill=(190, 155, 105), outline=(91, 63, 45), width=8)
        for r in range(80, 250, 34):
            d.arc((250 - r // 2, 220 - r // 3, 560 + r // 3, 420 + r // 4), 190, 360, fill=(245, 229, 171), width=12)
        d.ellipse((365, 255, 405, 292), fill=(245, 229, 171))
    else:
        d.ellipse((205, 250, 555, 395), fill=body, outline=dark, width=7)
        d.ellipse((505, 185, 680, 310), fill=body, outline=dark, width=7)
        d.polygon([(660, 246), (745, 270), (665, 292)], fill=(238, 211, 140), outline=dark)
        d.line((215, 335, 95, 280), fill=dark, width=24)
        for x in (285, 410):
            d.line((x, 380, x - 32, 455), fill=dark, width=20)
    d.ellipse((620, 235, 640, 255), fill=(10, 25, 22))
    d.arc((560, 245, 665, 330), 30, 110, fill=(255, 246, 218), width=4)


def history_art(d: ImageDraw.ImageDraw, title: str) -> None:
    line = (80, 49, 40)
    gold = (218, 178, 96)
    if "מצרים" in title:
        d.polygon([(140, 430), (340, 155), (540, 430)], fill=(215, 170, 93), outline=line)
        d.polygon([(420, 430), (585, 210), (720, 430)], fill=(183, 132, 73), outline=line)
        d.ellipse((555, 95, 640, 180), fill=(247, 208, 95))
    elif "יוון" in title or "רומא" in title:
        d.rectangle((180, 360, 620, 410), fill=(236, 226, 195), outline=line, width=5)
        d.rectangle((210, 170, 590, 220), fill=(236, 226, 195), outline=line, width=5)
        for x in range(235, 570, 70):
            d.rectangle((x, 220, x + 35, 360), fill=(245, 238, 215), outline=line, width=4)
        d.polygon([(180, 170), (400, 75), (620, 170)], fill=gold, outline=line)
    elif "ימי" in title:
        d.rectangle((225, 180, 595, 430), fill=(122, 130, 136), outline=line, width=5)
        for x in range(225, 595, 74):
            d.rectangle((x, 135, x + 42, 190), fill=(122, 130, 136), outline=line, width=4)
        d.polygon([(380, 430), (440, 430), (440, 315), (380, 315)], fill=(65, 49, 44))
    elif "משי" in title:
        d.line((105, 380, 700, 185), fill=(234, 196, 98), width=26)
        for x, y in [(170, 355), (330, 285), (490, 240), (640, 190)]:
            d.ellipse((x - 36, y - 36, x + 36, y + 36), fill=(78, 129, 150), outline=line, width=5)
    elif "דפוס" in title:
        d.rounded_rectangle((185, 155, 610, 390), radius=32, fill=(97, 78, 66), outline=line, width=6)
        d.rectangle((245, 215, 550, 335), fill=(250, 240, 209), outline=line, width=5)
        for y in (245, 280, 315):
            d.line((285, y, 510, y), fill=line, width=6)
    elif "אמריקה" in title:
        d.polygon([(210, 390), (300, 150), (390, 390)], fill=(238, 232, 211), outline=line)
        d.rectangle((292, 150, 312, 430), fill=line)
        d.arc((360, 235, 650, 485), 190, 350, fill=(46, 112, 150), width=24)
    elif "תעשייתית" in title:
        for x in (185, 310, 435):
            d.rectangle((x, 230, x + 72, 430), fill=(96, 91, 86), outline=line, width=5)
            d.rectangle((x + 18, 125, x + 54, 230), fill=(96, 91, 86), outline=line, width=5)
        d.arc((500, 95, 700, 250), 185, 310, fill=(235, 235, 224), width=25)
    elif "זכויות" in title:
        d.ellipse((250, 150, 550, 450), fill=(238, 213, 143), outline=line, width=6)
        d.line((400, 190, 400, 380), fill=line, width=10)
        d.line((295, 260, 505, 260), fill=line, width=10)
        d.polygon([(330, 265), (280, 350), (380, 350)], fill=(82, 142, 151), outline=line)
        d.polygon([(470, 265), (420, 350), (520, 350)], fill=(82, 142, 151), outline=line)
    else:
        d.rounded_rectangle((195, 165, 605, 405), radius=42, fill=(50, 73, 100), outline=line, width=6)
        d.rectangle((250, 220, 550, 350), fill=(128, 205, 205), outline=line, width=5)
        for x in range(285, 535, 55):
            d.rectangle((x, 375, x + 34, 405), fill=(238, 228, 185), outline=line, width=3)


def kiro_art(d: ImageDraw.ImageDraw, title: str) -> None:
    blue = (58, 87, 201)
    cyan = (58, 198, 184)
    dark = (29, 40, 84)
    d.rounded_rectangle((155, 135, 645, 420), radius=42, fill=(31, 39, 68), outline=cyan, width=8)
    d.rectangle((205, 190, 595, 345), fill=(236, 245, 238), outline=dark, width=4)
    for i, y in enumerate([225, 265, 305]):
        d.rounded_rectangle((245, y, 545, y + 20), radius=10, fill=blue if i == 0 else cyan)
    if "דרישה" in title:
        d.polygon([(250, 270), (320, 190), (390, 270)], fill=GOLD, outline=dark)
        d.polygon([(410, 270), (480, 190), (550, 270)], fill=GOLD, outline=dark)
    elif "פעולה" in title:
        d.arc((320, 210, 520, 410), 280, 95, fill=GOLD, width=32)
    elif "סביבות" in title:
        d.rectangle((275, 225, 530, 340), fill=(230, 244, 239), outline=dark, width=5)
        d.line((315, 260, 470, 260), fill=blue, width=10)
        d.line((315, 300, 500, 300), fill=cyan, width=10)
    elif "אימות" in title:
        d.line((300, 290, 370, 360, 520, 215), fill=(68, 169, 90), width=28)
    else:
        for x, y in [(285, 190), (480, 205), (350, 350), (535, 330)]:
            d.ellipse((x - 28, y - 28, x + 28, y + 28), fill=cyan, outline=dark, width=5)
        d.line((285, 190, 480, 205, 350, 350, 535, 330), fill=GOLD, width=10)


def draw_subject(draw: ImageDraw.ImageDraw, pack_id: str, title: str) -> None:
    if pack_id == "dinosaurs":
        dinosaur_art(draw, title)
    elif pack_id == "world-history":
        history_art(draw, title)
    else:
        kiro_art(draw, display_text(pack_id, title))


def make_card(pack: dict, card: dict) -> Image.Image:
    pack_title = display_pack_title(pack)
    card_title = display_card_title(pack["pack_id"], card)
    img = vertical_gradient((31, 105, 116), (118, 77, 45)).convert("RGBA")
    foil_overlay(img, alpha=25)
    d = ImageDraw.Draw(img)
    rounded(d, (38, 38, W - 38, H - 38), 72, (84, 53, 38), (68, 39, 28), 8)
    rounded(d, (64, 64, W - 64, H - 64), 58, GOLD, DARK_GOLD, 9)
    rounded(d, (96, 102, W - 96, H - 102), 44, DEEP_TEAL, (176, 233, 224), 6)
    rounded(d, (126, 132, W - 126, H - 132), 34, CREAM, DARK_GOLD, 4)

    rounded(d, (150, 166, 336, 224), 24, (231, 186, 82), DARK_GOLD, 4)
    draw_center(d, (243, 194), "עונה 1", font(34, True), fill=(64, 42, 24))
    rounded(d, (W - 390, 166, W - 150, 224), 24, (231, 186, 82), DARK_GOLD, 4)
    draw_center(d, (W - 270, 194), pack_title, font(30, True), fill=(64, 42, 24))
    draw_center(d, (W // 2, 265), "אוספים עובדות", font(72, True), fill=(255, 237, 165), stroke_fill=(83, 46, 21), stroke_width=4)

    rounded(d, (174, 315, W - 174, 405), 30, PARCHMENT, DARK_GOLD, 5)
    draw_center(d, (W // 2, 359), card_title, font(56, True), fill=(65, 42, 27))

    art = art_background(pack["pack_id"])
    ad = ImageDraw.Draw(art)
    draw_subject(ad, pack["pack_id"], card_title)
    rounded(d, (150, 435, W - 150, 885), 34, (26, 93, 102), DARK_GOLD, 6)
    img.alpha_composite(art, (132, 410))
    rounded(d, (150, 435, W - 150, 885), 34, None, (255, 232, 153), 6)

    bar_y = 930
    for i, raw_fact in enumerate(card["facts_he"][:3]):
        fact = display_text(pack["pack_id"], raw_fact)
        y = bar_y + i * 110
        rounded(d, (156, y, W - 156, y + 78), 24, PARCHMENT, DARK_GOLD, 4)
        d.ellipse((W - 230, y + 14, W - 178, y + 66), fill=GOLD, outline=DARK_GOLD, width=3)
        draw_center(d, (W - 204, y + 39), str(i + 1), font(28, True), fill=(77, 47, 25))
        lines = wrap_text(d, fact, font(31, True), 530)
        ty = y + 18 if len(lines) == 1 else y + 8
        for line in lines[:2]:
            draw_right(d, (W - 260, ty), line, font(31, True), fill=INK)
            ty += 32
        draw_center(d, (178, y + 39), "✦", font(34, True), fill=GOLD)

    rounded(d, (W // 2 - 92, H - 190, W // 2 + 92, H - 126), 24, GOLD, DARK_GOLD, 4)
    draw_center(d, (W // 2, H - 158), f"{card['index']}/10", font(34, True), fill=(68, 41, 22))
    return img.convert("RGB")


def make_pack(pack: dict) -> Image.Image:
    pack_title = display_pack_title(pack)
    top, bottom = subject_colors(pack["pack_id"])
    img = vertical_gradient(tuple(max(0, c - 35) for c in top), tuple(min(255, c + 35) for c in bottom)).convert("RGBA")
    foil_overlay(img, alpha=46)
    d = ImageDraw.Draw(img)
    wrapper = (126, 88, W - 126, H - 88)
    rounded(d, wrapper, 68, (*top, 255), DARK_GOLD, 8)
    for y in [105, 137, H - 138, H - 106]:
        d.line((150, y, W - 150, y), fill=(255, 235, 166, 190), width=8)
    for x in range(160, W - 160, 50):
        d.polygon([(x, 90), (x + 24, 130), (x + 48, 90)], fill=(226, 184, 91), outline=DARK_GOLD)
        d.polygon([(x, H - 90), (x + 24, H - 130), (x + 48, H - 90)], fill=(226, 184, 91), outline=DARK_GOLD)

    rounded(d, (185, 170, W - 185, 252), 30, PARCHMENT, DARK_GOLD, 5)
    draw_center(d, (W // 2, 210), "אוספים עובדות", font(62, True), fill=(76, 44, 26))
    rounded(d, (252, 292, W - 252, 358), 28, GOLD, DARK_GOLD, 4)
    draw_center(d, (W // 2, 325), "עונה 1", font(34, True), fill=(73, 45, 24))
    draw_center(d, (W // 2, 445), pack_title, font(82, True), fill=(255, 241, 173), stroke_fill=(62, 39, 25), stroke_width=4)

    art = art_background(pack["pack_id"])
    ad = ImageDraw.Draw(art)
    draw_subject(ad, pack["pack_id"], pack_title)
    mask = Image.new("L", art.size, 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((0, 0, art.size[0], art.size[1]), radius=56, fill=230)
    img.alpha_composite(art, (132, 520))
    rounded(d, (132, 520, 892, 1030), 56, None, (255, 232, 153), 7)

    rounded(d, (248, 1110, W - 248, 1190), 30, PARCHMENT, DARK_GOLD, 5)
    draw_center(d, (W // 2, 1149), "10 קלפי עובדות", font(44, True), fill=(58, 39, 26))
    draw_center(d, (W // 2, 1268), "פתחו, אספו, למדו", font(42, True), fill=(255, 240, 175), stroke_fill=(72, 43, 25), stroke_width=3)
    return img.convert("RGB")


def save_asset(img: Image.Image, webp_rel: str) -> tuple[str, str]:
    webp = ROOT / webp_rel
    png = webp.with_suffix(".png")
    png.parent.mkdir(parents=True, exist_ok=True)
    final = ImageOps.fit(img, FINAL, method=Image.Resampling.LANCZOS)
    final.save(png, quality=96)
    final.save(webp, quality=91, method=6)
    return str(png.relative_to(ROOT)), str(webp.relative_to(ROOT))


def contact_sheet(paths: list[Path], out: Path, cols: int = 5) -> None:
    thumb = (184, 258)
    pad = 18
    rows = math.ceil(len(paths) / cols)
    sheet = Image.new("RGB", (cols * thumb[0] + (cols + 1) * pad, rows * thumb[1] + (rows + 1) * pad), (246, 241, 232))
    for i, path in enumerate(paths):
        im = Image.open(path).convert("RGB")
        im = ImageOps.pad(im, thumb, method=Image.Resampling.LANCZOS, color=(246, 241, 232))
        x = pad + (i % cols) * (thumb[0] + pad)
        y = pad + (i // cols) * (thumb[1] + pad)
        sheet.paste(im, (x, y))
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out, quality=91, method=6)


def update_quiz_metadata(pack: dict, pack_png: str | None, pack_webp: str | None, cards: list[dict]) -> None:
    now = datetime.now(timezone.utc).isoformat()
    if pack_png and pack_webp:
        pack["image_generation"] = {
            "mode": "local_pillow_render",
            "status_he": "נוצר מקומית כנכס PNG/WebP ביחס קלף, עקב מפתח Image API לא תקין",
            "project_png": pack_png,
            "project_webp": pack_webp,
            "updated_at": now,
        }
    card_meta = {entry["card_id"]: entry for entry in cards}
    for card in pack.get("cards", []):
        if card["card_id"] not in card_meta:
            continue
        entry = card_meta[card["card_id"]]
        card["image_generation"] = {
            "mode": "local_pillow_render",
            "status_he": "נוצר מקומית כנכס PNG/WebP ביחס קלף, עקב מפתח Image API לא תקין",
            "project_png": entry["png"],
            "project_webp": entry["webp"],
            "updated_at": now,
        }


def main() -> None:
    manifest = {
        "schema_version": 1,
        "product_name_he": "אוספים עובדות",
        "language": "he",
        "text_direction": "rtl",
        "season": 1,
        "status_he": "נכסים חסרים שנוצרו מקומית לאחר כשל אימות מול Image API",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "packs": [],
        "cards": [],
    }

    all_contact_paths: list[Path] = []
    for pack_id in PACK_IDS:
        quiz_path = ROOT / f"assets/season-1/quizzes/{pack_id}.json"
        pack = json.loads(quiz_path.read_text("utf-8"))
        pack_png = pack_webp = None

        pack_path = ROOT / pack["pack_asset_path"]
        pack_png, pack_webp = save_asset(make_pack(pack), pack["pack_asset_path"])
        manifest["packs"].append({"pack_id": pack_id, "title_he": display_pack_title(pack), "png": pack_png, "webp": pack_webp})

        rendered_cards = []
        for card in pack.get("cards", []):
            png, webp = save_asset(make_card(pack, card), card["asset_path"])
            rendered_cards.append({"pack_id": pack_id, "card_id": card["card_id"], "title_he": card["title_he"], "png": png, "webp": webp})
            manifest["cards"].append(rendered_cards[-1])

        update_quiz_metadata(pack, pack_png, pack_webp, rendered_cards)
        quiz_path.write_text(json.dumps(pack, ensure_ascii=False, indent=2) + "\n", "utf-8")

        contact_paths = [ROOT / entry["webp"] for entry in rendered_cards]
        all_contact_paths.extend(contact_paths)
        out_dir = ROOT / ("assets/season-1/cards-tech-he" if pack_id == "kiro" else "assets/season-1/cards-wave2-he")
        contact_sheet(contact_paths, out_dir / f"{pack_id}-contact-sheet.webp")

    manifest_path = ROOT / "assets/season-1/missing-pack-assets-manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", "utf-8")
    contact_sheet(all_contact_paths, ROOT / "assets/season-1/missing-pack-assets-contact-sheet.webp", cols=6)
    print(json.dumps({"packs": len(manifest["packs"]), "cards": len(manifest["cards"]), "manifest": str(manifest_path.relative_to(ROOT))}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
