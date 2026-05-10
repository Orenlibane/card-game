import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const indexPath = new URL("assets/season-1/quizzes/index.json", root);
const outPath = new URL("assets/season-1/quizzes/binder-quiz-data.js", root);

const index = JSON.parse(await readFile(indexPath, "utf8"));
const data = {};

for (const entry of index.packs || []) {
  const pack = JSON.parse(await readFile(new URL(entry.quiz_path, root), "utf8"));
  for (const card of pack.cards || []) {
    data[card.card_id] = {
      card_id: card.card_id,
      pack_id: pack.pack_id,
      pack_title_he: pack.pack_title_he,
      title_he: card.title_he,
      facts_he: card.facts_he,
      quizzes: card.quizzes,
    };
  }
}

await writeFile(outPath, `window.BINDER_QUIZ_DATA = ${JSON.stringify(data, null, 2)};\n`, "utf8");
console.log(JSON.stringify({ cards: Object.keys(data).length }, null, 2));
