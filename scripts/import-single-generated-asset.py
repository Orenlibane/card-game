from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "assets/season-1/cards-wave2-he/manifest-ai-minecraft.json"


def latest_generated(folder: Path) -> Path:
    files = [path for path in folder.glob("*.png") if path.is_file()]
    if not files:
        raise SystemExit(f"No generated PNG files found in {folder}")
    return max(files, key=lambda path: path.stat().st_mtime)


def resize_to_card(src: Path, png_path: Path, webp_path: Path) -> None:
    png_path.parent.mkdir(parents=True, exist_ok=True)
    webp_path.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as image:
        image = image.convert("RGB")
        image = image.resize((512, 716), Image.Resampling.LANCZOS)
        image.save(png_path, quality=96)
        image.save(webp_path, quality=90, method=6)


def update_quiz_json(pack_id: str, card_id: str, generated_src: Path, png_path: Path, webp_path: Path) -> None:
    quiz_path = ROOT / f"assets/season-1/quizzes/{pack_id}.json"
    data = json.loads(quiz_path.read_text("utf-8"))
    now = datetime.now(timezone.utc).isoformat()
    for card in data.get("cards", []):
        if card.get("card_id") == card_id:
            card["asset_path"] = str(webp_path.relative_to(ROOT))
            card["image_generation"] = {
                "mode": "single_image_tool_call",
                "status_he": "נוצר כתמונה יחידה ונבדק לפני מעבר לקלף הבא",
                "source_png": str(generated_src),
                "project_png": str(png_path.relative_to(ROOT)),
                "project_webp": str(webp_path.relative_to(ROOT)),
                "updated_at": now,
            }
            break
    else:
        raise SystemExit(f"Card not found in {quiz_path}: {card_id}")
    quiz_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), "utf-8")


def update_manifest(card_id: str, generated_src: Path, png_path: Path, webp_path: Path) -> None:
    manifest = json.loads(MANIFEST_PATH.read_text("utf-8"))
    manifest["generation_mode_he"] = "נכסי production נוצרים אחד־אחד בכלי image generation, עם בדיקה וייבוא אחרי כל תמונה."
    manifest["status_he"] = "בתהליך החלפה לנכסי image generation אחד־אחד."
    now = datetime.now(timezone.utc).isoformat()
    for card in manifest.get("cards", []):
        if card.get("card_id") == card_id:
            card["png"] = str(png_path.relative_to(ROOT))
            card["webp"] = str(webp_path.relative_to(ROOT))
            card["source_png"] = str(generated_src)
            card["generation_status_he"] = "נוצר ויובא מתמונה יחידה"
            card["updated_at"] = now
            break
    else:
        raise SystemExit(f"Card not found in manifest: {card_id}")
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), "utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pack-id", required=True)
    parser.add_argument("--card-id", required=True)
    parser.add_argument("--png", required=True)
    parser.add_argument("--webp", required=True)
    parser.add_argument("--source")
    parser.add_argument("--generated-dir", default="/Users/orentzezana/.codex/generated_images/019e109f-62cb-7853-8526-06c16cf351bd")
    args = parser.parse_args()

    source = Path(args.source) if args.source else latest_generated(Path(args.generated_dir))
    if not source.exists():
        raise SystemExit(f"Generated source does not exist: {source}")
    png_path = ROOT / args.png
    webp_path = ROOT / args.webp
    resize_to_card(source, png_path, webp_path)
    update_quiz_json(args.pack_id, args.card_id, source, png_path, webp_path)
    update_manifest(args.card_id, source, png_path, webp_path)
    print(json.dumps({
        "card_id": args.card_id,
        "source": str(source),
        "png": str(png_path.relative_to(ROOT)),
        "webp": str(webp_path.relative_to(ROOT)),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
