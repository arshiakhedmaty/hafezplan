import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  CalendarCheck,
  ChevronDown,
  Download,
  FileImage,
  FileSpreadsheet,
  GitCompareArrows,
  Printer,
  RotateCcw,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthUser } from "@/hooks/use-auth-user";
import { saveChosenPlan } from "@/lib/data/catalog";
import {
  useCatalog,
  useCoursePreferences,
  usePreferences,
  useProfile,
  useSavedPlans,
  useStudentState,
} from "@/lib/data/hooks";
import {
  downloadPlanImage,
  downloadText,
  planToCsv,
  planToExcelHtml,
  planToIcs,
  type ExportLabels,
} from "@/lib/export/plan";
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
      {
        name: "description",
        content: "Browse every valid, conflict-free semester schedule and narrow down to one.",
      },
      { property: "og:title", content: "Candidate plans — HafezPlan" },
      {
        property: "og:description",
        content: "Valid semester schedules generated from your record and preferences.",
      },
    ],
  }),
  component: PlansPage,
});

function PlansPage() {
  const { t, lang, num, dayShort, dayName } = useI18n();
  const { user } = useAuthUser();
  const catalog = useCatalog();
  const studentState = useStudentState();
  const preferenceState = usePreferences();
  const coursePreferences = useCoursePreferences();
  const profileState = useProfile();
  const { state } = studentState;
  const { preferences } = preferenceState;
  const { profile } = profileState;
  const savedPlans = useSavedPlans();
  const [refinements, setRefinements] = useState<Refinement[]>([]);
  const [openPlan, setOpenPlan] = useState<string | null>(null);
  const [openSavedPlan, setOpenSavedPlan] = useState<string | null>(null);
  const [planViews, setPlanViews] = useState<Record<string, "week" | "exams">>({});
  const [printingPlan, setPrintingPlan] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [comparison, setComparison] = useState<string[]>([]);

  const courseChoices = useMemo(() => {
    const choices: Record<string, "take" | "neutral" | "skip"> = {};
    for (const course of catalog.data?.courses ?? []) {
      const choice = coursePreferences.byCourseId[course.id];
      if (choice) choices[course.code] = choice;
    }
    return choices;
  }, [catalog.data, coursePreferences.byCourseId]);

  const result = useMemo(() => {
    if (!catalog.data) return null;
    return solve({
      courses: catalog.data.courses,
      sections: catalog.data.sections,
      student: state,
      coursePreferences: courseChoices,
      preferences: { ...preferences, gender: profile?.gender ?? preferences.gender },
      refinements,
    });
  }, [catalog.data, state, courseChoices, profile?.gender, preferences, refinements]);

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
        version: 1,
        selectedAt: new Date().toISOString(),
        plan,
        preferences,
        refinements,
        studentGender: profile?.gender ?? null,
      });
      setChosen(plan.id);
      await savedPlans.refresh();
      toast.success(t("saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const promoteSavedPlan = async (planId: string) => {
    try {
      await savedPlans.setFinal(planId);
      toast.success(t("saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const removeSavedPlan = async (planId: string) => {
    if (!window.confirm(t("deletePlanConfirm"))) return;
    try {
      await savedPlans.remove(planId);
      if (openSavedPlan === planId) setOpenSavedPlan(null);
      toast.success(t("saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const exportLabels: ExportLabels = {
    title: t("chosen"),
    course: t("courses"),
    section: t("section"),
    professor: t("professor"),
    meetings: t("weeklySchedule"),
    exam: t("exam"),
    credits: t("credits"),
    dayName,
  };

  const exportPlan = async (plan: Plan, format: "csv" | "xls" | "ics" | "png" | "print") => {
    try {
      if (format === "csv")
        downloadText(
          `hafezplan-${plan.id}.csv`,
          planToCsv(plan, exportLabels),
          "text/csv;charset=utf-8",
        );
      if (format === "xls")
        downloadText(
          `hafezplan-${plan.id}.xls`,
          planToExcelHtml(plan, exportLabels),
          "application/vnd.ms-excel;charset=utf-8",
        );
      if (format === "ics")
        downloadText(
          `hafezplan-${plan.id}.ics`,
          planToIcs(
            plan,
            { start: preferences.semesterStart, end: preferences.semesterEnd },
            t("exam"),
          ),
          "text/calendar;charset=utf-8",
        );
      if (format === "png") await downloadPlanImage(plan, exportLabels);
      if (format === "print") {
        setPrintingPlan(plan.id);
        requestAnimationFrame(() => {
          window.addEventListener("afterprint", () => setPrintingPlan(null), { once: true });
          window.print();
        });
      }
    } catch (error) {
      toast.error(
        error instanceof Error && error.message === "semester_dates_required"
          ? t("semesterDatesRequired")
          : t("exportFailed"),
      );
    }
  };

  const planningError =
    catalog.error ??
    studentState.error ??
    preferenceState.error ??
    coursePreferences.error ??
    profileState.error;

  if (planningError) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-card p-6 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">{t("dataLoadFailed")}</p>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() =>
            void Promise.all([
              catalog.refetch(),
              studentState.retry(),
              preferenceState.retry(),
              coursePreferences.retry(),
              profileState.retry(),
            ])
          }
        >
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (
    catalog.isLoading ||
    studentState.isLoading ||
    preferenceState.isLoading ||
    coursePreferences.isLoading ||
    profileState.isLoading ||
    !result
  ) {
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

      {savedPlans.error ? (
        <section className="rounded-xl border border-destructive/40 bg-card p-4">
          <h2 className="font-semibold">{t("savedPlans")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("dataLoadFailed")}</p>
          <Button
            className="mt-3"
            size="sm"
            variant="outline"
            onClick={() => void savedPlans.retry()}
          >
            {t("retry")}
          </Button>
        </section>
      ) : null}

      {savedPlans.plans.length > 0 ? (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold">{t("savedPlans")}</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {savedPlans.plans.map((saved) => {
              const savedPlan = planFromSnapshot(saved.data);
              const isOpen = openSavedPlan === saved.id;
              const viewKey = `saved:${saved.id}`;
              const view = planViews[viewKey] ?? "week";
              return (
                <li
                  key={saved.id}
                  className={cn(
                    "rounded-lg border p-3 text-sm",
                    saved.isFinal && "border-primary bg-primary/5",
                    isOpen && "sm:col-span-2 lg:col-span-3",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{saved.label ?? t("chosen")}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(saved.createdAt).toLocaleDateString(
                          lang === "fa" ? "fa-IR" : "en",
                        )}
                      </p>
                    </div>
                    {saved.isFinal ? <Badge>{t("finalPlan")}</Badge> : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      aria-expanded={isOpen}
                      onClick={() => setOpenSavedPlan(isOpen ? null : saved.id)}
                    >
                      {isOpen ? t("hidePlan") : t("viewPlan")}
                    </Button>
                    {!saved.isFinal ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void promoteSavedPlan(saved.id)}
                      >
                        {t("makeFinal")}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void removeSavedPlan(saved.id)}
                    >
                      {t("deletePlan")}
                    </Button>
                  </div>
                  {isOpen ? (
                    <div className="mt-3 border-t pt-3">
                      {savedPlan ? (
                        <>
                          <div className="mb-3 flex flex-wrap gap-2" role="tablist">
                            <Button
                              role="tab"
                              aria-selected={view === "week"}
                              size="sm"
                              variant={view === "week" ? "default" : "outline"}
                              onClick={() =>
                                setPlanViews((current) => ({ ...current, [viewKey]: "week" }))
                              }
                            >
                              {t("weeklySchedule")}
                            </Button>
                            <Button
                              role="tab"
                              aria-selected={view === "exams"}
                              size="sm"
                              variant={view === "exams" ? "default" : "outline"}
                              onClick={() =>
                                setPlanViews((current) => ({ ...current, [viewKey]: "exams" }))
                              }
                            >
                              {t("examsTitle")}
                            </Button>
                          </div>
                          {view === "week" ? (
                            <WeeklyView plan={savedPlan} />
                          ) : (
                            <ExamView plan={savedPlan} />
                          )}
                        </>
                      ) : (
                        <p className="rounded-lg bg-muted p-3 text-muted-foreground">
                          {t("savedPlanUnavailable")}
                        </p>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

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

      {comparison.length >= 2 ? (
        <PlanComparison
          plans={comparison
            .map((id) => result.plans.find((plan) => plan.id === id))
            .filter((plan): plan is Plan => Boolean(plan))}
          onClose={() => setComparison([])}
        />
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
            {result.blockers.length === 0 ? (
              <li className="rounded-lg bg-muted px-3 py-2">{t("loosen")}</li>
            ) : null}
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
            data-print-plan={printingPlan === plan.id ? "true" : undefined}
            className={cn(
              "rounded-xl border bg-card shadow-sm transition-colors",
              chosen === plan.id ? "border-gold" : "border-border",
            )}
          >
            <button
              type="button"
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 text-start"
              aria-expanded={openPlan === plan.id}
              aria-controls={`plan-panel-${index}`}
              onClick={() => setOpenPlan(openPlan === plan.id ? null : plan.id)}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {lang === "fa" ? `برنامهٔ ${num(index + 1)}` : `Plan ${index + 1}`}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {num(plan.credits)} {t("credits")} · {num(plan.classDays.length)} {t("classDays")}{" "}
                  · {plan.freeDays.map((d) => dayShort(d)).join("، ") || "—"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="secondary">
                  {t("match")} {num(plan.match)}%
                </Badge>
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    openPlan === plan.id && "rotate-180",
                  )}
                />
              </div>
            </button>

            {openPlan === plan.id ? (
              <div id={`plan-panel-${index}`} className="border-t border-border p-4">
                <div className="mb-4 flex flex-wrap gap-2" role="tablist">
                  <Button
                    size="sm"
                    role="tab"
                    aria-selected={(planViews[plan.id] ?? "week") === "week"}
                    variant={(planViews[plan.id] ?? "week") === "week" ? "default" : "outline"}
                    onClick={() => setPlanViews((current) => ({ ...current, [plan.id]: "week" }))}
                  >
                    {t("weeklySchedule")}
                  </Button>
                  <Button
                    size="sm"
                    role="tab"
                    aria-selected={(planViews[plan.id] ?? "week") === "exams"}
                    variant={(planViews[plan.id] ?? "week") === "exams" ? "default" : "outline"}
                    onClick={() => setPlanViews((current) => ({ ...current, [plan.id]: "exams" }))}
                  >
                    {t("examsTitle")}
                  </Button>
                  <Button
                    size="sm"
                    variant={comparison.includes(plan.id) ? "secondary" : "outline"}
                    aria-pressed={comparison.includes(plan.id)}
                    disabled={!comparison.includes(plan.id) && comparison.length >= 3}
                    onClick={() =>
                      setComparison((current) =>
                        current.includes(plan.id)
                          ? current.filter((id) => id !== plan.id)
                          : [...current, plan.id],
                      )
                    }
                  >
                    <GitCompareArrows /> {t("compare")}
                  </Button>
                </div>

                {(planViews[plan.id] ?? "week") === "week" ? (
                  <WeeklyView plan={plan} />
                ) : (
                  <ExamView plan={plan} />
                )}

                <div className="mt-4 flex flex-wrap gap-2 border-t pt-4 print:hidden">
                  <Button size="sm" variant="outline" onClick={() => void exportPlan(plan, "csv")}>
                    <Download /> CSV
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void exportPlan(plan, "xls")}>
                    <FileSpreadsheet /> Excel
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void exportPlan(plan, "ics")}>
                    <CalendarCheck /> ICS
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void exportPlan(plan, "png")}>
                    <FileImage /> PNG
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void exportPlan(plan, "print")}
                  >
                    <Printer /> {t("print")}
                  </Button>
                </div>
                <Button className="mt-4 w-full print:hidden" onClick={() => choose(plan)}>
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

function WeeklyView({ plan }: { plan: Plan }) {
  const { dayName, lang, t } = useI18n();
  const activeDays = [
    ...new Set(
      plan.entries.flatMap((entry) => entry.section.meetings.map((meeting) => meeting.day)),
    ),
  ].sort((a, b) => a - b);
  return (
    <div
      className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6"
      role="tabpanel"
      aria-label={t("weeklySchedule")}
    >
      {activeDays.map((day) => (
        <section key={day} className="rounded-lg border bg-background p-2">
          <h3 className="mb-2 text-xs font-bold text-muted-foreground">{dayName(day)}</h3>
          <div className="space-y-2">
            {plan.entries
              .flatMap((entry) =>
                entry.section.meetings
                  .filter((meeting) => meeting.day === day)
                  .map((meeting) => ({ entry, meeting })),
              )
              .sort((a, b) => a.meeting.start.localeCompare(b.meeting.start))
              .map(({ entry, meeting }) => (
                <div
                  key={`${entry.section.id}-${meeting.start}`}
                  className="rounded-md bg-primary/10 p-2 text-xs"
                >
                  <p className="font-semibold" dir="auto">
                    {lang === "fa" ? entry.course.nameFa : entry.course.nameEn}
                  </p>
                  <p dir="ltr">
                    {meeting.start}–{meeting.end}
                  </p>
                  <p className="truncate text-muted-foreground">{entry.section.professor ?? "—"}</p>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ExamView({ plan }: { plan: Plan }) {
  const { lang, t } = useI18n();
  const entries = plan.entries
    .filter((entry) => entry.section.exam)
    .sort(
      (a, b) =>
        (a.section.exam?.date ?? "").localeCompare(b.section.exam?.date ?? "") ||
        (a.section.exam?.start ?? "").localeCompare(b.section.exam?.start ?? ""),
    );
  if (entries.length === 0)
    return <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">{t("noExam")}</p>;
  return (
    <ol className="space-y-2" role="tabpanel" aria-label={t("examsTitle")}>
      {entries.map((entry) => (
        <li
          key={entry.section.id}
          className="grid gap-1 rounded-lg border bg-background p-3 text-sm sm:grid-cols-[1fr_auto]"
        >
          <span className="font-medium" dir="auto">
            {lang === "fa" ? entry.course.nameFa : entry.course.nameEn}
          </span>
          <span dir="ltr">
            {entry.section.exam!.date} · {entry.section.exam!.start}–{entry.section.exam!.end}
          </span>
        </li>
      ))}
    </ol>
  );
}

function PlanComparison({ plans, onClose }: { plans: Plan[]; onClose: () => void }) {
  const { t, num } = useI18n();
  const codes = [
    ...new Set(plans.flatMap((plan) => plan.entries.map((entry) => entry.course.code))),
  ].sort();
  return (
    <section
      className="rounded-xl border border-primary/40 bg-card p-4 shadow-sm"
      aria-labelledby="plan-comparison-title"
      aria-live="polite"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="plan-comparison-title" className="text-lg font-semibold">
          <GitCompareArrows className="me-2 inline" />
          {t("comparePlans")}
        </h2>
        <Button size="sm" variant="ghost" onClick={onClose}>
          {t("reset")}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <caption className="sr-only">{t("comparePlans")}</caption>
          <thead>
            <tr>
              <th scope="col" className="p-2 text-start">
                {t("courses")}
              </th>
              {plans.map((plan, index) => (
                <th key={plan.id} scope="col" className="p-2 text-start">
                  {t("plans")} {num(index + 1)}
                  <br />
                  <span className="text-xs font-normal text-muted-foreground">
                    {num(plan.credits)} {t("credits")} · {num(plan.classDays.length)}{" "}
                    {t("classDays")}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {codes.map((code) => (
              <tr key={code} className="border-t">
                <th scope="row" className="p-2 text-start" dir="ltr">
                  {code}
                </th>
                {plans.map((plan) => {
                  const entry = plan.entries.find((candidate) => candidate.course.code === code);
                  return (
                    <td key={plan.id} className="p-2">
                      {entry
                        ? `${entry.section.professor ?? "—"} · ${entry.section.sectionName}`
                        : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function planFromSnapshot(snapshot: unknown): Plan | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const record = snapshot as Record<string, unknown>;
  const candidate = record["plan"] ?? snapshot;
  if (!candidate || typeof candidate !== "object") return null;
  const plan = candidate as Record<string, unknown>;
  if (typeof plan["id"] !== "string" || !Array.isArray(plan["entries"])) return null;
  const hasValidEntries = plan["entries"].every((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const item = entry as Record<string, unknown>;
    if (!item["course"] || typeof item["course"] !== "object") return false;
    if (!item["section"] || typeof item["section"] !== "object") return false;
    const section = item["section"] as Record<string, unknown>;
    return typeof section["id"] === "string" && Array.isArray(section["meetings"]);
  });
  return hasValidEntries ? (candidate as Plan) : null;
}

function describeBlocker(
  blocker: { kind: string } & Record<string, unknown>,
  lang: "fa" | "en",
): string {
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
