import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const quizIndexPath = new URL("assets/season-1/quizzes/index.json", root);
const questionDir = new URL("assets/season-1/card-questions/", root);
const outPath = new URL("assets/season-1/game-data.json", root);
const outJsPath = new URL("assets/season-1/game-data.js", root);

async function fileExists(relativePath) {
  try {
    await access(new URL(relativePath, root));
    return true;
  } catch {
    return false;
  }
}

function quizTiersForCard(card) {
  return Object.keys(card.quizzes || {}).filter((tier) => {
    const quiz = card.quizzes[tier];
    return quiz?.question_he && Array.isArray(quiz.options_he) && Number.isInteger(quiz.correct_answer_index);
  });
}

function normalizeQuestion(question) {
  if (
    !question ||
    typeof question.question !== "string" ||
    !Array.isArray(question.options) ||
    question.options.length < 3 ||
    !Number.isInteger(question.correct_index) ||
    question.correct_index < 0 ||
    question.correct_index >= question.options.length
  ) {
    return null;
  }

  return {
    question: question.question,
    options: question.options.map(String),
    correct_index: question.correct_index,
  };
}

async function loadCustomQuestions() {
  const questionMap = new Map();
  let files = [];

  try {
    files = (await readdir(questionDir)).filter((file) => file.endsWith(".json")).sort();
  } catch {
    return questionMap;
  }

  for (const file of files) {
    const entries = JSON.parse(await readFile(new URL(file, questionDir), "utf8"));
    if (!Array.isArray(entries)) continue;

    entries.forEach((entry) => {
      if (!entry?.card_id || !Array.isArray(entry.questions)) return;
      const questions = entry.questions.map(normalizeQuestion).filter(Boolean);
      if (questions.length) questionMap.set(entry.card_id, questions);
    });
  }

  return questionMap;
}

async function build() {
  const index = JSON.parse(await readFile(quizIndexPath, "utf8"));
  const customQuestions = await loadCustomQuestions();
  const included = [];
  const excluded = [];

  for (const entry of index.packs || []) {
    const pack = JSON.parse(await readFile(new URL(entry.quiz_path, root), "utf8"));
    const packAssetExists = await fileExists(pack.pack_asset_path);
    const cards = [];
    const missingAssets = [];
    const invalidQuizzes = [];

    for (const card of pack.cards || []) {
      const hasAsset = await fileExists(card.asset_path);
      const tiers = quizTiersForCard(card);
      if (!hasAsset) missingAssets.push(card.card_id);
      if (!tiers.length) invalidQuizzes.push(card.card_id);
      if (hasAsset && tiers.length) {
        cards.push({
          card_id: card.card_id,
          index: card.index,
          title_he: card.title_he,
          asset_path: card.asset_path,
          facts_he: card.facts_he || [],
          tags_he: card.tags_he || [],
          rarity: card.rarity || "common",
          quizzes: card.quizzes,
          mvp_questions: customQuestions.get(card.card_id) || [],
        });
      }
    }

    if (!packAssetExists || cards.length !== 10) {
      excluded.push({
        pack_id: pack.pack_id,
        pack_title_he: pack.pack_title_he,
        reason_he: !packAssetExists ? "חסרה תמונת חבילה" : "חסרים קלפים שמישים",
        usable_cards: cards.length,
        missing_assets: missingAssets,
        invalid_quizzes: invalidQuizzes,
      });
      continue;
    }

    included.push({
      pack_id: pack.pack_id,
      pack_title_he: pack.pack_title_he,
      domain_he: pack.domain_he,
      age_group_he: pack.age_group_he || "",
      pack_asset_path: pack.pack_asset_path,
      card_count: cards.length,
      cards,
    });
  }

  const data = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    product_name_he: "אוספים עובדות",
    language: "he",
    text_direction: "rtl",
    season: 1,
    mvp_rules: {
      pack_size: 3,
      quiz_questions_per_card: 10,
      pass_score: 8,
      retry_cooldown_hours: 24,
      starter_coins: 120,
      pack_cost: 20,
      duplicate_reward_coins: 5,
      quiz_reward_brain_coins: 25,
    },
    packs: included,
    excluded_packs: excluded,
  };

  await mkdir(new URL("assets/season-1/", root), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await writeFile(outJsPath, `window.MVP_GAME_DATA = ${JSON.stringify(data, null, 2)};\n`, "utf8");
  console.log(JSON.stringify({ packs: included.length, cards: included.length * 10, excluded: excluded.length, custom_question_cards: customQuestions.size }, null, 2));
}

await build();
