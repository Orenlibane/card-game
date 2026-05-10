import { mkdir, readFile, writeFile } from "node:fs/promises";

const outDir = new URL("../assets/season-1/quizzes/", import.meta.url);
const promptDir = new URL("../assets/season-1/prompts/", import.meta.url);
const cardRoot = "assets/season-1/cards-wave2-he";
const packRoot = "assets/season-1/packs-wave2-he";

const packs = [
  pack("ai", "בינה מלאכותית", "ילדים גדולים", "מחשבים, נתונים וחשיבה", [
    ["algorithm", "אלגוריתם", ["סדרת הוראות לפתרון בעיה", "מחשב מבצע הוראות לפי סדר", "אלגוריתם טוב ברור וניתן לבדיקה"], ["הוראות", "חשיבה"]],
    ["data", "נתונים", ["נתונים הם מידע שאפשר לעבד", "דוגמאות רבות עוזרות ללמוד דפוסים", "חשוב לבדוק שהנתונים איכותיים"], ["מידע", "דפוסים"]],
    ["model-training", "אימון מודל", ["מודל לומד מדוגמאות", "האימון משנה קשרים פנימיים", "בדיקה מגלה אם המודל השתפר"], ["למידה", "בדיקה"]],
    ["neural-network", "רשת עצבית", ["בנויה משכבות של חישובים", "קשרים חזקים משפיעים על התוצאה", "השם שואב השראה מהמוח"], ["שכבות", "חישוב"]],
    ["computer-vision", "ראייה ממוחשבת", ["מחשב מזהה צורות בתמונה", "פיקסלים הופכים לרמזים", "שימושית ברפואה ובבטיחות"], ["תמונות", "זיהוי"]],
    ["language-model", "מודל שפה", ["מזהה קשרים בין מילים", "יכול להציע ניסוח או סיכום", "צריך לבדוק תשובות חשובות"], ["שפה", "בדיקה"]],
    ["learning-robot", "רובוט לומד", ["חיישנים קולטים מידע מהסביבה", "הוראות עוזרות לבחור פעולה", "תרגול משפר ביצוע משימות"], ["חיישנים", "פעולה"]],
    ["bias", "הטיה", ["הטיה נוצרת מנתונים לא מאוזנים", "בדיקות עוזרות למצוא טעויות", "מערכת הוגנת צריכה מגוון דוגמאות"], ["הוגנות", "אחריות"]],
    ["privacy", "פרטיות", ["מידע אישי דורש שמירה", "לא משתפים נתונים רגישים בלי צורך", "כללים טובים מגנים על משתמשים"], ["בטיחות", "מידע"]],
    ["creative-ai", "יצירה חכמה", ["בינה מלאכותית יכולה לעזור ברעיונות", "האדם בוחר ומכוון את התוצאה", "זכויות וקרדיט חשובים ביצירה"], ["יצירה", "אחריות"]],
  ], {
    note_he: "סט חינוכי על בינה מלאכותית, עם דגש על מושגים בסיסיים ואחריות.",
    visual_hint_he: "איורי טכנולוגיה מקוריים: שבבים, רשתות אור, רובוטים ידידותיים, נתונים זוהרים ומעבדות לימוד.",
  }),
  pack("minecraft", "עולם קוביות", "ילדים בינוניים", "בנייה, משאבים וחקר עולם קוביות", [
    ["cube", "קובייה", ["קובייה בנויה משש פאות", "קוביות עוזרות לבנות מרחב", "חיבור קוביות יוצר צורות גדולות"], ["צורות", "בנייה"]],
    ["pickaxe", "מכוש", ["כלי חפירה עוזר לשבור סלעים", "כלים שונים מתאימים לחומרים שונים", "בחירת כלי חוסכת זמן"], ["כלים", "חומרים"]],
    ["shelter", "מחסה ראשון", ["קירות וגג מגנים מרוח וגשם", "תכנון פתח עוזר להיכנס ולצאת", "אור בתוך המחסה מקל להתמצא"], ["תכנון", "בטיחות"]],
    ["cave", "מערה", ["מערות נוצרות בתוך סלעים", "חושך דורש מקור אור", "שכבות סלע רומזות על חומרים"], ["גאולוגיה", "חקר"]],
    ["resources", "משאבים", ["משאב הוא חומר שאפשר להשתמש בו", "איסוף מסודר עוזר לבנות", "לא כל חומר מתאים לכל מטרה"], ["חומרים", "מיון"]],
    ["crafting", "יצירה", ["שילוב חומרים יוצר חפץ חדש", "מתכון הוא סדר פעולות קבוע", "ניסוי מלמד אילו שילובים עובדים"], ["מתכונים", "ניסוי"]],
    ["farm", "חווה", ["צמחים צריכים מים ואור", "חווה מסודרת נותנת מזון לאורך זמן", "טיפול קבוע משפר יבול"], ["טבע", "מזון"]],
    ["biome", "אזור טבע", ["אזור טבע כולל אקלים וצמחים", "מדבר ויער נראים ומתנהגים אחרת", "סביבה משפיעה על החומרים שנמצא"], ["סביבה", "אקלים"]],
    ["map", "מפה", ["מפה עוזרת לזכור מיקום", "סימנים פשוטים מקצרים דרך", "כיוון ומרחק חשובים בניווט"], ["ניווט", "סימנים"]],
    ["circuits", "מעגלי כוח", ["אות יכול להפעיל מנגנון", "מתג משנה מצב פתוח או סגור", "רצף אותות יוצר מכונה פשוטה"], ["הנדסה", "מערכות"]],
  ], {
    note_he: "סט מקורי בהשראת למידה דרך בנייה בקוביות. הנכסים אינם משתמשים בלוגו, שם מותג או דמויות ממשחק קיים.",
    visual_hint_he: "עולם קוביות מקורי: קוביות איזומטריות צבעוניות, כלים גנריים, מערות, מפות, חוות ומנגנונים פשוטים בלי סימני מותג.",
  }),
];

