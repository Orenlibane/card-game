import { mkdir, writeFile } from "node:fs/promises";

const outDir = new URL("../assets/season-1/quizzes/", import.meta.url);
const promptsDir = new URL("../assets/season-1/prompts/", import.meta.url);

const packMeta = {
  animals: {
    pack_id: "animals",
    pack_title_he: "חיות",
    domain_he: "עולם החיות",
    age_group_he: "ילדים קטנים",
    pack_asset_path: "assets/season-1/packs-native-he/pack-native-animals.webp",
  },
  crystals: {
    pack_id: "crystals",
    pack_title_he: "קריסטלים ומינרלים",
    domain_he: "טבע וחומרים",
    age_group_he: "בינוניים",
    pack_asset_path: "assets/season-1/packs-native-he/pack-native-crystals.webp",
  },
  security: {
    pack_id: "security",
    pack_title_he: "ביטחון והצלה",
    domain_he: "חברה, אזרחות וביטחון",
    age_group_he: "גדולים ומבוגרים",
    pack_asset_path: "assets/season-1/packs-native-he/pack-native-rescue.webp",
  },
};

const cards = {
  animals: [
    card("animals-01-cat", 1, "חתול", "01-cat.webp", ["לחתולים יש שפמים שעוזרים להם להרגיש מרחב.", "חתול יכול לגרגר כשהוא רגוע או מבקש תשומת לב.", "כפות רכות עוזרות לחתול ללכת בשקט."], ["חוש מישוש", "יונקים"]),
    card("animals-02-dog", 2, "כלב", "02-dog.webp", ["לכלבים יש חוש ריח מפותח במיוחד.", "זנב, אוזניים וקול עוזרים לכלב לתקשר.", "כלבים לומדים פקודות בעזרת חזרה וחיזוק חיובי."], ["חוש ריח", "תקשורת"]),
    card("animals-03-rabbit", 3, "ארנב", "03-rabbit.webp", ["אוזניים ארוכות עוזרות לארנב לשמוע סכנות.", "ארנבים אוכלים בעיקר צמחים.", "רגליים אחוריות חזקות מאפשרות קפיצות מהירות."], ["צמחונות", "תנועה"]),
    card("animals-04-elephant", 4, "פיל", "04-elephant.webp", ["חדק הפיל משמש לנשימה, שתייה והרמה.", "פילים חיים בקבוצות משפחתיות.", "הפיל הוא בעל החיים היבשתי הגדול ביותר."], ["משפחה", "חדק"]),
    card("animals-05-giraffe", 5, "ג׳ירפה", "05-giraffe.webp", ["צוואר ארוך עוזר לג׳ירפה להגיע לעלים גבוהים.", "לכל ג׳ירפה דוגמת כתמים ייחודית.", "ג׳ירפות הן יונקים צמחוניים."], ["צמחונות", "דפוסים"]),
    card("animals-06-turtle", 6, "צב", "06-turtle.webp", ["שריון הצב מגן על גופו.", "צבים נעים לאט אך יכולים להיות עקשניים מאוד.", "חלק ממיני הצבים חיים שנים רבות."], ["שריון", "זוחלים"]),
    card("animals-07-dolphin", 7, "דולפין", "07-dolphin.webp", ["דולפינים הם יונקים שנושמים אוויר.", "הם משתמשים בקולות כדי לתקשר ולנווט.", "דולפינים חיים בקבוצות חברתיות."], ["ים", "תקשורת"]),
    card("animals-08-butterfly", 8, "פרפר", "08-butterfly.webp", ["פרפר מתחיל את חייו כזחל.", "כנפי הפרפר מכוסות קשקשים זעירים.", "פרפרים עוזרים בהאבקת פרחים."], ["גלגול", "האבקה"]),
    card("animals-09-penguin", 9, "פינגווין", "09-penguin.webp", ["פינגווין הוא עוף שאינו עף.", "פינגווינים שוחים היטב בעזרת כנפיים חזקות.", "רבים מהם חיים באזורים קרים."], ["עופות", "שחייה"]),
    card("animals-10-shark", 10, "כריש", "10-shark.webp", ["כרישים הם דגים עם חושים חדים.", "לכרישים יש שיניים שמתחלפות במהלך החיים.", "רוב הכרישים חשובים לאיזון החיים בים."], ["ים", "מערכת אקולוגית"]),
  ],
  crystals: [
    card("crystals-01-quartz", 1, "קוורץ", "01-quartz.webp", ["קוורץ הוא אחד המינרלים הנפוצים בעולם.", "הוא נמצא בסלעים רבים וגם בחול.", "קוורץ קשה יחסית ועמיד בפני שריטות."], ["מינרלים", "קשיות"]),
    card("crystals-02-amethyst", 2, "אמטיסט", "02-amethyst.webp", ["אמטיסט הוא סוג סגול של קוורץ.", "הצבע הסגול נוצר בעקבות יסודות זעירים בתוך הגביש.", "אמטיסט מופיע לעיתים בתוך חללים בסלע."], ["גבישים", "צבע"]),
    card("crystals-03-tourmaline", 3, "טורמלין", "03-tourmaline.webp", ["טורמלין יכול להופיע במגוון צבעים.", "הגבישים שלו ארוכים ולעיתים מפוספסים.", "לחץ וחום יכולים ליצור בו מטען חשמלי קטן."], ["חשמל", "צבעים"]),
    card("crystals-04-pyrite", 4, "פיריט", "04-pyrite.webp", ["פיריט נקרא לפעמים זהב השוטים בגלל הברק שלו.", "הוא עשוי מברזל וגופרית.", "לפיריט יש לעיתים צורת קובייה טבעית."], ["מתכות", "צורות"]),
    card("crystals-05-obsidian", 5, "אובסידיאן", "05-obsidian.webp", ["אובסידיאן הוא זכוכית געשית טבעית.", "הוא נוצר כאשר לבה מתקררת מהר מאוד.", "שברים של אובסידיאן יכולים להיות חדים מאוד."], ["געשיות", "זכוכית"]),
    card("crystals-06-granite", 6, "גרניט", "06-granite.webp", ["גרניט הוא סלע שנוצר עמוק באדמה.", "הוא מכיל מינרלים כמו קוורץ, פצלת השדה ונציץ.", "משתמשים בגרניט לבנייה ולמשטחים חזקים."], ["סלעים", "בנייה"]),
    card("crystals-07-basalt", 7, "בזלת", "07-basalt.webp", ["בזלת היא סלע געשי כהה.", "היא נוצרת מלבה שהתקררה על פני השטח.", "בזלת נפוצה באזורים געשיים."], ["לבה", "געשיות"]),
    card("crystals-08-diamond", 8, "יהלום", "08-diamond.webp", ["יהלום עשוי מאטומי פחמן.", "הוא אחד החומרים הקשים בטבע.", "בגלל הקשיות שלו משתמשים בו גם בכלי חיתוך."], ["פחמן", "קשיות"]),
    card("crystals-09-rock-salt", 9, "מלח סלעים", "09-rock-salt.webp", ["מלח סלעים נקרא גם הליט.", "הגבישים שלו נוטים לצורת קובייה.", "מלח סלעים נמס במים וטעמו מלוח."], ["מלח", "גבישים"]),
    card("crystals-10-mineral-fossil", 10, "מאובן מינרלי", "10-mineral-fossil.webp", ["מאובן שומר עקבות של יצור או צמח מן העבר.", "מינרלים יכולים להחליף חומר חי ולשמר צורה.", "מאובנים עוזרים להבין איך נראה העולם לפני זמן רב."], ["עבר", "מדע"]),
  ],
  security: [
    card("security-01-rescue", 1, "חילוץ והצלה", "01-rescue.webp", ["צוותי חילוץ עוזרים לאנשים במצבי חירום.", "עבודה בצוות ותכנון מוקדם מצילים זמן.", "ציוד נכון ואימון קבוע משפרים בטיחות."], ["חירום", "עבודת צוות"]),
    card("security-02-intelligence", 2, "מודיעין", "02-intelligence.webp", ["מודיעין עוסק באיסוף מידע ובניתוחו.", "מידע מדויק עוזר לקבל החלטות טובות יותר.", "שמירה על סודיות היא חלק מרכזי בעבודה."], ["מידע", "חשיבה"]),
    card("security-03-air-force", 3, "חיל האוויר", "03-air-force.webp", ["חיל האוויר מפעיל מטוסים, מסוקים ומערכות בקרה.", "טייסים וצוותים טכניים מתאמנים הרבה לפני משימה.", "כלי טיס יכולים לסייע גם בחילוץ ובתצפית."], ["תעופה", "טכנולוגיה"]),
    card("security-04-navy", 4, "חיל הים", "04-navy.webp", ["חיל הים פועל בים ושומר על נתיבי שיט.", "ספינות וצוללות דורשות צוותים מיומנים.", "הים מחייב ניווט, קשר ושמירה על בטיחות."], ["ים", "ניווט"]),
    card("security-05-medical-corps", 5, "חיל הרפואה", "05-medical-corps.webp", ["חיל הרפואה מעניק טיפול רפואי בשגרה ובחירום.", "חובשים ורופאים מתרגלים טיפול מהיר ובטוח.", "מניעה, חיסונים והדרכה עוזרים לשמור על בריאות."], ["בריאות", "עזרה ראשונה"]),
    card("security-06-iron-dome", 6, "כיפת ברזל", "06-iron-dome.webp", ["כיפת ברזל היא מערכת הגנה מפני רקטות.", "המערכת מחשבת מסלול ומחליטה מתי ליירט.", "המטרה המרכזית היא להגן על אזרחים."], ["הגנה", "טכנולוגיה"]),
    card("security-07-cyber-warfare", 7, "לוחמה בסייבר", "07-cyber-warfare.webp", ["סייבר עוסק בהגנה על מחשבים ורשתות.", "סיסמאות חזקות ועדכונים משפרים אבטחה.", "מומחי סייבר מחפשים חולשות לפני שתוקפים מוצאים אותן."], ["מחשבים", "אבטחה"]),
    card("security-08-logistics", 8, "לוגיסטיקה", "08-logistics.webp", ["לוגיסטיקה דואגת שציוד יגיע למקום הנכון בזמן.", "תכנון אספקה כולל אוכל, מים, דלק וכלים.", "מאחורי כל פעילות יש שרשרת ארגון מדויקת."], ["ארגון", "אספקה"]),
    card("security-09-home-front-command", 9, "פיקוד העורף", "09-home-front-command.webp", ["פיקוד העורף מדריך אזרחים להתנהגות בטוחה בחירום.", "הכרת מרחב מוגן עוזרת לפעול מהר.", "תרגול מראש מפחית לחץ בזמן אמת."], ["אזרחות", "בטיחות"]),
    card("security-10-military-ethics", 10, "אתיקה צבאית", "10-military-ethics.webp", ["אתיקה צבאית עוסקת באחריות ובשמירה על כללים.", "החלטות קשות דורשות שיקול דעת וכבוד לאדם.", "מטרה חשובה היא להגן על אנשים ולפעול לפי חוק."], ["אחריות", "ערכים"]),
  ],
};

