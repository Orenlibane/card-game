import { mkdir, readFile, writeFile } from "node:fs/promises";

const outDir = new URL("../assets/season-1/quizzes/", import.meta.url);
const promptDir = new URL("../assets/season-1/prompts/", import.meta.url);
await mkdir(outDir, { recursive: true });
await mkdir(promptDir, { recursive: true });

const packs = [
  {
    pack_id: "colors",
    pack_title_he: "צבעים",
    domain_he: "זיהוי צבעים, גוונים ודוגמאות מהעולם",
    age_group_he: "ילדים קטנים",
    visual_theme_he: "מניפת צבעים, טיפות צבע נקיות, אור שמח ורקע משחקי",
    cards: [
      ["red", "אדום", ["אדום הוא צבע בולט וחם", "אפשר למצוא אדום בתות, עגבנייה ורמזור", "צבע אדום מושך תשומת לב במהירות"], ["צבעים", "זיהוי"]],
      ["blue", "כחול", ["כחול מזכיר שמיים וים", "כחול יכול להרגיש רגוע וקריר", "אפשר למצוא כחול בצעצועים, בגדים ושלטים"], ["צבעים", "סביבה"]],
      ["yellow", "צהוב", ["צהוב הוא צבע בהיר ושמח", "השמש מצוירת לעיתים בצהוב", "צהוב עוזר לראות דברים גם מרחוק"], ["צבעים", "אור"]],
      ["green", "ירוק", ["ירוק מזכיר עלים וצמחים", "ירוק ברמזור אומר שאפשר להתקדם", "בטבע יש הרבה גוונים של ירוק"], ["צבעים", "טבע"]],
      ["orange", "כתום", ["כתום נמצא בתפוז, גזר ודלעת", "כתום הוא צבע חם ובולט", "כתום נוצר מערבוב אדום וצהוב"], ["צבעים", "ערבוב"]],
      ["purple", "סגול", ["סגול הוא צבע מיוחד ובולט", "אפשר לראות סגול בענבים ובפרחים", "סגול נוצר מערבוב כחול ואדום"], ["צבעים", "ערבוב"]],
      ["pink", "ורוד", ["ורוד הוא צבע רך ובהיר", "אפשר לראות ורוד בפרחים ובצעצועים", "ורוד הוא גוון בהיר של אדום"], ["צבעים", "גוונים"]],
      ["brown", "חום", ["חום מזכיר אדמה, עץ ושוקולד", "בטבע יש הרבה גווני חום", "חום עוזר לזהות חומרים טבעיים"], ["צבעים", "חומרים"]],
      ["black-white", "שחור ולבן", ["שחור ולבן יוצרים ניגוד חזק", "לבן מחזיר הרבה אור", "שחור נראה כהה מאוד ליד צבעים בהירים"], ["צבעים", "ניגוד"]],
      ["rainbow", "קשת צבעים", ["קשת מציגה כמה צבעים יחד", "צבעים עוזרים למיין ולזכור", "אור ומים יכולים ליצור קשת בשמיים"], ["צבעים", "אור"]],
    ],
  },
  {
    pack_id: "shapes",
    pack_title_he: "צורות",
    domain_he: "זיהוי צורות, פינות, קווים ודגמים",
    age_group_he: "ילדים קטנים",
    visual_theme_he: "צורות גיאומטריות גדולות, קוביות משחק, מדבקות וחומר פלסטיק עדין",
    cards: [
      ["circle", "עיגול", ["לעיגול אין פינות", "עיגול יכול להתגלגל בקלות", "גלגל, כדור וצלחת דומים לעיגול"], ["צורות", "עגול"]],
      ["square", "ריבוע", ["לריבוע ארבע צלעות שוות", "לריבוע יש ארבע פינות", "אריחים וחלונות יכולים להיות ריבועים"], ["צורות", "פינות"]],
      ["triangle", "משולש", ["למשולש שלוש צלעות", "למשולש יש שלוש פינות", "משולשים מופיעים בתמרורים ובגגות"], ["צורות", "זיהוי"]],
      ["rectangle", "מלבן", ["למלבן ארבע צלעות", "שתי צלעות ארוכות ושתי צלעות קצרות", "דלת, ספר ומסך יכולים להיות מלבנים"], ["צורות", "אורך"]],
      ["star", "כוכב", ["כוכב מצויר עם קודקודים", "כוכב משמש כסמל להצלחה", "דפוס כוכבים קל לזהות בתמונה"], ["צורות", "סמלים"]],
      ["heart", "לב", ["צורת לב מסמלת אהבה וחברות", "לב מצויר אינו נראה כמו לב אמיתי", "סמלים עוזרים להעביר רעיון"], ["צורות", "סמלים"]],
      ["diamond", "מעוין", ["מעוין נראה כמו יהלום מצויר", "למעוין ארבע צלעות", "אפשר למצוא מעוין בדוגמאות וקישוטים"], ["צורות", "דגמים"]],
      ["oval", "אליפסה", ["אליפסה דומה לעיגול מתוח", "ביצה ומראה יכולות להיראות כמו אליפסה", "לאליפסה אין פינות"], ["צורות", "עגול"]],
      ["hexagon", "משושה", ["למשושה שש צלעות", "תאי כוורת נראים כמו משושים", "משושים מתחברים יפה זה לזה"], ["צורות", "דפוסים"]],
      ["spiral", "ספירלה", ["ספירלה מסתובבת סביב המרכז", "אפשר לראות ספירלות בקונכיות ובציורים", "ספירלה יוצרת תחושת תנועה"], ["צורות", "תנועה"]],
    ],
  },
];

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
      options_he: [title, "כוכב", "אוטובוס"],
      correct_answer_index: 0,
      source_fact_he: facts[0],
    },
    child: {
      age_band_he: "6-12",
      reward_brain_coins: 15,
      question_he: `מה נכון לגבי ${title}?`,
      options_he: [facts[0], "זהו נושא מחבילת חיות.", "אין עליו מידע בקלף."],
      correct_answer_index: 0,
      source_fact_he: facts[0],
    },
    advanced: {
      age_band_he: "13+",
      reward_brain_coins: 25,
      question_he: `איזה קשר מתאים לנושא ${title}?`,
      options_he: [`${title} קשור לתג ${tags[0]} וללמידה חזותית.`, "הנושא תמיד שייך רק לחלל.", "אי אפשר ללמוד עליו מתוך עובדות."],
      correct_answer_index: 0,
      source_fact_he: facts[1],
    },
  };
}

