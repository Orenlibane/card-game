import { mkdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const outDir = new URL("../assets/season-1/finalized/", import.meta.url);
await mkdir(outDir, { recursive: true });

const packIds = ["colors", "shapes"];

const finalized = {
  schema_version: 1,
  product_name_he: "אוספים עובדות",
  language: "he",
  text_direction: "rtl",
  season: 1,
  status_he: "סגור",
  image_policy_he: "כל קלף וכל חבילה הם קובץ תמונה סופי. HTML/CSS משמשים להצגה ואנימציה בלבד ואינם מקור הנכס.",
  packs: [],
};

for (const packId of packIds) {
  const quizPath = new URL(`../assets/season-1/quizzes/${packId}.json`, import.meta.url);
  const quiz = JSON.parse(await readFile(quizPath, "utf8"));
  finalized.packs.push({
    pack_id: packId,
    pack_title_he: quiz.pack_title_he,
    domain_he: quiz.domain_he,
    status_he: "סגור",
    pack_asset_path: quiz.pack_asset_path,
    quiz_path: `assets/season-1/quizzes/${packId}.json`,
    contact_sheet_path: `assets/season-1/cards-wave2-he/${packId}-contact-sheet.webp`,
    card_count: quiz.cards.length,
    cards: quiz.cards.map((card) => ({
      card_id: card.card_id,
      index: card.index,
      title_he: card.title_he,
      asset_path: card.asset_path,
      quiz_tiers: Object.keys(card.quizzes),
    })),
  });
}

await writeFile(new URL("colors-shapes-closed.json", outDir), JSON.stringify(finalized, null, 2), "utf8");
