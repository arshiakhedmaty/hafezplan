import type { Plan, Refinement } from "./types";

export interface DifferenceOption {
  key: string;
  /** Raw value used for labelling in the UI layer. */
  value: string | number;
  count: number;
  refinement: Refinement;
}

export interface DifferenceGroup {
  id: string;
  type: "professor" | "freeDay" | "classDays" | "credits" | "courseDay";
  courseCode: string | null;
  options: DifferenceOption[];
}

/**
 * Looks at the current candidate plans and reports only the dimensions that
 * genuinely differ between them. Nothing is offered that every plan already has.
 */
export function analyzeDifferences(plans: Plan[]): DifferenceGroup[] {
  if (plans.length < 2) return [];
  const groups: DifferenceGroup[] = [];

  // Professors per course
  const professorsByCourse = new Map<string, Map<string, number>>();
  const courseAppearance = new Map<string, number>();
  for (const plan of plans) {
    for (const entry of plan.entries) {
      const code = entry.course.code;
      courseAppearance.set(code, (courseAppearance.get(code) ?? 0) + 1);
      const professor = entry.section.professor ?? "";
      if (!professor) continue;
      const map = professorsByCourse.get(code) ?? new Map<string, number>();
      map.set(professor, (map.get(professor) ?? 0) + 1);
      professorsByCourse.set(code, map);
    }
  }
  for (const [code, map] of professorsByCourse) {
    if (map.size < 2) continue;
    groups.push({
      id: `professor:${code}`,
      type: "professor",
      courseCode: code,
      options: [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([professor, count]) => ({
          key: `${code}:${professor}`,
          value: professor,
          count,
          refinement: { kind: "professor", courseCode: code, professor } as Refinement,
        })),
    });
  }

  // Free days that are free in some plans but not all
  for (let day = 0; day < 7; day++) {
    const withFree = plans.filter((p) => p.freeDays.includes(day)).length;
    if (withFree === 0 || withFree === plans.length) continue;
    groups.push({
      id: `freeDay:${day}`,
      type: "freeDay",
      courseCode: null,
      options: [
        {
          key: `freeDay:${day}`,
          value: day,
          count: withFree,
          refinement: { kind: "freeDay", day } as Refinement,
        },
      ],
    });
  }

  // Number of class days
  const dayCounts = new Map<number, number>();
  for (const plan of plans) dayCounts.set(plan.classDays.length, (dayCounts.get(plan.classDays.length) ?? 0) + 1);
  if (dayCounts.size > 1) {
    groups.push({
      id: "classDays",
      type: "classDays",
      courseCode: null,
      options: [...dayCounts.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([value, count]) => ({
          key: `classDays:${value}`,
          value,
          count: plans.filter((p) => p.classDays.length <= value).length,
          refinement: { kind: "maxClassDays", value } as Refinement,
        }))
        .slice(0, 3),
    });
  }

  // Day a specific course lands on (only for courses in every plan)
  for (const [code, appearances] of courseAppearance) {
    if (appearances !== plans.length) continue;
    const dayCount = new Map<number, number>();
    for (const plan of plans) {
      const entry = plan.entries.find((e) => e.course.code === code);
      if (!entry) continue;
      const days = new Set(entry.section.meetings.map((m) => m.day));
      for (const d of days) dayCount.set(d, (dayCount.get(d) ?? 0) + 1);
    }
    if (dayCount.size < 2) continue;
    if (professorsByCourse.get(code)?.size ?? 0 > 1) {
      // professor group already communicates this difference
    }
    groups.push({
      id: `courseDay:${code}`,
      type: "courseDay",
      courseCode: code,
      options: [...dayCount.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([day, count]) => ({
          key: `courseDay:${code}:${day}`,
          value: day,
          count,
          refinement: { kind: "courseDay", courseCode: code, day } as Refinement,
        })),
    });
  }

  // Credit loads
  const creditCounts = new Map<number, number>();
  for (const plan of plans) creditCounts.set(plan.credits, (creditCounts.get(plan.credits) ?? 0) + 1);
  if (creditCounts.size > 1) {
    groups.push({
      id: "credits",
      type: "credits",
      courseCode: null,
      options: [...creditCounts.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([value, count]) => ({
          key: `credits:${value}`,
          value,
          count,
          refinement: { kind: "maxClassDays", value: 7 } as Refinement,
        }))
        .slice(0, 4),
    });
  }

  return groups;
}

/** Meaningful differences between a small set of plans, for the compare view. */
export interface ComparisonRow {
  type: "credits" | "classDays" | "freeDays" | "earliest" | "latest" | "professor";
  courseCode: string | null;
  values: (string | number)[];
  differs: boolean;
}

export function comparePlans(plans: Plan[]): ComparisonRow[] {
  if (plans.length === 0) return [];
  const rows: ComparisonRow[] = [];
  const push = (type: ComparisonRow["type"], courseCode: string | null, values: (string | number)[]) => {
    const differs = new Set(values.map(String)).size > 1;
    rows.push({ type, courseCode, values, differs });
  };

  push("credits", null, plans.map((p) => p.credits));
  push("classDays", null, plans.map((p) => p.classDays.length));
  push("freeDays", null, plans.map((p) => p.freeDays.join(",")));
  push("earliest", null, plans.map((p) => p.earliestStart));
  push("latest", null, plans.map((p) => p.latestEnd));

  const codes = new Set<string>();
  for (const plan of plans) for (const e of plan.entries) codes.add(e.course.code);
  for (const code of codes) {
    push(
      "professor",
      code,
      plans.map((p) => {
        const entry = p.entries.find((e) => e.course.code === code);
        return entry ? `${entry.section.professor ?? "—"} (${entry.section.sectionName})` : "—";
      }),
    );
  }

  return rows.filter((r) => r.differs || r.type === "credits" || r.type === "classDays");
}