const promptPlan = {
  schema_version: 1,
  product_name_he: "אוספים עובדות",
  language: "he",
  text_direction: "rtl",
  note_he: "פיצול חבילת צבעים וצורות לשתי חבילות נפרדות. כל תמונה נוצרת לבד.",
  packs: [],
  cards: [],
};

for (const pack of packs) {
  const cards = pack.cards.map(([slug, title_he, facts_he, tags_he], idx) => {
    const index = idx + 1;
    const file = cardFile(index, slug);
    return {
      card_id: `${pack.pack_id}-${file}`,
      index,
      title_he,
      asset_path: `assets/season-1/cards-wave2-he/${pack.pack_id}/${file}.webp`,
      facts_he,
      tags_he,
      rarity: rarity(index),
      quizzes: quizzes(title_he, facts_he, tags_he),
    };
  });

  await writeFile(new URL(`${pack.pack_id}.json`, outDir), JSON.stringify({
    schema_version: 1,
    product_name_he: "אוספים עובדות",
    language: "he",
    text_direction: "rtl",
    season: 1,
    pack_id: pack.pack_id,
    pack_title_he: pack.pack_title_he,
    domain_he: pack.domain_he,
    age_group_he: pack.age_group_he,
    pack_asset_path: `assets/season-1/packs-wave2-he/pack-${pack.pack_id}.webp`,
    card_count: cards.length,
    quiz_flow_he: "תמונת הקלף מציגה עובדות בלבד. בלחיצה על קלף נעול האפליקציה פותחת מבחן קצר לפי גיל. תשובה נכונה פותחת את הקלף ומעניקה מטבעות מוח.",
    security_note_he: "בפרודקשן correct_answer_index נשמר בבסיס הנתונים/Edge Function ואינו נשלח ללקוח לפני שליחת תשובה.",
    cards,
  }, null, 2), "utf8");

  promptPlan.packs.push({
    asset_id: `pack-${pack.pack_id}`,
    output_path: `assets/season-1/packs-wave2-he/pack-${pack.pack_id}.webp`,
    pack_id: pack.pack_id,
    prompt_he: `צור תמונת חבילת קלפים יחידה למשחק "אוספים עובדות". עברית מקורית מימין לשמאל, לא תרגום ולא שכבת טקסט מעל תמונה. יחס קלף 512x716, חבילה אחת בלבד, לא גיליון. טקסטים בתוך העיצוב כחלק מהאיור: "אוספים עובדות", "עונה 1", "${pack.pack_title_he}", "10 קלפי עובדות". עטיפת foil פרימיום מקורית בגודל קלף, קצוות מקומטים, ${pack.visual_theme_he}. אין אנגלית, אין מותגים קיימים, אין watermark.`,
  });

  for (const card of cards) {
    promptPlan.cards.push({
      asset_id: card.card_id,
      output_path: card.asset_path,
      pack_id: pack.pack_id,
      title_he: card.title_he,
      prompt_he: `צור תמונת קלף יחידה למשחק "אוספים עובדות". עברית מקורית מימין לשמאל, לא תרגום ולא שכבת טקסט מעל תמונה. יחס 512x716, קלף אחד בלבד, לא גיליון. טקסטים בתוך העיצוב כחלק מהקלף: "אוספים עובדות", "עונה 1", "${pack.pack_title_he}", "${card.title_he}", "${card.index}/10", "${card.facts_he[0]}", "${card.facts_he[1]}", "${card.facts_he[2]}". קלף מידע עם עובדות בלבד, ללא שאלה וללא תשובות. איור מרכזי מקורי של ${card.title_he}, מסגרת פרימיום אחידה לעונה 1: קרם, זהב רך, כחול/טורקיז, badges, foil עדין, צל עומק. אין אנגלית, אין כפתורים, אין UI, אין watermark, לא להעתיק מותגים קיימים.`,
    });
  }
}

await writeFile(new URL("split-colors-shapes-prompts.json", promptDir), JSON.stringify(promptPlan, null, 2), "utf8");

const indexPath = new URL("index.json", outDir);
const index = JSON.parse(await readFile(indexPath, "utf8"));
const replacement = packs.map((pack) => ({
  pack_id: pack.pack_id,
  pack_title_he: pack.pack_title_he,
  domain_he: pack.domain_he,
  card_count: 10,
  quiz_path: `assets/season-1/quizzes/${pack.pack_id}.json`,
}));

const nextPacks = [];
let inserted = false;
for (const entry of index.packs) {
  if (entry.pack_id === "colors-shapes") {
    nextPacks.push(...replacement);
    inserted = true;
    continue;
  }
  if (entry.pack_id === "colors" || entry.pack_id === "shapes") continue;
  nextPacks.push(entry);
}
if (!inserted) nextPacks.splice(3, 0, ...replacement);
index.packs = nextPacks;
await writeFile(indexPath, JSON.stringify(index, null, 2), "utf8");
