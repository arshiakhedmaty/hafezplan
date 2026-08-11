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
      { name: "description", content: "Set credit limits, blocked times and preferred free days for your semester plan." },
      { property: "og:title", content: "Preferences — HafezPlan" },
      { property: "og:description", content: "Tell HafezPlan your real scheduling constraints." },
    ],
  }),
  component: PreferencesPage,
});

function PreferencesPage() {
  const { t, num, dayShort } = useI18n();
  const { preferences, isLoading, save } = usePreferences();
  const [draft, setDraft] = useState<Meeting>({ day: 0, start: "08:00", end: "10:00" });

  const update = (patch: Partial<Preferences>) => save({ ...preferences, ...patch });

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
            <Input
              id="min"
              type="number"
              min={0}
              max={30}
              value={preferences.minCredits}
              onChange={(e) => update({ minCredits: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="max">{t("maxCredits")}</Label>
            <Input
              id="max"
              type="number"
              min={1}
              max={30}
              value={preferences.maxCredits}
              onChange={(e) => update({ maxCredits: Number(e.target.value) })}
            />
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
                {dayShort(block.day)} · <span dir="ltr">{block.start}–{block.end}</span>
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
            onClick={() => update({ blockedTimes: [...preferences.blockedTimes, draft] })}
          >
            <Plus className="size-4" />
            {t("addBlockedTime")}
          </Button>
        </div>
      </section>

      <div className="flex justify-end">
        <Button asChild size="lg">
          <Link to="/plans">{t("generate")}</Link>
        </Button>
      </div>
    </div>
  );
}
