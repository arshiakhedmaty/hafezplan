import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { usePreferences } from "@/lib/data/hooks";
import { useI18n } from "@/lib/i18n";
import { WEEKDAYS, type Meeting, type Preferences } from "@/lib/scheduling";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/preferences")({
  head: () => ({
    meta: [
      { title: "Preferences — HafezPlan" },
      {
        name: "description",
        content: "Set credit limits, blocked times and preferred free days for your semester plan.",
      },
      { property: "og:title", content: "Preferences — HafezPlan" },
      { property: "og:description", content: "Tell HafezPlan your real scheduling constraints." },
    ],
  }),
  component: PreferencesPage,
});

function PreferencesPage() {
  const { t, num, dayShort } = useI18n();
  const preferenceState = usePreferences();
  const { preferences, isLoading, save } = preferenceState;
  const [draft, setDraft] = useState<Meeting>({ day: 0, start: "08:00", end: "10:00" });

  const update = (patch: Partial<Preferences>) => save({ ...preferences, ...patch });
  const creditRangeValid =
    preferences.minCredits >= 12 &&
    preferences.maxCredits <= 24 &&
    preferences.minCredits <= preferences.maxCredits;
  const semesterRangeValid =
    (!preferences.semesterStart && !preferences.semesterEnd) ||
    (Boolean(preferences.semesterStart) &&
      Boolean(preferences.semesterEnd) &&
      preferences.semesterStart! <= preferences.semesterEnd!);
  const dailyRangeValid =
    !preferences.noEarlierThan ||
    !preferences.noLaterThan ||
    preferences.noEarlierThan <= preferences.noLaterThan;
  const canGenerate = creditRangeValid && semesterRangeValid && dailyRangeValid;

  const toggleFreeDay = (day: number) =>
    update({
      preferredFreeDays: preferences.preferredFreeDays.includes(day)
        ? preferences.preferredFreeDays.filter((d) => d !== day)
        : [...preferences.preferredFreeDays, day],
    });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (preferenceState.error) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">{t("dataLoadFailed")}</p>
        <Button className="mt-4" variant="outline" onClick={() => void preferenceState.retry()}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl">{t("prefsTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("prefsSubtitle")}</p>
      </header>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="min">{t("minCredits")}</Label>
            <select
              id="min"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={preferences.minCredits}
              onChange={(event) => update({ minCredits: Number(event.target.value) })}
            >
              {Array.from({ length: 13 }, (_, index) => index + 12).map((value) => (
                <option key={value} value={value}>
                  {num(value)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="max">{t("maxCredits")}</Label>
            <select
              id="max"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={preferences.maxCredits}
              onChange={(event) => update({ maxCredits: Number(event.target.value) })}
            >
              {Array.from({ length: 13 }, (_, index) => index + 12).map((value) => (
                <option key={value} value={value}>
                  {num(value)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="early">{t("noEarlierThan")}</Label>
            <Input
              id="early"
              type="time"
              dir="ltr"
              value={preferences.noEarlierThan ?? ""}
              onChange={(e) => update({ noEarlierThan: e.target.value || null })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="late">{t("noLaterThan")}</Label>
            <Input
              id="late"
              type="time"
              dir="ltr"
              value={preferences.noLaterThan ?? ""}
              onChange={(e) => update({ noLaterThan: e.target.value || null })}
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-lg">{t("semesterDates")}</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="semester-start">{t("semesterStart")}</Label>
            <Input
              id="semester-start"
              type="date"
              dir="ltr"
              value={preferences.semesterStart ?? ""}
              onChange={(event) => update({ semesterStart: event.target.value || null })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="semester-end">{t("semesterEnd")}</Label>
            <Input
              id="semester-end"
              type="date"
              dir="ltr"
              min={preferences.semesterStart ?? undefined}
              value={preferences.semesterEnd ?? ""}
              onChange={(event) => update({ semesterEnd: event.target.value || null })}
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-lg">{t("preferredFreeDays")}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleFreeDay(day)}
              className={cn(
                "min-w-12 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                preferences.preferredFreeDays.includes(day)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {dayShort(day)}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-1.5">
          <Label htmlFor="maxdays">{t("maxClassDays")}</Label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => update({ maxClassDays: null })}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm",
                preferences.maxClassDays == null
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {t("anyValue")}
            </button>
            {[2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => update({ maxClassDays: value })}
                className={cn(
                  "min-w-10 rounded-full border px-3 py-1.5 text-sm",
                  preferences.maxClassDays === value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {num(value)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-lg">{t("blockedTimes")}</h2>
        <ul className="mt-3 space-y-2">
          {preferences.blockedTimes.map((block, index) => (
            <li
              key={`${block.day}-${block.start}-${index}`}
              className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">
                {dayShort(block.day)} ·{" "}
                <span dir="ltr">
                  {block.start}–{block.end}
                </span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                onClick={() =>
                  update({ blockedTimes: preferences.blockedTimes.filter((_, i) => i !== index) })
                }
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={draft.day}
            onChange={(e) => setDraft({ ...draft, day: Number(e.target.value) })}
          >
            {WEEKDAYS.map((day) => (
              <option key={day} value={day}>
                {dayShort(day)}
              </option>
            ))}
          </select>
          <Input
            type="time"
            dir="ltr"
            value={draft.start}
            onChange={(e) => setDraft({ ...draft, start: e.target.value })}
          />
          <Input
            type="time"
            dir="ltr"
            value={draft.end}
            onChange={(e) => setDraft({ ...draft, end: e.target.value })}
          />
          <Button
            variant="outline"
            disabled={!draft.start || !draft.end || draft.start >= draft.end}
            onClick={() => update({ blockedTimes: [...preferences.blockedTimes, draft] })}
          >
            <Plus className="size-4" />
            {t("addBlockedTime")}
          </Button>
        </div>
      </section>

      {!canGenerate ? (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {t("preferencesInvalid")}
        </p>
      ) : null}
      <div className="flex justify-end">
        {canGenerate ? (
          <Button asChild size="lg">
            <Link to="/plans">{t("generate")}</Link>
          </Button>
        ) : (
          <Button size="lg" disabled>
            {t("generate")}
          </Button>
        )}
      </div>
    </div>
  );
}
