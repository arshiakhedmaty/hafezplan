import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "fa" | "en";
export type Dir = "rtl" | "ltr";

export function resolveLanguage(value: string | null): Lang {
  return value === "en" ? "en" : "fa";
}

export function languageAttributes(lang: Lang): { lang: Lang; dir: Dir } {
  return { lang, dir: lang === "fa" ? "rtl" : "ltr" };
}

export function applyLanguageToRoot(root: { lang: string; dir: string }, lang: Lang): void {
  const attributes = languageAttributes(lang);
  root.lang = attributes.lang;
  root.dir = attributes.dir;
}

export const strings = {
  appName: { fa: "حافظ‌پلن", en: "HafezPlan" },
  tagline: {
    fa: "برنامه‌ریز هوشمند انتخاب واحد",
    en: "Intelligent course planning for students",
  },
  heroLead: {
    fa: "دروس گذرانده و ترجیح‌هایت را وارد کن؛ حافظ‌پلن همهٔ برنامه‌های معتبر ترم را می‌سازد و کمکت می‌کند بهترینش را انتخاب کنی.",
    en: "Tell HafezPlan what you have passed and what you prefer. It builds every valid semester schedule and helps you narrow down to the one you want.",
  },
  start: { fa: "شروع برنامه‌ریزی", en: "Start planning" },
  continue: { fa: "ادامه", en: "Continue" },
  back: { fa: "بازگشت", en: "Back" },
  save: { fa: "ذخیره", en: "Save" },
  saved: { fa: "ذخیره شد", en: "Saved" },
  signIn: { fa: "ورود", en: "Sign in" },
  signUp: { fa: "ثبت‌نام", en: "Sign up" },
  signOut: { fa: "خروج", en: "Sign out" },
  email: { fa: "ایمیل", en: "Email" },
  password: { fa: "رمز عبور", en: "Password" },
  continueWithGoogle: { fa: "ورود با گوگل", en: "Continue with Google" },
  checkEmail: {
    fa: "برای تأیید حساب، ایمیلت را بررسی کن.",
    en: "Check your email to confirm your account.",
  },
  authTitle: { fa: "ورود به حافظ‌پلن", en: "Sign in to HafezPlan" },
  authSubtitle: {
    fa: "برنامه‌ها و دروس تو روی حساب کاربری ذخیره می‌شوند.",
    en: "Your courses and plans are saved to your account.",
  },
  noAccount: { fa: "حساب نداری؟", en: "No account?" },
  haveAccount: { fa: "حساب داری؟", en: "Already have an account?" },

  // Setup
  setupTitle: { fa: "وضعیت تحصیلی", en: "Your academic record" },
  setupSubtitle: {
    fa: "دروسی که گذرانده‌ای را مشخص کن تا پیش‌نیازها درست بررسی شوند.",
    en: "Mark what you have already passed so prerequisites are checked correctly.",
  },
  searchCourses: { fa: "جستجوی درس…", en: "Search courses…" },
  passed: { fa: "گذرانده", en: "Passed" },
  current: { fa: "در حال گذراندن", en: "In progress" },
  failed: { fa: "افتاده", en: "Failed" },
  required: { fa: "حتماً بردارم", en: "Must take" },
  avoid: { fa: "برنمی‌دارم", en: "Skip" },
  none: { fa: "—", en: "—" },
  eligible: { fa: "قابل اخذ", en: "Eligible" },
  missingPrereq: { fa: "پیش‌نیاز ناقص", en: "Prerequisite missing" },
  uncertain: { fa: "نامشخص", en: "Uncertain" },
  noSections: { fa: "بدون گروه ارائه‌شده", en: "Not offered" },
  markEligible: { fa: "خودم مطمئنم، قابل اخذ است", en: "Override: I can take this" },

  prefsTitle: { fa: "ترجیح‌ها", en: "Preferences" },
  prefsSubtitle: {
    fa: "محدودیت‌های واقعی‌ات را بگو؛ بقیه‌اش با موتور زمان‌بندی است.",
    en: "Set your real constraints; the scheduling engine handles the rest.",
  },
  minCredits: { fa: "حداقل واحد", en: "Minimum credits" },
  maxCredits: { fa: "حداکثر واحد", en: "Maximum credits" },
  blockedTimes: { fa: "زمان‌های اشغال", en: "Blocked times" },
  addBlockedTime: { fa: "افزودن بازهٔ اشغال", en: "Add blocked time" },
  noEarlierThan: { fa: "کلاس زودتر از", en: "No class before" },
  noLaterThan: { fa: "کلاس دیرتر از", en: "No class after" },
  preferredFreeDays: { fa: "روزهای ترجیحاً خالی", en: "Preferred free days" },
  maxClassDays: { fa: "حداکثر روزهای حضور", en: "Max days on campus" },
  anyValue: { fa: "بدون محدودیت", en: "No limit" },
  generate: { fa: "ساخت برنامه‌ها", en: "Generate plans" },

  // Plans
  plansTitle: { fa: "برنامه‌های پیشنهادی", en: "Candidate plans" },
  planCount: { fa: "برنامهٔ معتبر", en: "valid plans" },
  showingTop: { fa: "نمایش ۱۰۰ برنامهٔ برتر و متنوع", en: "Showing the top 100 diverse plans" },
  refine: { fa: "محدودتر کن", en: "Narrow down" },
  refineHint: {
    fa: "این گزینه‌ها فقط جایی نشان داده می‌شوند که برنامه‌ها واقعاً با هم فرق دارند.",
    en: "These options only appear where the plans genuinely differ.",
  },
  undo: { fa: "برگرد", en: "Undo" },
  reset: { fa: "پاک‌کردن فیلترها", en: "Clear filters" },
  credits: { fa: "واحد", en: "credits" },
  freeDays: { fa: "روزهای خالی", en: "Free days" },
  classDays: { fa: "روزهای حضور", en: "Class days" },
  professor: { fa: "استاد", en: "Professor" },
  section: { fa: "گروه", en: "Section" },
  exam: { fa: "امتحان", en: "Exam" },
  weeklySchedule: { fa: "برنامهٔ هفتگی", en: "Weekly schedule" },
  choosePlan: { fa: "انتخاب این برنامه", en: "Choose this plan" },
  chosen: { fa: "برنامهٔ انتخابی", en: "Selected plan" },
  match: { fa: "تطابق", en: "Match" },
  noPlans: { fa: "هیچ برنامهٔ معتبری پیدا نشد", en: "No valid plan found" },
  whyNot: { fa: "چرا؟", en: "Why?" },
  loosen: { fa: "کدام محدودیت را شل کنم؟", en: "What to relax" },
  // Import
  importTitle: { fa: "ورود جدول دروس دانشگاه", en: "Import the university table" },
  importSubtitle: {
    fa: "جدول ارائهٔ دروس را از سامانهٔ دانشگاه کپی کن و اینجا بچسبان یا فایل CSV را انتخاب کن.",
    en: "Paste the offerings table from your university portal, or pick a CSV file.",
  },
  pastePlaceholder: { fa: "جدول را اینجا بچسبان…", en: "Paste the table here…" },
  chooseFile: { fa: "انتخاب فایل CSV", en: "Choose CSV file" },
  parseTable: { fa: "بررسی جدول", en: "Read table" },
  saveImport: { fa: "ذخیرهٔ دروس", en: "Save courses" },
  importedCourses: { fa: "درس یکتا", en: "unique courses" },
  importedSections: { fa: "گروه درسی", en: "sections" },
  ambiguousRows: { fa: "ردیف نامشخص", en: "unclear rows" },
  aiAssist: { fa: "تشخیص با هوش مصنوعی", en: "Resolve with AI" },
  aiAssistHint: {
    fa: "فقط ردیف‌هایی که خوانده نشدند به هوش مصنوعی فرستاده می‌شوند.",
    en: "Only the rows that could not be read are sent to the AI.",
  },
  noCatalog: {
    fa: "هنوز درسی وارد نشده است. اول جدول دانشگاه را وارد کن.",
    en: "No courses yet. Import your university table first.",
  },
  newImport: { fa: "ورود جدول جدید", en: "New import" },

  // Course choice
  coursesTitle: { fa: "دروس", en: "Courses" },
  coursesSubtitle: {
    fa: "برای هر درس مشخص کن که برمی‌داری، فرقی ندارد، یا برنمی‌داری.",
    en: "For each course choose: take it, no preference, or skip it.",
  },
  prefTake: { fa: "برمی‌دارم", en: "Take" },
  prefNeutral: { fa: "فرقی ندارد", en: "No preference" },
  prefSkip: { fa: "برنمی‌دارم", en: "Skip" },
  gender: { fa: "جنسیت", en: "Gender" },
  male: { fa: "مرد", en: "Male" },
  female: { fa: "زن", en: "Female" },
  genderHint: {
    fa: "گروه‌های مختلط برای هر دو جنسیت نمایش داده می‌شوند.",
    en: "Mixed sections are offered to both genders.",
  },
  creditRangeHint: { fa: "بین ۱۲ تا ۲۴ واحد", en: "Between 12 and 24 credits" },
  examsTitle: { fa: "برنامهٔ امتحان‌ها", en: "Exam schedule" },
  noExam: { fa: "بدون امتحان", en: "No exam" },
  language: { fa: "English", en: "فارسی" },
  courses: { fa: "دروس", en: "Courses" },
  preferences: { fa: "ترجیح‌ها", en: "Preferences" },
  plans: { fa: "برنامه‌ها", en: "Plans" },
  loading: { fa: "در حال بارگذاری…", en: "Loading…" },
  importWorkflow: { fa: "فرایند ورود امن", en: "Safe import workflow" },
  importSubtitleFull: {
    fa: "جدول را بارگذاری کن، هر ردیف نامطمئن را بازبینی و اصلاح کن، سپس نسخهٔ تأییدشده را ذخیره کن.",
    en: "Upload the table, review and correct every uncertain row, then save only the confirmed version.",
  },
  upload: { fa: "بارگذاری", en: "Upload" },
  reviewEdit: { fa: "بازبینی و ویرایش", en: "Review and edit" },
  validateConfirm: { fa: "اعتبارسنجی و تأیید", en: "Validate and confirm" },
  importFormat: { fa: "روش ورود", en: "Import method" },
  pasteText: { fa: "چسباندن متن", en: "Paste text" },
  screenshot: { fa: "تصویر", en: "Screenshot" },
  manualEntry: { fa: "ورود دستی", en: "Manual entry" },
  imagePrivacyHint: {
    fa: "تصویر فقط برای استخراج متن استفاده می‌شود. اگر سرویس استخراج تنظیم نشده باشد، تشخیص محلی مرورگر امتحان می‌شود.",
    en: "The image is used only to extract text. If no extraction service is configured, local browser recognition is attempted.",
  },
  extracting: { fa: "در حال استخراج…", en: "Extracting…" },
  chooseImage: { fa: "انتخاب تصویر", en: "Choose image" },
  manualHint: {
    fa: "در مرحلهٔ بعد ردیف‌های درس را یکی‌یکی اضافه کن.",
    en: "Add course rows one by one in the next step.",
  },
  jsonPlaceholder: {
    fa: "آرایهٔ JSON گروه‌های درسی یا شیء دارای sections…",
    en: "A JSON section array or an object containing sections…",
  },
  importInputRequired: {
    fa: "ابتدا متن یا فایل را وارد کن.",
    en: "Paste text or choose a file first.",
  },
  reviewHint: {
    fa: "هیچ داده‌ای پیش از تأیید این صفحه وارد زمان‌بندی نمی‌شود.",
    en: "Nothing on this page enters scheduling until you confirm it.",
  },
  rowsNeedAttention: { fa: "ردیف نیازمند اصلاح", en: "rows need attention" },
  noReadableRows: {
    fa: "ردیف قابل استفاده‌ای پیدا نشد؛ یک ردیف دستی اضافه کن.",
    en: "No usable rows were found; add a manual row.",
  },
  addRow: { fa: "افزودن ردیف", en: "Add row" },
  deleteRow: { fa: "حذف ردیف", en: "Delete row" },
  confirmAndSave: { fa: "تأیید و ذخیره", en: "Confirm and save" },
  importSaveFailed: {
    fa: "ذخیرهٔ تراکنشی ناموفق بود؛ دادهٔ قبلی دست‌نخورده باقی ماند.",
    en: "The transaction failed; your previous catalog was left unchanged.",
  },
  setupCombinedHint: {
    fa: "سابقهٔ تحصیلی و تصمیم این ترم را برای هر درس مشخص کن.",
    en: "Set your academic history and this semester's choice for each course.",
  },
  academicStatus: { fa: "سابقهٔ تحصیلی", en: "Academic status" },
  coursePreference: { fa: "تصمیم این ترم", en: "This semester's choice" },
  courseCode: { fa: "کد درس", en: "Course code" },
  courseName: { fa: "نام درس", en: "Course name" },
  capacity: { fa: "ظرفیت", en: "Capacity" },
  mixed: { fa: "مختلط", en: "Mixed" },
  classTime: { fa: "زمان کلاس", en: "Class time" },
  compare: { fa: "افزودن به مقایسه", en: "Add to compare" },
  comparePlans: { fa: "مقایسهٔ برنامه‌ها", en: "Compare plans" },
  print: { fa: "چاپ", en: "Print" },
  semesterDatesRequired: {
    fa: "برای خروجی تقویم، تاریخ شروع و پایان ترم را در ترجیح‌ها وارد کن.",
    en: "Set the semester start and end dates in Preferences before exporting a calendar.",
  },
  exportFailed: { fa: "ساخت خروجی ناموفق بود.", en: "Could not create the export." },
  dataLoadFailed: {
    fa: "بارگذاری اطلاعات برنامه‌ریزی ناموفق بود. برنامه‌ای با دادهٔ ناقص نمایش داده نشد.",
    en: "Planning data could not be loaded. No schedule was shown from incomplete data.",
  },
  retry: { fa: "تلاش دوباره", en: "Try again" },
  preferencesInvalid: {
    fa: "بازهٔ واحد، ساعت‌ها یا تاریخ‌های ترم معتبر نیست.",
    en: "The credit range, daily times, or semester dates are invalid.",
  },
  semesterDates: { fa: "تاریخ‌های ترم", en: "Semester dates" },
  semesterStart: { fa: "شروع ترم", en: "Semester start" },
  semesterEnd: { fa: "پایان ترم", en: "Semester end" },
  savedPlans: { fa: "برنامه‌های ذخیره‌شده", en: "Saved plans" },
  viewPlan: { fa: "مشاهدهٔ برنامه", en: "View plan" },
  hidePlan: { fa: "بستن برنامه", en: "Hide plan" },
  deletePlan: { fa: "حذف برنامه", en: "Delete plan" },
  deletePlanConfirm: {
    fa: "این نسخهٔ ذخیره‌شده حذف شود؟",
    en: "Delete this saved plan version?",
  },
  savedPlanUnavailable: {
    fa: "این نسخه با قالب قدیمی ذخیره شده و قابل نمایش نیست.",
    en: "This version uses an older snapshot format and cannot be displayed.",
  },
  finalPlan: { fa: "نهایی", en: "Final" },
  makeFinal: { fa: "انتخاب نهایی", en: "Make final" },
  profileDetails: { fa: "مشخصات تحصیلی", en: "Academic profile" },
  major: { fa: "رشته", en: "Major" },
  degree: { fa: "مقطع", en: "Degree" },
  semester: { fa: "ترم", en: "Semester" },
  loadSample: { fa: "بارگذاری نمونهٔ فیزیک", en: "Load physics sample" },
} as const;

