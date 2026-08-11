import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "fa" | "en";
export type Dir = "rtl" | "ltr";

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
  checkEmail: { fa: "برای تأیید حساب، ایمیلت را بررسی کن.", en: "Check your email to confirm your account." },
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
  language: { fa: "English", en: "فارسی" },
  courses: { fa: "دروس", en: "Courses" },
  preferences: { fa: "ترجیح‌ها", en: "Preferences" },
  plans: { fa: "برنامه‌ها", en: "Plans" },
  loading: { fa: "در حال بارگذاری…", en: "Loading…" },
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
    if (stored === "fa" || stored === "en") setLangState(stored);
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    window.localStorage.setItem("hafezplan.lang", next);
  }, []);

  const dir: Dir = lang === "fa" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

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
        lang === "fa" ? String(value).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]!) : String(value),
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