function card(card_id, index, title_he, file, facts_he, tags_he) {
  return {
    card_id,
    index,
    title_he,
    asset_path: "",
    facts_he,
    tags_he,
    rarity: index === 10 ? "legendary" : index % 4 === 0 ? "epic" : index % 3 === 0 ? "rare" : "common",
    quizzes: {},
  };
}

const quizTemplates = {
  junior: {
    age_band_he: "3-5",
    reward_brain_coins: 8,
  },
  child: {
    age_band_he: "6-12",
    reward_brain_coins: 15,
  },
  advanced: {
    age_band_he: "13+",
    reward_brain_coins: 25,
  },
};

function makeQuizzes(cardItem) {
  const firstFact = cardItem.facts_he[0];
  const secondFact = cardItem.facts_he[1];
  const thirdFact = cardItem.facts_he[2] || firstFact;
  const tag = cardItem.tags_he[0];
  return {
    junior: {
      ...quizTemplates.junior,
      question_he: `מה נכון לגבי ${cardItem.title_he}?`,
      options_he: [firstFact, "הנושא הזה אינו קשור לעובדות בקלף.", "אי אפשר ללמוד עליו מתוך הקלף."],
      correct_answer_index: 0,
      source_fact_he: firstFact,
    },
    child: {
      ...quizTemplates.child,
      question_he: `מה נכון לגבי ${cardItem.title_he}?`,
      options_he: [firstFact, "הנושא הזה חי תמיד מתחת לאדמה.", "הנושא הזה אינו קשור לחבילה."],
      correct_answer_index: 0,
      source_fact_he: firstFact,
    },
    advanced: {
      ...quizTemplates.advanced,
      question_he: `איזו מסקנה אפשר להסיק מהעובדות על ${cardItem.title_he}?`,
      options_he: [secondFact, thirdFact, `המידע על ${cardItem.title_he} אינו קשור לתג ${tag}.`],
      correct_answer_index: 0,
      source_fact_he: secondFact,
    },
  };
}

