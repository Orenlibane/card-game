import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const quizzesDir = new URL("assets/season-1/quizzes/", root);
const cardQuestionsDir = new URL("assets/season-1/card-questions/", root);

const tierTemplates = {
  junior: {
    age_band_he: "3-5",
    reward_brain_coins: 8,
    factIndex: 0,
    question: (title) => `מה נכון לפי הקלף על ${title}?`,
  },
  child: {
    age_band_he: "6-12",
    reward_brain_coins: 15,
    factIndex: 1,
    question: (title) => `איזו מסקנה מדויקת על ${title} עולה מהקלף?`,
  },
  advanced: {
    age_band_he: "13+",
    reward_brain_coins: 25,
    factIndex: 2,
    question: (title) => `איזה נימוק חזק במיוחד כשמסבירים את ${title}?`,
  },
};

function stripPeriod(text) {
  return String(text || "")
    .trim()
    .replace(/[.?!]+$/u, "");
}

function normalizedFacts(card) {
  const facts = (card.facts_he || []).map(stripPeriod).filter(Boolean);
  while (facts.length < 3) {
    facts.push(`הקלף מציג עובדה מדויקת על ${card.title_he}`);
  }
  return facts.slice(0, 3);
}

function normalizedTags(card, pack) {
  const tags = (card.tags_he || []).map(stripPeriod).filter(Boolean);
  while (tags.length < 2) tags.push(pack.domain_he || pack.pack_title_he || "הנושא");
  return tags.slice(0, 2);
}

function subjectStatement(title, text) {
  return `על ${title}: ${stripPeriod(text)}.`;
}

function applyFirstReplacement(text, replacements) {
  for (const [pattern, replacement] of replacements) {
    if (pattern.test(text)) return text.replace(pattern, replacement);
  }
  return text;
}

function contradictFact(fact, title) {
  const clean = stripPeriod(fact);
  let changed = applyFirstReplacement(clean, [
    [/(^|\s)יש(?=\s)/u, "$1אין"],
    [/(^|\s)יכול(?=\s)/u, "$1לא יכול"],
    [/(^|\s)יכולה(?=\s)/u, "$1לא יכולה"],
    [/(^|\s)יכולים(?=\s)/u, "$1לא יכולים"],
    [/(^|\s)יכולות(?=\s)/u, "$1לא יכולות"],
    [/עוזר(?=\s|$)/u, "לא עוזר"],
    [/עוזרת(?=\s|$)/u, "לא עוזרת"],
    [/עוזרים(?=\s|$)/u, "לא עוזרים"],
    [/עוזרות(?=\s|$)/u, "לא עוזרות"],
    [/משמש(?=\s|$)/u, "אינו משמש"],
    [/משמשת(?=\s|$)/u, "אינה משמשת"],
    [/משמשים(?=\s|$)/u, "אינם משמשים"],
    [/משמשות(?=\s|$)/u, "אינן משמשות"],
    [/נוצר(?=\s|$)/u, "אינו נוצר"],
    [/נוצרת(?=\s|$)/u, "אינה נוצרת"],
    [/נוצרים(?=\s|$)/u, "אינם נוצרים"],
    [/נוצרות(?=\s|$)/u, "אינן נוצרות"],
    [/נמצא(?=\s|$)/u, "אינו נמצא"],
    [/נמצאת(?=\s|$)/u, "אינה נמצאת"],
    [/נמצאים(?=\s|$)/u, "אינם נמצאים"],
    [/נמצאות(?=\s|$)/u, "אינן נמצאות"],
    [/מכיל(?=\s|$)/u, "אינו מכיל"],
    [/מכילה(?=\s|$)/u, "אינה מכילה"],
    [/מכילים(?=\s|$)/u, "אינם מכילים"],
    [/מכילות(?=\s|$)/u, "אינן מכילות"],
    [/עשוי(?=\s|$)/u, "אינו עשוי"],
    [/עשויה(?=\s|$)/u, "אינה עשויה"],
    [/עשויים(?=\s|$)/u, "אינם עשויים"],
    [/עשויות(?=\s|$)/u, "אינן עשויות"],
    [/מתאים(?=\s|$)/u, "אינו מתאים"],
    [/מתאימה(?=\s|$)/u, "אינה מתאימה"],
    [/מתאימים(?=\s|$)/u, "אינם מתאימים"],
    [/מתאימות(?=\s|$)/u, "אינן מתאימות"],
    [/חשוב(?=\s|$)/u, "אינו חשוב"],
    [/חשובה(?=\s|$)/u, "אינה חשובה"],
    [/חשובים(?=\s|$)/u, "אינם חשובים"],
    [/חשובות(?=\s|$)/u, "אינן חשובות"],
    [/נפוץ(?=\s|$)/u, "נדיר מאוד"],
    [/נפוצה(?=\s|$)/u, "נדירה מאוד"],
    [/נפוצים(?=\s|$)/u, "נדירים מאוד"],
    [/נפוצות(?=\s|$)/u, "נדירות מאוד"],
    [/גדול(?=\s|$)/u, "קטן"],
    [/גדולה(?=\s|$)/u, "קטנה"],
    [/גדולים(?=\s|$)/u, "קטנים"],
    [/גדולות(?=\s|$)/u, "קטנות"],
    [/ארוך(?=\s|$)/u, "קצר"],
    [/ארוכה(?=\s|$)/u, "קצרה"],
    [/ארוכים(?=\s|$)/u, "קצרים"],
    [/ארוכות(?=\s|$)/u, "קצרות"],
    [/חזק(?=\s|$)/u, "חלש"],
    [/חזקה(?=\s|$)/u, "חלשה"],
    [/חזקים(?=\s|$)/u, "חלשים"],
    [/חזקות(?=\s|$)/u, "חלשות"],
    [/מהיר(?=\s|$)/u, "איטי"],
    [/מהירה(?=\s|$)/u, "איטית"],
    [/מהירים(?=\s|$)/u, "איטיים"],
    [/מהירות(?=\s|$)/u, "איטיות"],
    [/בטוח(?=\s|$)/u, "מסוכן"],
    [/בטוחה(?=\s|$)/u, "מסוכנת"],
    [/בטוחים(?=\s|$)/u, "מסוכנים"],
    [/בטוחות(?=\s|$)/u, "מסוכנות"],
    [/מדויק(?=\s|$)/u, "לא מדויק"],
    [/מדויקת(?=\s|$)/u, "לא מדויקת"],
    [/מדויקים(?=\s|$)/u, "לא מדויקים"],
    [/מדויקות(?=\s|$)/u, "לא מדויקות"],
  ]);

  if (changed === clean) changed = `לא נכון ש${clean}`;
  return subjectStatement(title, changed);
}