function pack(pack_id, pack_title_he, age_group_he, domain_he, rawCards, extra = {}) {
  return { pack_id, pack_title_he, age_group_he, domain_he, cards: rawCards, ...extra };
}

function rarity(index) {
  if (index === 10) return "legendary";
  if (index % 4 === 0) return "epic";
  if (index % 3 === 0) return "rare";
  return "common";
}

function cardFile(index, slug) {
  return `${String(index).padStart(2, "0")}-${slug}`;
}

function quizzes(title, facts, tags) {
  return {
    junior: {
      age_band_he: "3-5",
      reward_brain_coins: 8,
      question_he: "איזה קלף ראית עכשיו?",
      options_he: [title, "כוכב", "עץ"],
      correct_answer_index: 0,
      source_fact_he: facts[0],
    },
    child: {
      age_band_he: "6-12",
      reward_brain_coins: 15,
      question_he: `מה נכון לגבי ${title}?`,
      options_he: [facts[0], "זהו נושא שאינו קשור לחבילה.", "אין עליו מידע בקלף."],
      correct_answer_index: 0,
      source_fact_he: facts[0],
    },
    advanced: {
      age_band_he: "13+",
      reward_brain_coins: 25,
      question_he: `איזה קשר מתאים לנושא ${title}?`,
      options_he: [`${title} קשור לתג ${tags[0]} ולידע מהחבילה.`, "הנושא תמיד שייך רק לחלל.", "אי אפשר ללמוד עליו מתוך עובדות."],
      correct_answer_index: 0,
      source_fact_he: facts[1],
    },
  };
}

function cardPrompt(packData, card) {
  return `צור תמונת קלף יחידה למשחק "אוספים עובדות". עברית מלאה מימין לשמאל. יחס 512x716, קלף אחד בלבד, לא גיליון. טקסטים: "אוספים עובדות", "עונה 1", "${packData.pack_title_he}", "${card.title_he}", "${card.index}/10", "${card.facts_he[0]}", "${card.facts_he[1]}", "${card.facts_he[2]}". קלף מידע עם עובדות בלבד, ללא שאלה וללא תשובות. סגנון עונה 1: מסגרת זהב מעוטרת, טורקיז, פאנל קלף קרמי, תאורה עשירה ואיור מרכזי מקורי. ${packData.visual_hint_he} אין אנגלית, אין UI, אין watermark, אין מותג קיים.`;
}

function packPrompt(packData) {
  return `צור תמונת חבילת קלפים יחידה למשחק "אוספים עובדות". עברית מלאה מימין לשמאל. יחס 512x716, חבילה אחת בלבד, לא גיליון. טקסטים: "אוספים עובדות", "עונה 1", "${packData.pack_title_he}", "10 קלפי עובדות". עטיפת foil פרימיום מקורית בגודל קלף, קצוות מקומטים, איור מרכזי שמתאים לתחום ${packData.domain_he}. ${packData.visual_hint_he} אין אנגלית, אין מותגים קיימים, אין watermark.`;
}

await mkdir(outDir, { recursive: true });
await mkdir(promptDir, { recursive: true });

const promptPlan = {
  schema_version: 1,
  product_name_he: "אוספים עובדות",
  language: "he",
  text_direction: "rtl",
  final_asset_policy_he: "כל קלף וכל חבילה נוצרים כתמונה עצמאית בפרומפט עצמאי. אין להשתמש בגיליון כנכס מקור.",
  packs: [],
  cards: [],
};