function packJson(packId) {
  const meta = packMeta[packId];
  const packCards = cards[packId].map((cardItem) => ({
    ...cardItem,
    asset_path: `assets/season-1/cards-native-he/${packId}/${String(cardItem.index).padStart(2, "0")}-${cardItem.asset_path || cardItem.card_id.split("-").slice(2).join("-")}.webp`,
    quizzes: makeQuizzes(cardItem),
  }));

  return {
    schema_version: 1,
    product_name_he: "אוספים עובדות",
    language: "he",
    text_direction: "rtl",
    season: 1,
    ...meta,
    card_count: packCards.length,
    quiz_flow_he: "תמונת הקלף מציגה עובדות בלבד. בלחיצה על קלף נעול האפליקציה פותחת מבחן קצר לפי גיל. תשובה נכונה פותחת את הקלף ומעניקה מטבעות מוח.",
    security_note_he: "בפרודקשן correct_answer_index נשמר בבסיס הנתונים/Edge Function ואינו נשלח ללקוח לפני שליחת תשובה.",
    cards: packCards,
  };
}

function imagePromptForCard(packId, cardItem) {
  const meta = packMeta[packId];
  return {
    asset_id: cardItem.card_id,
    output_path: `assets/season-1/cards-native-he/${packId}/${String(cardItem.index).padStart(2, "0")}-${cardItem.card_id.split("-").slice(2).join("-")}.webp`,
    generation_mode: "single_image_only",
    prompt_he: `צור תמונת קלף יחידה ונפרדת למשחק "אוספים עובדות", בעברית מלאה מימין לשמאל, יחס 512x716. שם הקלף: "${cardItem.title_he}". חבילה: "${meta.pack_title_he}". עונה 1. הקלף הוא קלף מידע עם עובדות בלבד: הוא מציג כותרת, איור, תג נדירות, מספר קלף ${cardItem.index}/10, ו-2-3 עובדות קצרות בעברית: ${cardItem.facts_he.join(" / ")}. שלב באיור מרכזי מקורי של הנושא, מסגרת אספנות פרימיום מקורית, טיפוגרפיה עברית ברורה ומעט אזורי טקסט קצרים כדי לצמצם טעויות כתיב. לא להוסיף אזור פעולה, טופס, סימון תשובה או משפט שמבקש מהשחקן לענות. הטקסט חייב להיות חלק טבעי מהתמונה ולא שכבת תרגום מעליה. אין לייצר גיליון קלפים; רק הקלף הזה לבד.`,
  };
}