function uniqueOptions(options) {
  const seen = new Set();
  return options.filter((option) => {
    const key = option.replace(/\s+/g, " ").trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fallbackWrongOptions(title, tags) {
  return [
    subjectStatement(title, `אין קשר בין ${title} לבין ${tags[0]}`),
    subjectStatement(title, `אפשר להסביר את ${title} גם אם מתעלמים מעובדות הקלף`),
    subjectStatement(title, `כל טענה על ${title} נכונה גם כשהיא סותרת את הקלף`),
  ];
}

function placeOptions(correct, wrongOptions, seed, title, tags) {
  const wrong = uniqueOptions([...wrongOptions, ...fallbackWrongOptions(title, tags)]).filter((option) => option !== correct);
  const correctIndex = seed % 3;
  const options = [];
  for (let index = 0; index < 3; index += 1) {
    options.push(index === correctIndex ? correct : wrong.shift());
  }
  return { options, correct_index: correctIndex };
}

function question(question, correct, wrongOptions, seed, title, tags) {
  return {
    question,
    ...placeOptions(correct, wrongOptions, seed, title, tags),
  };
}

function makeTierQuizzes(pack, card) {
  const title = card.title_he;
  const facts = normalizedFacts(card);
  const tags = normalizedTags(card, pack);
  const quizzes = {};

  for (const [tier, template] of Object.entries(tierTemplates)) {
    const factIndex = template.factIndex;
    const correct = subjectStatement(title, facts[factIndex]);
    const wrongOptions = [
      contradictFact(facts[(factIndex + 1) % 3], title),
      contradictFact(facts[(factIndex + 2) % 3], title),
    ];
    const placed = placeOptions(correct, wrongOptions, card.index + factIndex, title, tags);
    quizzes[tier] = {
      age_band_he: template.age_band_he,
      reward_brain_coins: template.reward_brain_coins,
      question_he: template.question(title),
      options_he: placed.options,
      correct_answer_index: placed.correct_index,
      source_fact_he: facts[factIndex],
    };
  }

  return quizzes;
}

function makeMvpQuestions(pack, card) {
  const title = card.title_he;
  const facts = normalizedFacts(card);
  const tags = normalizedTags(card, pack);
  const trueFact = (index) => subjectStatement(title, facts[index % 3]);
  const falseFact = (index) => contradictFact(facts[index % 3], title);
  const combineTrue = (a, b) => subjectStatement(title, `${facts[a % 3]}; בנוסף, ${facts[b % 3]}`);
  const combineFalse = (a, b) => subjectStatement(title, `${stripPeriod(contradictFact(facts[a % 3], title).replace(`על ${title}: `, ""))}; וגם ${stripPeriod(contradictFact(facts[b % 3], title).replace(`על ${title}: `, ""))}`);

  return [
    question(
      `מה נכון לפי הקלף על ${title}?`,
      trueFact(0),
      [falseFact(1), falseFact(2)],
      card.index,
      title,
      tags,
    ),
    question(
      `איזה פרט מתוך הקלף מתאר את ${title} באופן מדויק?`,
      trueFact(1),
      [falseFact(0), falseFact(2)],
      card.index + 1,
      title,
      tags,
    ),
    question(
      `מה כדאי לזכור כשמסבירים את ${title} למישהו אחר?`,
      trueFact(2),
      [falseFact(0), falseFact(1)],
      card.index + 2,
      title,
      tags,
    ),
    question(
      `איזה הסבר מחבר בין שתי עובדות על ${title}?`,
      combineTrue(0, 1),
      [combineFalse(0, 2), combineFalse(1, 2)],
      card.index + 3,
      title,
      tags,
    ),
    question(
      `איזו מסקנה זהירה אפשר להסיק מהקלף ${title}?`,
      subjectStatement(title, `הקלף נותן עובדות שאפשר להשתמש בהן כדי להבין את ${tags[0]}`),
      [
        subjectStatement(title, `אין צורך בעובדות כדי להסיק מסקנה על ${title}`),
        subjectStatement(title, `המסקנה על ${title} צריכה לסתור את העובדות בקלף`),
      ],
      card.index + 4,
      title,
      tags,
    ),
    question(
      `איזו תשובה נשארת נאמנה לעובדות של ${title}?`,
      combineTrue(1, 2),
      [falseFact(0), combineFalse(0, 1)],
      card.index + 5,
      title,
      tags,
    ),
    question(
      `כשרוצים להשוות את ${title} לנושאים אחרים, מה חייבים לשמור מדויק?`,
      trueFact(0),
      [falseFact(1), falseFact(2)],
      card.index + 6,
      title,
      tags,
    ),
    question(
      `איזה נימוק מתאים לשאלה למה ${title} חשוב בחבילה הזאת?`,
      subjectStatement(title, `${facts[1]} לכן כדאי לקרוא את העובדות ולא לנחש`),
      [
        subjectStatement(title, `הקלף לא נותן שום פרט שיכול לעזור להבין את ${title}`),
        subjectStatement(title, `הדרך הטובה להבין את ${title} היא להתעלם מ${tags[0]}`),
      ],
      card.index + 7,
      title,
      tags,
    ),
    question(
      `מה תהיה שאלת המשך טובה אחרי שלומדים את ${title}?`,
      `איך ${title} קשור ל${tags[0]} לפי העובדה: ${facts[0]}?`,
      [
        `האם אפשר להבין את ${title} בלי להתייחס לאף עובדה מהקלף?`,
        `האם כל טענה על ${title} נכונה גם כשהיא סותרת את הקלף?`,
      ],
      card.index + 8,
      title,
      tags,
    ),
    question(
      `באיזה כיוון ידע כדאי להעמיק אחרי הקלף ${title}?`,
      `הקשר בין ${title} לבין ${tags[0]} ו${tags[1]}.`,
      [
        `הטענה שאין קשר בין ${title} לבין ${tags[0]}.`,
        `הדרך לנחש על ${title} בלי להשתמש בעובדות הקלף.`,
      ],
      card.index + 9,
      title,
      tags,
    ),
  ];
}

async function loadQuizPacks() {
  const files = (await readdir(quizzesDir)).filter((file) => file.endsWith(".json") && file !== "index.json").sort();
  const packs = [];
  for (const file of files) {
    const path = new URL(file, quizzesDir);
    const pack = JSON.parse(await readFile(path, "utf8"));
    if (pack && Array.isArray(pack.cards) && pack.pack_id) packs.push({ file, path, pack });
  }
  return packs;
}

async function main() {
  await mkdir(cardQuestionsDir, { recursive: true });
  const packs = await loadQuizPacks();
  let cards = 0;
  let mvpQuestions = 0;
  let tierQuestions = 0;

  for (const item of packs) {
    const { pack } = item;
    const cardQuestions = [];

    for (const card of pack.cards) {
      card.quizzes = makeTierQuizzes(pack, card);
      const questions = makeMvpQuestions(pack, card);
      cardQuestions.push({ card_id: card.card_id, questions });
      cards += 1;
      mvpQuestions += questions.length;
      tierQuestions += Object.keys(card.quizzes).length;
    }

    await writeFile(item.path, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
    await writeFile(new URL(`${pack.pack_id}.json`, cardQuestionsDir), `${JSON.stringify(cardQuestions, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify({ packs: packs.length, cards, mvpQuestions, tierQuestions }, null, 2));
}

await main();
