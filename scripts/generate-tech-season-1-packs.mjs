import { mkdir, readFile, writeFile } from "node:fs/promises";

const packs = [
  pack("angular", "Angular", "ילדים גדולים", "פיתוח ווב עם Angular", [
    ["components", "קומפוננטות", ["קומפוננטה מחלקת מסך לחלק קטן וברור", "לכל קומפוננטה יש תפקיד ותצוגה משלה", "קומפוננטות עוזרות לבנות אפליקציה מסודרת"], ["ווב", "מבנה"]],
    ["templates", "תבניות", ["תבנית מתארת מה המשתמש רואה במסך", "Angular מחבר נתונים לתבנית", "תבנית טובה שומרת על קוד ברור"], ["ממשק", "נתונים"]],
    ["signals", "Signals", ["Signal שומר ערך שהמסך יכול לעקוב אחריו", "Signals עוזרים לעדכן רק מה שהשתנה", "ניהול מצב ברור מקל על אפליקציות גדולות"], ["מצב", "ריאקטיביות"]],
    ["dependency-injection", "הזרקת תלויות", ["Angular יודע לספק שירותים לקומפוננטות", "הזרקת תלויות מפחיתה חיבור קשיח בין חלקים", "בדיקות קלות יותר כששירותים מופרדים"], ["ארכיטקטורה", "שירותים"]],
    ["services", "שירותים", ["Service מרכז לוגיקה שמשותפת לכמה מסכים", "שירות יכול לשמור מידע או לדבר עם שרת", "הפרדה לשירותים שומרת על קומפוננטות נקיות"], ["לוגיקה", "שיתוף"]],
    ["routing", "ניווט", ["Router מעביר בין מסכים בלי לרענן את כל האתר", "כתובת URL יכולה להצביע למסך מסוים", "ניווט ברור עוזר למשתמש להבין איפה הוא"], ["מסכים", "URL"]],
    ["forms", "טפסים", ["טופס אוסף מידע מהמשתמש", "Angular עוזר לבדוק שדות לפני שליחה", "טופס טוב מסביר מה חסר ומה תקין"], ["קלט", "בדיקות"]],
    ["http-client", "HttpClient", ["HttpClient מבקש מידע משרתים", "בקשות רשת מביאות נתונים חיים לאפליקציה", "טיפול בשגיאות חשוב בכל תקשורת"], ["רשת", "שרת"]],
    ["cli", "Angular CLI", ["CLI יוצר פרויקטים וקבצים במהירות", "פקודות עוזרות לבנות ולבדוק אפליקציה", "כלי עבודה עקביים חוסכים טעויות"], ["כלים", "פיתוח"]],
    ["hydration", "SSR ו-Hydration", ["SSR יכול להכין HTML בצד השרת", "Hydration מחבר את הדף לפעולה בדפדפן", "טעינה מהירה משפרת חוויית משתמש"], ["ביצועים", "שרת"]],
  ]),
  pack("codex", "Codex", "מבוגרים", "סוכן קידוד ועבודה עם קוד", [
    ["coding-agent", "סוכן קידוד", ["Codex יכול לקבל משימה ולעבוד על קבצים", "סוכן טוב מתקדם דרך קריאה, שינוי ובדיקה", "האדם עדיין מאשר כיוון ותוצאה"], ["AI", "קוד"]],
    ["workspace", "Workspace", ["Workspace נותן לסוכן הקשר של הפרויקט", "קבצים, בדיקות וכלים עוזרים להבין מערכת", "שינויים נשמרים במקום שאפשר לבדוק"], ["פרויקט", "קבצים"]],
    ["tasks", "משימות", ["משימה טובה מגדירה יעד ותוצאה רצויה", "Codex מתאים לעבודות עם כמה צעדים", "פירוק משימות מקל על בדיקה"], ["תכנון", "ביצוע"]],
    ["skills", "Skills", ["Skill שומר workflow חוזר לשימוש עתידי", "Skill יכול לכלול הוראות, scripts ו-references", "סטנדרט קבוע עוזר לשמור איכות"], ["תהליך", "סטנדרט"]],
    ["sandbox", "סביבת הרצה", ["Sandbox מגביל ומבודד עבודה מסוכנת", "הרצה מקומית עוזרת לבדוק שינויים", "אבטחה חשובה כשסוכן משנה קוד"], ["אבטחה", "בדיקה"]],
    ["code-review", "Code Review", ["סקירת קוד מחפשת באגים וסיכונים", "ממצא טוב מצביע על קובץ ושורה", "בדיקות חסרות הן חלק מהסיכון"], ["איכות", "ביקורת"]],
    ["parallel-agents", "עבודה במקביל", ["כמה סוכנים יכולים לטפל בחלקים שונים", "פיצול טוב מונע התנגשויות בקבצים", "שילוב תוצאות דורש בדיקה מרוכזת"], ["מקביליות", "צוות"]],
    ["cli", "Codex CLI", ["CLI מאפשר לעבוד עם Codex מהטרמינל", "פקודות יכולות לקרוא, לשנות ולהריץ בדיקות", "אישורי פעולה שומרים על שליטה"], ["טרמינל", "כלים"]],
    ["automations", "Automations", ["Automation מפעילה עבודה חוזרת בזמן הנכון", "מעקב אחרי בעיות יכול לקרות ברקע", "אוטומציה טובה חוסכת עבודה ידנית"], ["אוטומציה", "מעקב"]],
    ["pull-requests", "Pull Requests", ["PR מציג שינוי לפני מיזוג", "סוכן יכול להכין תיקון ולהסביר אותו", "בדיקות וסקירה מגינות על הקוד הראשי"], ["Git", "שיתוף"]],
  ]),
  pack("kiro", "Kiro", "מבוגרים", "פיתוח מונחה מפרט עם AI", [
    ["spec-driven", "Spec Driven", ["Kiro מדגיש פיתוח שמתחיל ממפרט ברור", "מפרט טוב מחבר דרישות, עיצוב ומשימות", "כוונה כתובה מפחיתה ניחושים"], ["מפרט", "תכנון"]],
    ["requirements", "דרישות", ["דרישה מסבירה מה המערכת צריכה לעשות", "קבלה ברורה עוזרת לדעת אם הצלחנו", "דרישות טובות חוסכות בלבול בהמשך"], ["מוצר", "דיוק"]],
    ["ears", "EARS", ["EARS היא דרך לנסח דרישות בצורה עקבית", "מבנה קבוע מקל לקרוא תנאי קבלה", "דרישה מדויקת עוזרת גם לאדם וגם לסוכן"], ["דרישות", "שפה"]],
    ["design-docs", "מסמכי עיצוב", ["מסמך עיצוב מסביר איך הפתרון בנוי", "החלטות טכניות כתובות קלות יותר לבדיקה", "עיצוב ברור עוזר לתחזק מערכת"], ["ארכיטקטורה", "תיעוד"]],
    ["task-plan", "תוכנית משימות", ["משימות הופכות מפרט לצעדים קטנים", "צעד קטן קל יותר לבצע ולבדוק", "סדר משימות טוב מפחית סיכונים"], ["ביצוע", "סדר"]],
    ["steering", "Steering", ["Steering נותן לסוכן כללים והקשר קבועים", "כללים טובים שומרים על סגנון הפרויקט", "הקשר נכון מצמצם תיקונים חוזרים"], ["הנחיות", "הקשר"]],
    ["agent-hooks", "Hooks", ["Hook מפעיל פעולה בזמן אירוע מסוים", "בדיקות או פורמט יכולים לרוץ אוטומטית", "Hooks מחברים workflow לקצב העבודה"], ["אוטומציה", "אירועים"]],
    ["custom-agents", "סוכנים מותאמים", ["סוכן מותאם יכול להתמחות בתפקיד מסוים", "חלוקת תפקידים עוזרת בפרויקטים מורכבים", "התמחות טובה משפרת עקביות"], ["AI", "צוות"]],
    ["cli-ide-web", "IDE CLI Web", ["Kiro מציע סביבת IDE, CLI וממשק Web", "כל ממשק מתאים לסגנון עבודה אחר", "אותו רעיון יכול לעבור בין כלים שונים"], ["כלים", "ממשקים"]],
    ["validation", "אימות", ["אימות בודק שהקוד מתאים למפרט", "בדיקות מגלות פערים לפני משתמשים", "קשר בין מפרט לקוד מעלה אמון"], ["בדיקות", "אמון"]],
  ]),
];