export type StringKey = keyof typeof strings;

const DAY_NAMES: Record<Lang, string[]> = {
  fa: ["شنبه", "یک‌شنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"],
  en: ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
};
const DAY_SHORT: Record<Lang, string[]> = {
  fa: ["ش", "ی", "د", "س", "چ", "پ", "ج"],
  en: ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"],
};

interface I18nValue {
  lang: Lang;
  dir: Dir;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  t: (key: StringKey) => string;
  dayName: (day: number) => string;
  dayShort: (day: number) => string;
  num: (value: number | string) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fa");

  useEffect(() => {
    const stored = window.localStorage.getItem("hafezplan.lang");
    setLangState(resolveLanguage(stored));
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    window.localStorage.setItem("hafezplan.lang", next);
  }, []);

  const dir = languageAttributes(lang).dir;

  useEffect(() => {
    applyLanguageToRoot(document.documentElement, lang);
  }, [lang]);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      dir,
      setLang,
      toggleLang: () => setLang(lang === "fa" ? "en" : "fa"),
      t: (key) => strings[key][lang],
      dayName: (day) => DAY_NAMES[lang][day] ?? "",
      dayShort: (day) => DAY_SHORT[lang][day] ?? "",
      num: (value) =>
        lang === "fa"
          ? String(value).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]!)
          : String(value),
    }),
    [lang, dir, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
