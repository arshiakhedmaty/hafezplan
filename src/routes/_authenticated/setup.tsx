import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, Check, CircleHelp, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useCatalog, useStudentState } from "@/lib/data/hooks";
import { useI18n } from "@/lib/i18n";
import { evaluateEligibility, type Course, type StudentState } from "@/lib/scheduling";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/setup")({
  head: () => ({
    meta: [
      { title: "Your courses — HafezPlan" },
      { name: "description", content: "Mark passed, failed and must-take courses so HafezPlan can check prerequisites." },
      { property: "og:title", content: "Your courses — HafezPlan" },
      { property: "og:description", content: "Track your academic record for accurate semester planning." },
    ],
  }),
  component: SetupPage,
});

type Bucket = "passed" | "current" | "failed" | "required" | "avoid";

const BUCKETS: Bucket[] = ["passed", "current", "failed", "required", "avoid"];

function SetupPage() {
  const { t, lang, num } = useI18n();
  const catalog = useCatalog();
  const { state, save } = useStudentState();
  const [query, setQuery] = useState("");

  const eligibility = useMemo(() => {
    if (!catalog.data) return [];
    return evaluateEligibility({ courses: catalog.data.courses, sections: catalog.data.sections, student: state });
  }, [catalog.data, state]);

  const statusByCode = useMemo(
    () => new Map(eligibility.map((e) => [e.course.code, e])),
    [eligibility],
  );

  const filtered = useMemo(() => {
    const courses = catalog.data?.courses ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.nameEn.toLowerCase().includes(q) ||
        c.nameFa.includes(query.trim()),
    );
  }, [catalog.data, query]);

  const setBucket = (code: string, bucket: Bucket | null) => {
    const next: StudentState = {
      ...state,
      passed: state.passed.filter((c) => c !== code),
      current: state.current.filter((c) => c !== code),
      failed: state.failed.filter((c) => c !== code),
      required: state.required.filter((c) => c !== code),
      avoid: state.avoid.filter((c) => c !== code),
      overrides: { ...state.overrides },
    };
    if (bucket) next[bucket] = [...next[bucket], code];
    save(next);
  };

  const toggleOverride = (code: string, value: boolean) => {
    const overrides = { ...state.overrides };
    if (value) overrides[code] = true;
    else delete overrides[code];
    save({ ...state, overrides });
  };

  const bucketOf = (code: string): Bucket | null =>
    BUCKETS.find((bucket) => (state[bucket] as string[]).includes(code)) ?? null;

  const courseName = (course: Course) => (lang === "fa" ? course.nameFa : course.nameEn);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl">{t("setupTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("setupSubtitle")}</p>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute inset-inline-start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchCourses")}
          className="ps-9"
        />
      </div>

      {catalog.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((course) => {
            const bucket = bucketOf(course.code);
            const status = statusByCode.get(course.code);
            return (
              <li key={course.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-card-foreground">{courseName(course)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <span dir="ltr">{course.code}</span> · {num(course.credits)} {t("credits")}
                    </p>
                  </div>
                  <StatusBadge status={status?.status} />
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <ChoiceChip active={bucket === null} onClick={() => setBucket(course.code, null)} label={t("none")} />
                  {BUCKETS.map((b) => (
                    <ChoiceChip
                      key={b}
                      active={bucket === b}
                      onClick={() => setBucket(course.code, b)}
                      label={t(b)}
                    />
                  ))}
                </div>

                {status?.status === "uncertain" || status?.status === "missing_prereq" ? (
                  <label className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2">
                    <span className="min-w-0 text-xs text-muted-foreground">{t("markEligible")}</span>
                    <Switch
                      checked={state.overrides[course.code] === true}
                      onCheckedChange={(value) => toggleOverride(course.code, value)}
                    />
                  </label>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex justify-end">
        <Button asChild size="lg">
          <Link to="/preferences">{t("continue")}</Link>
        </Button>
      </div>
    </div>
  );
}

function ChoiceChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: string | undefined }) {
  const { t } = useI18n();
  if (!status) return null;
  if (status === "passed" || status === "eligible") {
    return (
      <Badge variant="secondary" className="shrink-0 gap-1">
        <Check className="size-3" />
        {status === "passed" ? t("passed") : t("eligible")}
      </Badge>
    );
  }
  if (status === "uncertain") {
    return (
      <Badge variant="outline" className="shrink-0 gap-1">
        <CircleHelp className="size-3" />
        {t("uncertain")}
      </Badge>
    );
  }
  if (status === "no_sections") {
    return (
      <Badge variant="outline" className="shrink-0">
        {t("noSections")}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="shrink-0 gap-1 text-muted-foreground">
      <AlertTriangle className="size-3" />
      {t("missingPrereq")}
    </Badge>
  );
}