function pack(pack_id, pack_title_he, age_group_he, domain_he, rawCards) {
  return { pack_id, pack_title_he, age_group_he, domain_he, cards: rawCards };
}

function rarity(index) {
  if (index === 10) return "legendary";
  if (index % 4 === 0) return "epic";
  if (index % 3 === 0) return "rare";
  return "common";
}

function quizzes(title, facts, tags) {
  return {
    junior: {
      age_band_he: "3-5",
      reward_brain_coins: 8,
      question_he: "איזה קלף ראית עכשיו?",
      options_he: [title, "חתול", "כוכב"],
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
      options_he: [`${title} קשור לתג ${tags[0]} ולעולם הפיתוח.`, "זה תמיד נושא של מזג אוויר.", "אי אפשר ללמוד עליו מתוך עובדות."],
      correct_answer_index: 0,
      source_fact_he: facts[1],
    },
  };
}

const outDir = new URL("../assets/season-1/quizzes/", import.meta.url);
await mkdir(outDir, { recursive: true });

for (const packData of packs) {
  const cards = packData.cards.map(([slug, title_he, facts_he, tags_he], idx) => {
    const index = idx + 1;
    const file = `${String(index).padStart(2, "0")}-${slug}`;
    return {
      card_id: `${packData.pack_id}-${file}`,
      index,
      title_he,
      asset_path: `assets/season-1/cards-tech-he/${packData.pack_id}/${file}.webp`,
      facts_he,
      tags_he,
      rarity: rarity(index),
      quizzes: quizzes(title_he, facts_he, tags_he),
    };
  });

  await writeFile(new URL(`${packData.pack_id}.json`, outDir), JSON.stringify({
    schema_version: 1,
    product_name_he: "אוספים עובדות",
    language: "he",
    text_direction: "rtl",
    season: 1,
    pack_id: packData.pack_id,
    pack_title_he: packData.pack_title_he,
    domain_he: packData.domain_he,
    age_group_he: packData.age_group_he,
    pack_asset_path: `assets/season-1/packs-tech-he/pack-${packData.pack_id}.webp`,
    card_count: cards.length,
    quiz_flow_he: "תמונת הקלף מציגה עובדות בלבד. בלחיצה על קלף נעול האפליקציה פותחת מבחן קצר לפי גיל. תשובה נכונה פותחת את הקלף ומעניקה מטבעות מוח.",
    security_note_he: "בפרודקשן correct_answer_index נשמר בבסיס הנתונים/Edge Function ואינו נשלח ללקוח לפני שליחת תשובה.",
    cards,
  }, null, 2), "utf8");
}

const indexPath = new URL("index.json", outDir);
const index = JSON.parse(await readFile(indexPath, "utf8"));
const byId = new Map(index.packs.map((entry) => [entry.pack_id, entry]));
for (const packData of packs) {
  byId.set(packData.pack_id, {
    pack_id: packData.pack_id,
    pack_title_he: packData.pack_title_he,
    domain_he: packData.domain_he,
    card_count: 10,
    quiz_path: `assets/season-1/quizzes/${packData.pack_id}.json`,
  });
}
index.packs = Array.from(byId.values());
await writeFile(indexPath, JSON.stringify(index, null, 2), "utf8");
