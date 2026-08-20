import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileImage,
  FileJson,
  FileSpreadsheet,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useCatalog,
  useCoursePreferences,
  useImport,
  useProfile,
  useStudentState,
} from "@/lib/data/hooks";
import type { ImportSourceType } from "@/lib/data/catalog";
import { extractTextFromImage } from "@/lib/import/image";
import { parseJsonOfferings } from "@/lib/import/json";
import { parseTable } from "@/lib/import/parser";
import { FICTIONAL_PHYSICS_CSV } from "@/lib/import/sample";
import {
  emptyDraftRow,
  resultToDraftRows,
  reviewDraftRows,
  type ImportDraftRow,
} from "@/lib/import/review";
import { useI18n } from "@/lib/i18n";
import type { CoursePreference, StudentCourseStatus } from "@/lib/scheduling";

export const Route = createFileRoute("/_authenticated/setup")({ component: SetupPage });

type ImportStep = "upload" | "review";

function SetupPage() {
  const { t, lang, num } = useI18n();
  const navigate = useNavigate();
  const catalog = useCatalog();
  const coursePreferences = useCoursePreferences();
  const student = useStudentState();
  const profile = useProfile();
  const importer = useImport();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showImport, setShowImport] = useState(false);
  const [step, setStep] = useState<ImportStep>("upload");
  const [sourceType, setSourceType] = useState<ImportSourceType>("paste");
  const [raw, setRaw] = useState("");
  const [rows, setRows] = useState<ImportDraftRow[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);

  const review = useMemo(() => reviewDraftRows(rows), [rows]);
  const hasCatalog = (catalog.data?.courses.length ?? 0) > 0;

  function readInput(): void {
    setLocalError(null);
    if (sourceType === "manual") {
      setRows([emptyDraftRow()]);
      setStep("review");
      return;
    }
    if (!raw.trim()) {
      setLocalError(t("importInputRequired"));
      return;
    }
    const result = sourceType === "json" ? parseJsonOfferings(raw) : parseTable(raw);
    setRows(resultToDraftRows(result));
    setStep("review");
  }

  async function chooseFile(file: File): Promise<void> {
    setLocalError(null);
    const isImage = file.type.startsWith("image/");
    const isJson = file.type.includes("json") || file.name.toLowerCase().endsWith(".json");
    if (isImage) {
      setSourceType("image");
      setExtracting(true);
      try {
        const result = await extractTextFromImage(file);
        setRaw(result.text);
        setRows(resultToDraftRows(parseTable(result.text)));
        setStep("review");
      } catch (error) {
        setLocalError(error instanceof Error ? error.message : "image_extraction_failed");
      } finally {
        setExtracting(false);
      }
      return;
    }
    const text = await file.text();
    setRaw(text);
    setSourceType(isJson ? "json" : "csv");
  }

  async function confirmImport(): Promise<void> {
    if (!review.canConfirm) return;
    try {
      await importer.runImport({ rawInput: raw, parsed: review.validSections, sourceType });
      setShowImport(false);
      setStep("upload");
      setRows([]);
      setRaw("");
    } catch {
      // The mutation exposes a localized-safe generic error below.
    }
  }

  function updateRow(id: string, patch: Partial<ImportDraftRow>): void {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  if (
    catalog.isLoading ||
    (hasCatalog && (coursePreferences.isLoading || student.isLoading || profile.isLoading))
  )
    return <p className="text-muted-foreground">{t("loading")}</p>;

  const setupError =
    catalog.error ??
    (hasCatalog ? (coursePreferences.error ?? student.error ?? profile.error) : null);
  if (setupError) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">{t("dataLoadFailed")}</p>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() =>
            void Promise.all([
              catalog.refetch(),
              coursePreferences.retry(),
              student.retry(),
              profile.retry(),
            ])
          }
        >
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (!hasCatalog || showImport) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-sm font-medium text-primary">{t("importWorkflow")}</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{t("importTitle")}</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{t("importSubtitleFull")}</p>
        </div>

        <ol
          className="grid grid-cols-3 gap-2 text-center text-xs sm:text-sm"
          aria-label={t("importWorkflow")}
        >
          {[t("upload"), t("reviewEdit"), t("validateConfirm")].map((label, index) => {
            const active = step === "upload" ? index === 0 : index >= 1;
            return (
              <li
                key={label}
                className={`rounded-lg border px-2 py-3 ${active ? "border-primary bg-primary/5 font-semibold" : "text-muted-foreground"}`}
              >
                {num(index + 1)}. {label}
              </li>
            );
          })}
        </ol>

        {step === "upload" ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("upload")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div
                className="grid gap-2 sm:grid-cols-5"
                role="radiogroup"
                aria-label={t("importFormat")}
              >
                {(
                  [
                    ["paste", t("pasteText"), FileSpreadsheet],
                    ["csv", "CSV", FileSpreadsheet],
                    ["json", "JSON", FileJson],
                    ["image", t("screenshot"), FileImage],
                    ["manual", t("manualEntry"), Plus],
                  ] as const
                ).map(([value, label, Icon]) => (
                  <Button
                    key={value}
                    type="button"
                    variant={sourceType === value ? "default" : "outline"}
                    className="h-auto min-h-12 whitespace-normal"
                    onClick={() => setSourceType(value)}
                  >
                    <Icon aria-hidden="true" /> {label}
                  </Button>
                ))}
              </div>

              {sourceType === "image" ? (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <FileImage className="mx-auto mb-3 size-8 text-primary" aria-hidden="true" />
                  <p className="mb-4 text-sm text-muted-foreground">{t("imagePrivacyHint")}</p>
                  <Button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={extracting}
                  >
                    {extracting ? t("extracting") : t("chooseImage")}
                  </Button>
                </div>
              ) : sourceType === "manual" ? (
                <div className="rounded-lg border p-5">
                  <p className="text-sm text-muted-foreground">{t("manualHint")}</p>
                </div>
              ) : (
                <>
                  <Textarea
                    value={raw}
                    onChange={(event) => setRaw(event.target.value)}
                    placeholder={
                      sourceType === "json" ? t("jsonPlaceholder") : t("pastePlaceholder")
                    }
                    className="min-h-52 font-mono text-xs"
                    dir="auto"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileRef.current?.click()}
                    >
                      {t("chooseFile")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setSourceType("csv");
                        setRaw(FICTIONAL_PHYSICS_CSV);
                      }}
                    >
                      {t("loadSample")}
                    </Button>
                  </div>
                </>
              )}

              <input
                ref={fileRef}
                type="file"
                className="sr-only"
                accept=".csv,.txt,.json,image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void chooseFile(file);
                  event.currentTarget.value = "";
                }}
              />
              {localError && <ErrorNotice message={localizedError(localError, lang)} />}
              <div className="flex justify-between gap-2">
                {hasCatalog ? (
                  <Button variant="ghost" onClick={() => setShowImport(false)}>
                    {t("back")}
                  </Button>
                ) : (
                  <span />
                )}
                <Button onClick={readInput} disabled={extracting}>
                  {t("reviewEdit")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{t("reviewEdit")}</CardTitle>
              <p className="text-sm text-muted-foreground">{t("reviewHint")}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3 text-sm" aria-live="polite">
                <span className="rounded-full bg-muted px-3 py-1">
                  {num(rows.length)} {t("importedSections")}
                </span>
                <span className="rounded-full bg-destructive/10 px-3 py-1 text-destructive">
                  {num(Object.keys(review.rowErrors).length)} {t("rowsNeedAttention")}
                </span>
              </div>

              {rows.length === 0 && <ErrorNotice message={t("noReadableRows")} />}
              <div className="space-y-4">
                {rows.map((row, index) => (
                  <ReviewRow
                    key={row.id}
                    row={row}
                    index={index}
                    errors={review.rowErrors[row.id] ?? []}
                    onChange={(patch) => updateRow(row.id, patch)}
                    onDelete={() =>
                      setRows((current) => current.filter((item) => item.id !== row.id))
                    }
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRows((current) => [...current, emptyDraftRow(current.length)])}
              >
                <Plus /> {t("addRow")}
              </Button>

              {review.issues.map((issue) => (
                <p
                  key={`${issue.code}-${issue.target}`}
                  className="text-sm text-amber-700 dark:text-amber-300"
                >
                  {issue.code}: {issue.target}
                </p>
              ))}
              {(importer.error || localError) && <ErrorNotice message={t("importSaveFailed")} />}
              <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
                <Button variant="ghost" onClick={() => setStep("upload")}>
                  {t("back")}
                </Button>
                <Button
                  onClick={() => void confirmImport()}
                  disabled={!review.canConfirm || importer.isImporting}
                >
                  <CheckCircle2 /> {importer.isImporting ? t("loading") : t("confirmAndSave")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t("coursesTitle")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("setupCombinedHint")}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setShowImport(true);
            setStep("upload");
            importer.reset();
          }}
        >
          {t("newImport")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("profileDetails")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="major" className="mb-1 block text-xs">
                {t("major")}
              </Label>
              <Input
                id="major"
                defaultValue={profile.profile?.major ?? ""}
                onBlur={(event) => void profile.save({ major: event.target.value || null })}
              />
            </div>
            <div>
              <Label htmlFor="degree" className="mb-1 block text-xs">
                {t("degree")}
              </Label>
              <Input
                id="degree"
                defaultValue={profile.profile?.degree ?? ""}
                onBlur={(event) => void profile.save({ degree: event.target.value || null })}
              />
            </div>
            <div>
              <Label htmlFor="semester" className="mb-1 block text-xs">
                {t("semester")}
              </Label>
              <Input
                id="semester"
                type="number"
                min={1}
                max={20}
                defaultValue={profile.profile?.semester ?? ""}
                onBlur={(event) =>
                  void profile.save({
                    semester: event.target.value ? Number(event.target.value) : null,
                  })
                }
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="w-full text-xs font-medium">{t("gender")}</span>
            {(["male", "female"] as const).map((gender) => (
              <Button
                key={gender}
                variant={profile.profile?.gender === gender ? "default" : "outline"}
                onClick={() => void profile.save({ gender })}
                disabled={profile.isSaving}
              >
                {t(gender)}
              </Button>
            ))}
            <p className="w-full text-xs text-muted-foreground">{t("genderHint")}</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {catalog.data!.courses.map((course) => {
          const choice = coursePreferences.byCourseId[course.id] ?? "neutral";
          const status = statusFor(course.code, student.state);
          return (
            <Card key={course.id}>
              <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr_auto_auto] md:items-center">
                <div>
                  <p className="font-semibold" dir="auto">
                    {lang === "fa" ? course.nameFa : course.nameEn}
                  </p>
                  <p className="text-xs text-muted-foreground" dir="ltr">
                    {course.code} · {num(course.credits)} {t("credits")}
                  </p>
                </div>
                <div>
                  <Label htmlFor={`status-${course.id}`} className="mb-1 block text-xs">
                    {t("academicStatus")}
                  </Label>
                  <select
                    id={`status-${course.id}`}
                    value={status ?? "none"}
                    onChange={(event) => {
                      const next =
                        event.target.value === "none"
                          ? null
                          : (event.target.value as StudentCourseStatus);
                      student.save(changeStatus(student.state, course.code, next));
                    }}
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="none">{t("none")}</option>
                    <option value="passed">{t("passed")}</option>
                    <option value="current">{t("current")}</option>
                    <option value="failed">{t("failed")}</option>
                    <option value="required">{t("required")}</option>
                    <option value="avoid">{t("avoid")}</option>
                  </select>
                </div>
                <div
                  className="flex flex-wrap gap-1"
                  role="group"
                  aria-label={t("coursePreference")}
                >
                  {(["take", "neutral", "skip"] as CoursePreference[]).map((value) => (
                    <Button
                      key={value}
                      size="sm"
                      variant={choice === value ? "default" : "outline"}
                      onClick={() =>
                        coursePreferences.setPreference({ courseId: course.id, preference: value })
                      }
                    >
                      {t(
                        value === "take"
                          ? "prefTake"
                          : value === "skip"
                            ? "prefSkip"
                            : "prefNeutral",
                      )}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={() => void navigate({ to: "/preferences" })}>{t("continue")}</Button>
      </div>
    </div>
  );
}

function ReviewRow({
  row,
  index,
  errors,
  onChange,
  onDelete,
}: {
  row: ImportDraftRow;
  index: number;
  errors: string[];
  onChange: (patch: Partial<ImportDraftRow>) => void;
  onDelete: () => void;
}) {
  const { t, num, lang } = useI18n();
  const field = (key: keyof ImportDraftRow, label: string, options?: Array<[string, string]>) => (
    <div className={key === "classSchedule" || key === "examSchedule" ? "sm:col-span-2" : ""}>
      <Label htmlFor={`${row.id}-${key}`} className="mb-1 block text-xs">
        {label}
      </Label>
      {options ? (
        <select
          id={`${row.id}-${key}`}
          value={String(row[key])}
          onChange={(event) => onChange({ [key]: event.target.value })}
          className="h-9 w-full rounded-md border bg-background px-2 text-sm"
        >
          {options.map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      ) : (
        <Input
          id={`${row.id}-${key}`}
          value={String(row[key] ?? "")}
          onChange={(event) => onChange({ [key]: event.target.value })}
          dir="auto"
        />
      )}
    </div>
  );
  return (
    <section
      className={`rounded-lg border p-4 ${errors.length ? "border-destructive" : ""}`}
      aria-label={`${t("section")} ${num(index + 1)}`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">
            {t("section")} {num(index + 1)}
          </p>
          {row.uncertainty && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="me-1 inline size-3" />
              {localizedError(row.uncertainty, lang)}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDelete}
          aria-label={t("deleteRow")}
        >
          <Trash2 />
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {field("courseCode", t("courseCode"))}
        {field("courseName", t("courseName"))}
        {field("groupNumber", t("section"))}
        {field("units", t("credits"))}
        {field("capacity", t("capacity"))}
        {field("professor", t("professor"))}
        {field("gender", t("gender"), [
          ["mixed", t("mixed")],
          ["male", t("male")],
          ["female", t("female")],
        ])}
        {field("classSchedule", t("classTime"))}
        {field("examSchedule", t("exam"))}
      </div>
      {errors.length > 0 && (
        <ul className="mt-3 list-inside list-disc text-xs text-destructive">
          {errors.map((error) => (
            <li key={error}>{localizedError(error, lang)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
      <AlertTriangle className="me-2 inline size-4" />
      {message}
    </p>
  );
}

function localizedError(code: string, lang: "fa" | "en"): string {
  const labels: Record<string, { fa: string; en: string }> = {
    missing_code: { fa: "کد درس وارد نشده است.", en: "Course code is required." },
    missing_name: { fa: "نام درس وارد نشده است.", en: "Course name is required." },
    invalid_credits: { fa: "تعداد واحد معتبر نیست.", en: "Credits are invalid." },
    invalid_capacity: { fa: "ظرفیت معتبر نیست.", en: "Capacity is invalid." },
    unreadable_class_time: { fa: "زمان کلاس خوانده نشد.", en: "Class time could not be read." },
    unreadable_exam_time: { fa: "زمان امتحان خوانده نشد.", en: "Exam time could not be read." },
    duplicate_section: {
      fa: "این کد درس و گروه تکراری است.",
      en: "This course and section is duplicated.",
    },
    conflicting_course_metadata: {
      fa: "نام یا واحد این درس در ردیف‌ها یکسان نیست.",
      en: "This course has conflicting names or credits.",
    },
    image_extraction_unavailable: {
      fa: "تشخیص تصویر روی این مرورگر فعال نیست؛ ردیف‌ها را دستی وارد کنید.",
      en: "Image recognition is unavailable in this browser; enter the rows manually.",
    },
    image_has_no_text: { fa: "متنی در تصویر پیدا نشد.", en: "No text was found in the image." },
    invalid_json: { fa: "فایل JSON معتبر نیست.", en: "The JSON is invalid." },
  };
  return labels[code]?.[lang] ?? code;
}

function statusFor(
  code: string,
  state: ReturnType<typeof useStudentState>["state"],
): StudentCourseStatus | null {
  for (const status of [
    "passed",
    "current",
    "failed",
    "required",
    "avoid",
  ] as StudentCourseStatus[]) {
    if (state[status].includes(code)) return status;
  }
  return null;
}

function changeStatus(
  state: ReturnType<typeof useStudentState>["state"],
  code: string,
  status: StudentCourseStatus | null,
) {
  const next = {
    ...state,
    passed: state.passed.filter((item) => item !== code),
    current: state.current.filter((item) => item !== code),
    failed: state.failed.filter((item) => item !== code),
    required: state.required.filter((item) => item !== code),
    avoid: state.avoid.filter((item) => item !== code),
    overrides: { ...state.overrides },
  };
  if (status) next[status].push(code);
  return next;
}
