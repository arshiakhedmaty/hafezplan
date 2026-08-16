import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, FileUp, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCatalog, useCoursePreferences, useImport } from "@/lib/data/hooks";
import { useI18n } from "@/lib/i18n";
import { parseTable } from "@/lib/import/parser";
import type { ParseResult } from "@/lib/import/types";
import type { Course, CoursePreference } from "@/lib/scheduling";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/setup")({
  head: () => ({
    meta: [
      { title: "Your courses — HafezPlan" },
      {
        name: "description",
        content: "Import your university offerings table and choose which courses you want to take this semester.",
      },
      { property: "og:title", content: "Your courses — HafezPlan" },
      {
        property: "og:description",
        content: "Import the offerings table and mark each course as take, no preference, or skip.",
      },
    ],
  }),
  component: SetupPage,
});

const CHOICES: CoursePreference[] = ["take", "neutral", "skip"];

const CHOICE_LABEL: Record<CoursePreference, "prefTake" | "prefNeutral" | "prefSkip"> = {
  take: "prefTake",
  neutral: "prefNeutral",
  skip: "prefSkip",
};

function SetupPage() {
  const { t, lang, num } = useI18n();
  const catalog = useCatalog();
  const { byCourseId, setPreference } = useCoursePreferences();
  const [query, setQuery] = useState("");

  const courses = catalog.data?.courses ?? [];
  const sectionCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const section of catalog.data?.sections ?? []) {
      map.set(section.courseId, (map.get(section.courseId) ?? 0) + 1);
    }
    return map;
  }, [catalog.data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.nameEn.toLowerCase().includes(q) ||
        c.nameFa.includes(query.trim()),
    );
  }, [courses, query]);

  const courseName = (course: Course) => (lang === "fa" ? course.nameFa : course.nameEn);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl">{t("coursesTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("coursesSubtitle")}</p>
      </header>

      <ImportPanel hasCatalog={courses.length > 0} />

      {courses.length > 0 ? (
        <div className="relative">
          <Search className="pointer-events-none absolute inset-inline-start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchCourses")}
            className="ps-9"
          />
        </div>
      ) : null}

      {catalog.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
          {t("noCatalog")}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((course) => {
            const choice: CoursePreference = byCourseId[course.id] ?? "neutral";
            return (
              <li key={course.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-card-foreground">{courseName(course)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <span dir="ltr">{course.code}</span> · {num(course.credits)} {t("credits")}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {num(sectionCount.get(course.id) ?? 0)} {t("importedSections")}
                  </Badge>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {CHOICES.map((value) => (
                    <ChoiceChip
                      key={value}
                      active={choice === value}
                      onClick={() => setPreference({ courseId: course.id, preference: value })}
                      label={t(CHOICE_LABEL[value])}
                    />
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex justify-end">
        <Button asChild size="lg" disabled={courses.length === 0}>
          <Link to="/preferences">{t("continue")}</Link>
        </Button>
      </div>
    </div>
  );
}

function ImportPanel({ hasCatalog }: { hasCatalog: boolean }) {
  const { t, num } = useI18n();
  const { runImport, isImporting, error } = useImport();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(!hasCatalog);
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setRaw(text);
    setResult(parseTable(text));
  };

  const handleParse = () => setResult(parseTable(raw));

  const handleSave = async () => {
    if (!result || result.sections.length === 0) return;
    await runImport({ rawInput: raw, parsed: result.sections });
    setResult(null);
    setRaw("");
    setOpen(false);
  };

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <FileUp className="size-4" />
          {t("newImport")}
        </Button>
      </div>
    );
  }

  const uniqueCourses = new Set((result?.sections ?? []).map((s) => s.courseCode)).size;

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="text-lg">{t("importTitle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("importSubtitle")}</p>

      <Textarea
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          setResult(null);
        }}
        placeholder={t("pastePlaceholder")}
        className="mt-3 min-h-40 font-mono text-xs"
      />

      <input
        ref={fileRef}
        type="file"
        accept=".csv,.txt,text/csv,text/plain"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <FileUp className="size-4" />
          {t("chooseFile")}
        </Button>
        <Button type="button" size="sm" onClick={handleParse} disabled={raw.trim().length === 0}>
          {t("parseTable")}
        </Button>
        {result && result.sections.length > 0 ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => void handleSave()} disabled={isImporting}>
            {isImporting ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("saveImport")}
          </Button>
        ) : null}
        {hasCatalog ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
            {t("back")}
          </Button>
        ) : null}
      </div>

      {result ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge variant="secondary">
            {num(uniqueCourses)} {t("importedCourses")}
          </Badge>
          <Badge variant="secondary">
            {num(result.sections.length)} {t("importedSections")}
          </Badge>
          {result.ambiguous.length > 0 ? (
            <Badge variant="outline" className="gap-1">
              <AlertTriangle className="size-3" />
              {num(result.ambiguous.length)} {t("ambiguousRows")}
            </Badge>
          ) : null}
        </div>
      ) : null}

      {result && result.ambiguous.length > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{t("aiAssistHint")}</p>
      ) : null}

      {error ? <p className="mt-2 text-xs text-destructive">{error.message}</p> : null}
    </section>
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