function imagePromptForPack(packId) {
  const meta = packMeta[packId];
  return {
    asset_id: `pack-${packId}`,
    output_path: meta.pack_asset_path,
    generation_mode: "single_image_only",
    prompt_he: `צור תמונת חבילת קלפים יחידה ונפרדת למשחק "אוספים עובדות", בעברית מלאה מימין לשמאל, באותו יחס וגודל ויזואלי של קלף 512x716. שם החבילה: "${meta.pack_title_he}". עונה 1. החבילה היא עטיפת foil פרימיום מקורית עם קצוות מקומטים, לוגו עברי טבעי כחלק מהתמונה, איור מרכזי מקורי שמתאים לתחום "${meta.domain_he}", תווית "10 קלפי עובדות", תג גיל מתאים, ותחושה של TCG איכותי בלי להעתיק מותגים קיימים. אין לייצר גיליון חבילות; רק החבילה הזאת לבד.`,
  };
}

await mkdir(outDir, { recursive: true });
await mkdir(promptsDir, { recursive: true });

const packs = Object.keys(packMeta).map((packId) => packJson(packId));
for (const pack of packs) {
  await writeFile(new URL(`${pack.pack_id}.json`, outDir), JSON.stringify(pack, null, 2), "utf8");
}

await writeFile(
  new URL("index.json", outDir),
  JSON.stringify(
    {
      schema_version: 1,
      product_name_he: "אוספים עובדות",
      language: "he",
      text_direction: "rtl",
      season: 1,
      packs: packs.map(({ pack_id, pack_title_he, domain_he, card_count }) => ({
        pack_id,
        pack_title_he,
        domain_he,
        card_count,
        quiz_path: `assets/season-1/quizzes/${pack_id}.json`,
      })),
    },
    null,
    2,
  ),
  "utf8",
);

const promptPlan = {
  schema_version: 1,
  product_name_he: "אוספים עובדות",
  language: "he",
  text_direction: "rtl",
  final_asset_policy_he: "כל קלף וכל חבילה נוצרים כתמונה עצמאית בפרומפט עצמאי. אסור לייצר גיליון ואז לחתוך אותו לנכסים סופיים.",
  contact_sheet_policy_he: "מותר ליצור contact sheet רק לאחר שיש נכסים עצמאיים, לצורך סקירה ואישור בלבד.",
  packs: Object.keys(packMeta).map(imagePromptForPack),
  cards: Object.entries(cards).flatMap(([packId, packCards]) => packCards.map((cardItem) => imagePromptForCard(packId, cardItem))),
};

await writeFile(new URL("native-hebrew-individual-prompts.json", promptsDir), JSON.stringify(promptPlan, null, 2), "utf8");

console.log(`Wrote ${packs.length} quiz packs and ${promptPlan.cards.length + promptPlan.packs.length} individual asset prompts.`);