const renderManifest = {
  schema_version: 1,
  product_name_he: "אוספים עובדות",
  language: "he",
  text_direction: "rtl",
  season: 1,
  generation_mode_he: "רינדור PNG/WebP מקומי אחד לכל קלף וחבילה, לפי JSON החבילה.",
  note_he: "סט AI וסט עולם קוביות נוספו כסטים עצמאיים לעונה 1.",
  packs: [],
  cards: [],
  contact_sheets: [],
};

for (const packData of packs) {
  const cards = packData.cards.map(([slug, title_he, facts_he, tags_he], idx) => {
    const index = idx + 1;
    const file = cardFile(index, slug);
    return {
      card_id: `${packData.pack_id}-${file}`,
      index,
      title_he,
      asset_path: `${cardRoot}/${packData.pack_id}/${file}.webp`,
      facts_he,
      tags_he,
      rarity: rarity(index),
      quizzes: quizzes(title_he, facts_he, tags_he),
    };
  });

  const quizJson = {
    schema_version: 1,
    product_name_he: "אוספים עובדות",
    language: "he",
    text_direction: "rtl",
    season: 1,
    pack_id: packData.pack_id,
    pack_title_he: packData.pack_title_he,
    domain_he: packData.domain_he,
    age_group_he: packData.age_group_he,
    pack_asset_path: `${packRoot}/pack-${packData.pack_id}.webp`,
    card_count: cards.length,
    quiz_flow_he: "תמונת הקלף מציגה עובדות בלבד. בלחיצה על קלף נעול האפליקציה פותחת מבחן קצר לפי גיל. תשובה נכונה פותחת את הקלף ומעניקה מטבעות מוח.",
    security_note_he: "בפרודקשן correct_answer_index נשמר בבסיס הנתונים/Edge Function ואינו נשלח ללקוח לפני שליחת תשובה.",
    note_he: packData.note_he,
    cards,
  };

  await writeFile(new URL(`${packData.pack_id}.json`, outDir), JSON.stringify(quizJson, null, 2), "utf8");

  promptPlan.packs.push({
    asset_id: `pack-${packData.pack_id}`,
    output_path: quizJson.pack_asset_path,
    pack_id: packData.pack_id,
    prompt_he: packPrompt(packData),
  });

  renderManifest.packs.push({
    pack_id: packData.pack_id,
    title_he: packData.pack_title_he,
    png: `${packRoot}/pack-${packData.pack_id}.png`,
    webp: quizJson.pack_asset_path,
  });

  for (const card of cards) {
    promptPlan.cards.push({
      asset_id: card.card_id,
      output_path: card.asset_path,
      pack_id: packData.pack_id,
      title_he: card.title_he,
      prompt_he: cardPrompt(packData, card),
    });
    renderManifest.cards.push({
      card_id: card.card_id,
      pack_id: packData.pack_id,
      title_he: card.title_he,
      png: card.asset_path.replace(/\.webp$/, ".png"),
      webp: card.asset_path,
    });
  }
  renderManifest.contact_sheets.push({
    pack_id: packData.pack_id,
    webp: `${cardRoot}/${packData.pack_id}-contact-sheet.webp`,
  });
}

renderManifest.contact_sheets.push({
  pack_id: "ai-minecraft",
  webp: `${cardRoot}/ai-minecraft-20-cards-contact-sheet.webp`,
});

const indexPath = new URL("index.json", outDir);
let index = { schema_version: 1, product_name_he: "אוספים עובדות", language: "he", text_direction: "rtl", season: 1, packs: [] };
try {
  index = JSON.parse(await readFile(indexPath, "utf8"));
} catch {}
const byId = new Map((index.packs || []).map((entry) => [entry.pack_id, entry]));
for (const packData of packs) {
  byId.set(packData.pack_id, {
    pack_id: packData.pack_id,
    pack_title_he: packData.pack_title_he,
    domain_he: packData.domain_he,
    card_count: 10,
    quiz_path: `assets/season-1/quizzes/${packData.pack_id}.json`,
  });
}
index.packs = [...byId.values()];

await writeFile(indexPath, JSON.stringify(index, null, 2), "utf8");
await writeFile(new URL("ai-minecraft-prompts.json", promptDir), JSON.stringify(promptPlan, null, 2), "utf8");
await writeFile(new URL("../cards-wave2-he/manifest-ai-minecraft.json", outDir), JSON.stringify(renderManifest, null, 2), "utf8");

console.log(JSON.stringify({ packs: packs.length, cards: promptPlan.cards.length, images: promptPlan.cards.length + promptPlan.packs.length }, null, 2));
