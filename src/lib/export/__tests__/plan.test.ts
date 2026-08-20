import { describe, expect, it } from "vitest";
import type { Plan } from "@/lib/scheduling";
import { planToCsv, planToExcelHtml, planToIcs, type ExportLabels } from "../plan";

const plan: Plan = {
  id: "plan-1",
  credits: 3,
  classDays: [0],
  freeDays: [1, 2, 3, 4, 5],
  earliestStart: "08:00",
  latestEnd: "10:00",
  score: 1,
  match: 100,
  entries: [
    {
      course: {
        id: "course-1",
        code: "PHY101",
        nameEn: 'Physics, "One"',
        nameFa: "فیزیک یک",
        credits: 3,
        repeatable: false,
        prerequisites: null,
        corequisites: null,
      },
      section: {
        id: "section-1",
        courseId: "course-1",
        courseCode: "PHY101",
        sectionName: "01",
        gender: "mixed",
        professor: "Dr. Hafez",
        capacity: 20,
        location: "A1",
        meetings: [{ day: 0, start: "08:00", end: "10:00" }],
        exam: { date: "2026-06-20", start: "09:00", end: "11:00" },
      },
    },
  ],
};

const labels: ExportLabels = {
  title: "Final plan",
  course: "Course",
  section: "Section",
  professor: "Professor",
  meetings: "Meetings",
  exam: "Exam",
  credits: "Credits",
  dayName: (day) => ["Saturday", "Sunday"][day] ?? "",
};

describe("plan exports", () => {
  it("produces UTF-8 CSV with correct escaping", () => {
    const csv = planToCsv(plan, labels);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"PHY101 — Physics, ""One"""');
    expect(csv).toContain("Saturday 08:00-10:00");
  });

  it("produces an Excel-compatible HTML table", () => {
    const html = planToExcelHtml(plan, labels);
    expect(html).toContain("<table>");
    expect(html).toContain("Physics, &quot;One&quot;");
    expect(html).toContain("Dr. Hafez");
  });

  it("produces recurring class and one-off exam calendar events", () => {
    const ics = planToIcs(plan, { start: "2026-02-01", end: "2026-05-31" });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("RRULE:FREQ=WEEKLY");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("DTSTART:20260207T080000");
    expect(ics).toContain("DTSTART:20260620T090000");
  });

  it("requires a valid Gregorian semester range for ICS", () => {
    expect(() => planToIcs(plan, { start: null, end: null })).toThrow("semester_dates_required");
    expect(() => planToIcs(plan, { start: "2026-09-01", end: "2026-02-01" })).toThrow(
      "semester_dates_required",
    );
  });
});
