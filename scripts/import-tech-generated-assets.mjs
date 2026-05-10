import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const generated = "/Users/orentzezana/.codex/generated_images/019e0cc2-2e6e-7a30-ae21-954032721624";

const mapping = [
  ["pack", "angular", "pack-angular", `${generated}/ig_0693f615c95f808d016a00295d3bec8191b1d4571490235f40.png`],
  ["pack", "codex", "pack-codex", `${generated}/ig_0693f615c95f808d016a002a2bdd148191be43fb01f2cd6394.png`],
  ["pack", "kiro", "pack-kiro", `${generated}/ig_0693f615c95f808d016a002a9624ec819191350456aaf900e7.png`],
  ["card", "angular", "01-components", `${generated}/ig_0693f615c95f808d016a002af975f4819182763cd5d0e1d9b6.png`],
  ["card", "angular", "02-templates", `${generated}/ig_0693f615c95f808d016a002b6215bc8191918af2743136b387.png`],
  ["card", "angular", "03-signals", `${generated}/ig_0693f615c95f808d016a002bd7d7f88191a3b8ad87f70e466b.png`],
  ["card", "angular", "04-dependency-injection", `${generated}/ig_0693f615c95f808d016a002cdf435481919b86b736e8e8d62a.png`],
  ["card", "angular", "05-services", `${generated}/ig_0693f615c95f808d016a002d4a34c48191bd73ce519b4de738.png`],
  ["card", "angular", "06-routing", `${generated}/ig_0693f615c95f808d016a002db6382c8191a0a22ffceb46ab98.png`],
  ["card", "angular", "07-forms", `${generated}/ig_0693f615c95f808d016a002f47e0a481918e25c306f9e8d5bc.png`],
  ["card", "angular", "08-http-client", `${generated}/ig_0693f615c95f808d016a002faf04688191be24b4abb3ccb388.png`],
  ["card", "angular", "09-cli", `${generated}/ig_0693f615c95f808d016a003014a70c8191be96a5b3dcabb37d.png`],
  ["card", "angular", "10-hydration", `${generated}/ig_0693f615c95f808d016a0031a64e50819183ca89235bdc795f.png`],
  ["card", "codex", "01-coding-agent", `${generated}/ig_0693f615c95f808d016a0036dc88dc81919ae8e729d54d2cd9.png`],
  ["card", "codex", "02-workspace", `${generated}/ig_0693f615c95f808d016a0037414bc88191a91b015ef1d0253a.png`],
  ["card", "codex", "03-tasks", `${generated}/ig_0693f615c95f808d016a0037c564408191a8fa99cf34d2e9d3.png`],
  ["card", "codex", "04-skills", `${generated}/ig_0693f615c95f808d016a0038346ea48191958982c13f92f61c.png`],
  ["card", "codex", "05-sandbox", `${generated}/ig_0693f615c95f808d016a0039b43350819196ab89a5d297aa8a.png`],
  ["card", "codex", "06-code-review", `${generated}/ig_0693f615c95f808d016a003bb55adc8191bf2a61b19a5e3ffb.png`],
  ["card", "codex", "07-parallel-agents", `${generated}/ig_0693f615c95f808d016a003c1fab10819191d56cc5d6906765.png`],
  ["card", "codex", "08-cli", `${generated}/ig_0693f615c95f808d016a003e747d188191828b9622a556ce34.png`],
  ["card", "codex", "09-automations", `${generated}/ig_0693f615c95f808d016a003ee664c48191bf6667a5931948a4.png`],
  ["card", "codex", "10-pull-requests", `${generated}/ig_0693f615c95f808d016a003f6004348191afb199b726757047.png`],
];

const py = `
from PIL import Image, ImageOps
from pathlib import Path
import json, shutil, math, sys
mapping = json.loads(sys.stdin.read())
for kind, pack, name, src in mapping:
    src_path = Path(src)
    if kind == "pack":
        out_base = Path("assets/season-1/packs-tech-he") / name
        source_dir = Path("assets/season-1/packs-tech-he/sources")
    else:
        out_base = Path("assets/season-1/cards-tech-he") / pack / name
        source_dir = Path("assets/season-1/cards-tech-he") / pack / "sources"
    out_base.parent.mkdir(parents=True, exist_ok=True)
    source_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src_path, source_dir / f"{name}.png")
    img = Image.open(src_path).convert("RGB")
    final = ImageOps.pad(img, (512, 716), method=Image.Resampling.LANCZOS, color=(246,241,232), centering=(0.5,0.5))
    final.save(out_base.with_suffix(".png"), quality=96)
    final.save(out_base.with_suffix(".webp"), quality=91, method=6)

def contact(paths, out, cols=5):
    thumb_w, thumb_h, pad = 184, 258, 18
    rows = math.ceil(len(paths) / cols)
    sheet = Image.new("RGB", (cols*thumb_w+(cols+1)*pad, rows*thumb_h+(rows+1)*pad), (246,241,232))
    for i,p in enumerate(paths):
        im = Image.open(p).convert("RGB")
        im = ImageOps.pad(im, (thumb_w, thumb_h), method=Image.Resampling.LANCZOS, color=(246,241,232))
        x = pad + (i % cols) * (thumb_w + pad)
        y = pad + (i // cols) * (thumb_h + pad)
        sheet.paste(im, (x,y))
    sheet.save(out, quality=90, method=6)

angular = [Path("assets/season-1/cards-tech-he/angular") / f"{name}.webp" for kind, pack, name, src in mapping if kind == "card" and pack == "angular"]
codex = [Path("assets/season-1/cards-tech-he/codex") / f"{name}.webp" for kind, pack, name, src in mapping if kind == "card" and pack == "codex"]
packs = [Path("assets/season-1/packs-tech-he") / f"{name}.webp" for kind, pack, name, src in mapping if kind == "pack"]
contact(angular, "assets/season-1/cards-tech-he/angular-contact-sheet.webp")
contact(codex, "assets/season-1/cards-tech-he/codex-contact-sheet.webp")
contact(packs, "assets/season-1/packs-tech-he/tech-packs-contact-sheet.webp", cols=3)
`;

const result = spawnSync("tmp/imagegen-venv/bin/python", ["-c", py], { input: JSON.stringify(mapping), encoding: "utf8" });
if (result.status !== 0) {
  console.error(result.stderr);
  process.exit(result.status ?? 1);
}

await mkdir("assets/season-1/cards-tech-he", { recursive: true });

const manifestPath = "assets/season-1/cards-tech-he/tech-assets-manifest.json";
let manifest = {
  schema_version: 1,
  product_name_he: "אוספים עובדות",
  season: 1,
  status_he: "בתהליך",
  note_he: "נכסי טכנולוגיה שנוצרו בעזרת skill fact-collectors-card-pack-assets. כל תמונה נוצרה בנפרד.",
  packs: [],
  cards: [],
};
try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch {}

const sourceEntries = mapping.map(([kind, pack_id, file, source_path]) => ({
  kind,
  pack_id,
  output_path: kind === "pack" ? `assets/season-1/packs-tech-he/${file}.webp` : `assets/season-1/cards-tech-he/${pack_id}/${file}.webp`,
  source_path,
}));

const packMap = new Map((manifest.packs || []).map((entry) => [entry.output_path, entry]));
const cardMap = new Map((manifest.cards || []).map((entry) => [entry.output_path, entry]));
for (const entry of sourceEntries) {
  if (entry.kind === "pack") packMap.set(entry.output_path, entry);
  else cardMap.set(entry.output_path, entry);
}
manifest.packs = Array.from(packMap.values());
manifest.cards = Array.from(cardMap.values());
await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
