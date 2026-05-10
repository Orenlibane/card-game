import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const generated = "/Users/orentzezana/.codex/generated_images/019e0cc2-2e6e-7a30-ae21-954032721624";

const mapping = [
  ["colors", "01-red", `${generated}/ig_0693f615c95f808d016a001374f91c8191844b5c8d06d9ea01.png`],
  ["colors", "02-blue", `${generated}/ig_0693f615c95f808d016a0018f5ebd481919ca6f7605876c9ce.png`],
  ["colors", "03-yellow", `${generated}/ig_0693f615c95f808d016a00193ec8688191b931cb4013907f76.png`],
  ["colors", "04-green", `${generated}/ig_0693f615c95f808d016a0019831b94819196355f981c0ecf64.png`],
  ["colors", "05-orange", `${generated}/ig_0693f615c95f808d016a0019ce56888191b376c591f33ff301.png`],
  ["colors", "06-purple", `${generated}/ig_0693f615c95f808d016a001a2392348191898869a18dff20e4.png`],
  ["colors", "07-pink", `${generated}/ig_0693f615c95f808d016a001a730b3c81919f5ae723c5bf74ae.png`],
  ["colors", "08-brown", `${generated}/ig_0693f615c95f808d016a001ac1b2608191a8b79606cf673e0b.png`],
  ["colors", "09-black-white", `${generated}/ig_0693f615c95f808d016a001b2140e081919041f94f70531397.png`],
  ["colors", "10-rainbow", `${generated}/ig_0693f615c95f808d016a001b74384c8191af1e15065495ce6a.png`],
  ["shapes", "01-circle", `${generated}/ig_0693f615c95f808d016a001bc19e948191bbc6b34e1e40cdf2.png`],
  ["shapes", "02-square", `${generated}/ig_0693f615c95f808d016a001ccef0408191835e7547e378eccb.png`],
  ["shapes", "03-triangle", `${generated}/ig_0693f615c95f808d016a001d1f90a88191a4ec84fab2f248d9.png`],
  ["shapes", "04-rectangle", `${generated}/ig_0693f615c95f808d016a001d73d4f081918c2300b4bacdc33d.png`],
  ["shapes", "05-star", `${generated}/ig_0693f615c95f808d016a001e4368e0819189f2d18b9beb3fcf.png`],
  ["shapes", "06-heart", `${generated}/ig_0693f615c95f808d016a001e9a00588191a0bcf6bec858dd67.png`],
  ["shapes", "07-diamond", `${generated}/ig_0693f615c95f808d016a001eeef7e08191bae90a026f6f65b9.png`],
  ["shapes", "08-oval", `${generated}/ig_0693f615c95f808d016a001f453f2c81918809fa76da37e78c.png`],
  ["shapes", "09-hexagon", `${generated}/ig_0693f615c95f808d016a001fa04ecc81919f979039a327f104.png`],
  ["shapes", "10-spiral", `${generated}/ig_0693f615c95f808d016a001ff5e3988191a41d9e6190ac8401.png`],
];

await mkdir("assets/season-1/cards-wave2-he/ai-sources", { recursive: true });

const py = `
from PIL import Image, ImageOps
from pathlib import Path
import json, math, sys, shutil
mapping = json.loads(sys.stdin.read())
for pack, name, src in mapping:
    src_path = Path(src)
    out_base = Path("assets/season-1/cards-wave2-he") / pack / name
    out_base.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src_path, Path("assets/season-1/cards-wave2-he/ai-sources") / f"{pack}-{name}.png")
    img = Image.open(src_path).convert("RGB")
    # Preserve the full generated card and pad to the exact in-game card size.
    final = ImageOps.pad(img, (512, 716), method=Image.Resampling.LANCZOS, color=(246, 241, 232), centering=(0.5, 0.5))
    final.save(out_base.with_suffix(".png"), quality=96)
    final.save(out_base.with_suffix(".webp"), quality=90, method=6)

def contact(paths, out, cols=5):
    thumb_w, thumb_h, pad = 184, 258, 18
    rows = math.ceil(len(paths) / cols)
    sheet = Image.new("RGB", (cols * thumb_w + (cols + 1) * pad, rows * thumb_h + (rows + 1) * pad), (246, 241, 232))
    for i, p in enumerate(paths):
        im = Image.open(p).convert("RGB")
        im = ImageOps.pad(im, (thumb_w, thumb_h), method=Image.Resampling.LANCZOS, color=(246, 241, 232))
        x = pad + (i % cols) * (thumb_w + pad)
        y = pad + (i // cols) * (thumb_h + pad)
        sheet.paste(im, (x, y))
    sheet.save(out, quality=90, method=6)

colors = [Path("assets/season-1/cards-wave2-he/colors") / f"{name}.webp" for pack, name, src in mapping if pack == "colors"]
shapes = [Path("assets/season-1/cards-wave2-he/shapes") / f"{name}.webp" for pack, name, src in mapping if pack == "shapes"]
contact(colors, "assets/season-1/cards-wave2-he/colors-contact-sheet.webp")
contact(shapes, "assets/season-1/cards-wave2-he/shapes-contact-sheet.webp")
contact(colors + shapes, "assets/season-1/cards-wave2-he/colors-shapes-split-20-contact-sheet.webp")
`;

const result = spawnSync("tmp/imagegen-venv/bin/python", ["-c", py], {
  input: JSON.stringify(mapping),
  encoding: "utf8",
});
if (result.status !== 0) {
  console.error(result.stderr);
  process.exit(result.status ?? 1);
}

await writeFile("assets/season-1/cards-wave2-he/ai-sources/import-map-colors-shapes.json", JSON.stringify({
  schema_version: 1,
  product_name_he: "אוספים עובדות",
  season: 1,
  note_he: "מקורות AI premium לקלפי צבעים וצורות. כל מקור נוצר כתמונה עצמאית ולא כגיליון.",
  mapping: mapping.map(([pack_id, file, source_path]) => ({
    pack_id,
    output_path: `assets/season-1/cards-wave2-he/${pack_id}/${file}.webp`,
    source_path,
  })),
}, null, 2), "utf8");
