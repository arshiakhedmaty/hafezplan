import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarRange, Languages, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HafezPlan — Build a valid semester schedule" },
      {
        name: "description",
        content:
          "Enter your passed courses and preferences; HafezPlan generates every valid, conflict-free semester plan and helps you pick one.",
      },
      { property: "og:title", content: "HafezPlan — Build a valid semester schedule" },
      {
        property: "og:description",
        content: "Deterministic, bilingual course planning with prerequisite and conflict checking.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { t, toggleLang } = useI18n();

  const points = [
    { icon: ShieldCheck, fa: "پیش‌نیازها و تداخل کلاس و امتحان دقیق بررسی می‌شود.", en: "Prerequisites, class conflicts and exam conflicts are checked exactly." },
    { icon: CalendarRange, fa: "هر برنامه‌ای که می‌بینی واقعاً قابل انتخاب است.", en: "Every plan you see is genuinely selectable." },
    { icon: Sparkles, fa: "با چند انتخاب ساده از میان ده‌ها برنامه به یکی می‌رسی.", en: "A few simple choices narrow dozens of plans down to one." },
  ];

  return (
    <div className="surface-ornament min-h-screen">
      <div className="mx-auto flex max-w-xl flex-col items-center px-5 py-14 text-center sm:py-24">
        <Button variant="ghost" size="sm" className="self-end" onClick={toggleLang}>
          <Languages className="size-4" />
          {t("language")}
        </Button>

        <span className="mt-6 grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <span className="font-display text-3xl leading-none">ح</span>
        </span>

        <h1 className="mt-7 text-4xl leading-tight sm:text-5xl">{t("appName")}</h1>
        <p className="mt-3 text-base font-medium text-gold-foreground">{t("tagline")}</p>
        <p className="mt-5 text-pretty text-muted-foreground">{t("heroLead")}</p>

        <Button asChild size="lg" className="mt-8 w-full sm:w-auto">
          <Link to="/setup">{t("start")}</Link>
        </Button>

        <ul className="mt-12 w-full space-y-3 text-start">
          {points.map((point) => (
            <li
              key={point.en}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <point.icon className="mt-0.5 size-5 shrink-0 text-primary" />
              <span className="min-w-0 text-sm text-card-foreground">
                <Localized fa={point.fa} en={point.en} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Localized({ fa, en }: { fa: string; en: string }) {
  const { lang } = useI18n();
  return <>{lang === "fa" ? fa : en}</>;
}
