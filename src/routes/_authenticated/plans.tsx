import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarCheck, ChevronDown, RotateCcw, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthUser } from "@/hooks/use-auth-user";
import { saveChosenPlan } from "@/lib/data/catalog";
import { useCatalog, usePreferences, useStudentState } from "@/lib/data/hooks";
import { useI18n } from "@/lib/i18n";
import {
  analyzeDifferences,
  solve,
  MAX_CANDIDATE_PLANS,
  type DifferenceGroup,
  type Plan,
  type Refinement,
} from "@/lib/scheduling";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/plans")({
  head: () => ({
    meta: [
      { title: "Candidate plans — HafezPlan" },
      { name: "description", content: "Browse every valid, conflict-free semester schedule and narrow down to one." },
      { property: "og:title", content: "Candidate plans — HafezPlan" },
      { property: "og:description", content: "Valid semester schedules generated from your record and preferences." },
    ],
  }),
  component: PlansPage,
});

function PlansPage() {
  const { t, lang, num, dayShort, dayName } = useI18n();
  const { user } = useAuthUser();
  const catalog = useCatalog();
  const { state } = useStudentState();
  const { preferences } = usePreferences();
  const [refinements, setRefinements] = useState<Refinement[]>([]);
  const [openPlan, setOpenPlan] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  const result = useMemo(() => {
    if (!catalog.data) return null;
    return solve({
      courses: catalog.data.courses,
      sections: catalog.data.sections,
      student: state,
      preferences,
      refinements,
    });
  }, [catalog.data, state, preferences, refinements]);

  const groups: DifferenceGroup[] = useMemo(
    () => (result ? analyzeDifferences(result.plans) : []),
    [result],
  );

  const refinementLabel = (refinement: Refinement): string => {
    switch (refinement.kind) {
      case "professor":
        return `${refinement.courseCode} · ${refinement.professor}`;
      case "freeDay":
        return `${t("freeDays")}: ${dayShort(refinement.day)}`;
      case "courseDay":
        return `${refinement.courseCode} · ${dayShort(refinement.day)}`;
      case "maxClassDays":
        return `${t("maxClassDays")} ≤ ${num(refinement.value)}`;
      case "noEarlierThan":
        return `${t("noEarlierThan")} ${refinement.time}`;
      case "noLaterThan":
        return `${t("noLaterThan")} ${refinement.time}`;
      case "section":
        return refinement.label;
      case "includeCourse":
        return `+ ${refinement.courseCode}`;
      case "excludeCourse":
        return `− ${refinement.courseCode}`;
    }
  };

  const choose = async (plan: Plan) => {
    if (!user) return;
    try {
      await saveChosenPlan(user.id, `${plan.credits} ${t("credits")}`, {
        credits: plan.credits,
        entries: plan.entries.map((e) => ({
          courseCode: e.course.code,
          sectionId: e.section.id,
          sectionName: e.section.sectionName,
          professor: e.section.professor,
        })),
      });
      setChosen(plan.id);
      toast.success(t("saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  if (catalog.isLoading || !result) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl">{t("plansTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {num(result.totalFound)} {t("planCount")}
            {result.truncated ? ` · ${t("showingTop")}` : ""}
          </p>
        </div>
        {refinements.length > 0 ? (
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="sm" onClick={() => setRefinements((r) => r.slice(0, -1))}>
              <Undo2 className="size-4" />
              {t("undo")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRefinements([])}>
              <RotateCcw className="size-4" />
              {t("reset")}
            </Button>
          </div>
        ) : null}
      </header>

      {refinements.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {refinements.map((refinement, index) => (
            <Badge
              key={`${refinement.kind}-${index}`}
              variant="secondary"
              className="cursor-pointer gap-1"
              onClick={() => setRefinements((r) => r.filter((_, i) => i !== index))}
            >
              {refinementLabel(refinement)} ×
            </Badge>
          ))}
        </div>
      ) : null}

      {result.plans.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <h2 className="text-xl">{t("noPlans")}</h2>
          <ul className="mx-auto mt-3 max-w-md space-y-2 text-start text-sm text-muted-foreground">
            {result.blockers.map((blocker, index) => (
              <li key={index} className="rounded-lg bg-muted px-3 py-2">
                {describeBlocker(blocker, lang)}
              </li>
            ))}
            {result.blockers.length === 0 ? <li className="rounded-lg bg-muted px-3 py-2">{t("loosen")}</li> : null}
          </ul>
          <div className="mt-5 flex justify-center gap-2">
            {refinements.length > 0 ? (
              <Button variant="outline" onClick={() => setRefinements([])}>
                {t("reset")}
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link to="/preferences">{t("preferences")}</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {groups.length > 0 ? (
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-lg">{t("refine")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("refineHint")}</p>
          <div className="mt-3 space-y-3">
            {groups.slice(0, 5).map((group) => (
              <div key={group.id}>
                <p className="text-xs font-medium text-muted-foreground">
                  {group.type === "professor"
                    ? `${t("professor")} · ${group.courseCode}`
                    : group.type === "freeDay"
                      ? t("freeDays")
                      : group.type === "classDays"
                        ? t("maxClassDays")
                        : group.type === "courseDay"
                          ? `${group.courseCode}`
                          : t("credits")}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {group.options.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setRefinements((r) => [...r, option.refinement])}
                      className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      {group.type === "freeDay" || group.type === "courseDay"
                        ? dayName(Number(option.value))
                        : String(option.value)}
                      <span className="ms-1 text-muted-foreground">{num(option.count)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <ul className="space-y-3">
        {result.plans.slice(0, MAX_CANDIDATE_PLANS).map((plan, index) => (
          <li
            key={plan.id}
            className={cn(
              "rounded-xl border bg-card shadow-sm transition-colors",
              chosen === plan.id ? "border-gold" : "border-border",
            )}
          >
            <button
              type="button"
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 text-start"
              onClick={() => setOpenPlan(openPlan === plan.id ? null : plan.id)}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {lang === "fa" ? `برنامهٔ ${num(index + 1)}` : `Plan ${index + 1}`}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {num(plan.credits)} {t("credits")} · {num(plan.classDays.length)} {t("classDays")} ·{" "}
                  {plan.freeDays.map((d) => dayShort(d)).join("، ") || "—"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="secondary">
                  {t("match")} {num(plan.match)}%
                </Badge>
                <ChevronDown
                  className={cn("size-4 transition-transform", openPlan === plan.id && "rotate-180")}
                />
              </div>
            </button>

            {openPlan === plan.id ? (
              <div className="border-t border-border p-4">
                <ul className="space-y-2">
                  {plan.entries.map((entry) => (
                    <li key={entry.section.id} className="rounded-lg bg-muted px-3 py-2 text-sm">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                        <span className="min-w-0 truncate font-medium">
                          {lang === "fa" ? entry.course.nameFa : entry.course.nameEn}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {t("section")} <span dir="ltr">{entry.section.sectionName}</span>
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {entry.section.professor ?? "—"} ·{" "}
                        {entry.section.meetings
                          .map((m) => `${dayShort(m.day)} ${m.start}–${m.end}`)
                          .join(" · ")}
                      </p>
                      {entry.section.exam ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {t("exam")}: <span dir="ltr">{entry.section.exam.date} {entry.section.exam.start}</span>
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <Button className="mt-4 w-full" onClick={() => choose(plan)}>
                  <CalendarCheck className="size-4" />
                  {chosen === plan.id ? t("chosen") : t("choosePlan")}
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function describeBlocker(blocker: { kind: string } & Record<string, unknown>, lang: "fa" | "en"): string {
  const fa: Record<string, string> = {
    required_not_eligible: "یکی از درس‌های الزامی هنوز قابل اخذ نیست.",
    required_over_max: "مجموع واحد درس‌های الزامی از سقف واحد بیشتر است.",
    required_class_conflict: "دو درس الزامی تداخل کلاسی دارند.",
    required_exam_conflict: "دو درس الزامی تداخل امتحان دارند.",
    required_blocked_by_personal_time: "یک درس الزامی با زمان‌های اشغال تو تداخل دارد.",
    refinement_too_strict: "فیلترهای انتخابی خیلی سخت‌گیرانه‌اند.",
    not_enough_credits: "واحد قابل اخذ کمتر از حداقل واحد است.",
    no_eligible_courses: "هیچ درس قابل اخذی پیدا نشد.",
  };
  const en: Record<string, string> = {
    required_not_eligible: "A must-take course is not eligible yet.",
    required_over_max: "Your must-take courses exceed the credit ceiling.",
    required_class_conflict: "Two must-take courses have a class conflict.",
    required_exam_conflict: "Two must-take courses have an exam conflict.",
    required_blocked_by_personal_time: "A must-take course falls inside your blocked time.",
    refinement_too_strict: "The filters you picked are too strict.",
    not_enough_credits: "Available credits are below your minimum.",
    no_eligible_courses: "No eligible course was found.",
  };
  const table = lang === "fa" ? fa : en;
  const base = table[blocker.kind] ?? blocker.kind;
  const detail = [blocker["courseCode"], blocker["a"], blocker["b"]].filter(Boolean).join(" · ");
  return detail ? `${base} (${detail})` : base;
}
