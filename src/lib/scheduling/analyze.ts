import { CLASS_DAYS, type Plan, type Refinement } from "./types";

export interface DifferenceOption {
  key: string;
  /** Raw value used for labelling in the UI layer. */
  value: string | number;
  count: number;
  refinement: Refinement;
}

export interface DifferenceGroup {
  id: string;
  type: "professor" | "freeDay" | "classDays" | "course";
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
          refinement: { kind: "professor", courseCode: code, professor } satisfies Refinement,
        })),
    });
  }

  // Days that are free in some plans but not all
  const freeDayOptions: DifferenceOption[] = [];
  for (const day of CLASS_DAYS) {
    const withFree = plans.filter((p) => p.freeDays.includes(day)).length;
    if (withFree === 0 || withFree === plans.length) continue;
    freeDayOptions.push({
      key: `freeDay:${day}`,
      value: day,
      count: withFree,
      refinement: { kind: "freeDay", day } satisfies Refinement,
    });
  }
  if (freeDayOptions.length > 0) {
    groups.push({ id: "freeDay", type: "freeDay", courseCode: null, options: freeDayOptions });
  }

  // Number of class days
  const dayLengths = new Set(plans.map((p) => p.classDays.length));
  if (dayLengths.size > 1) {
    groups.push({
      id: "classDays",
      type: "classDays",
      courseCode: null,
      options: [...dayLengths]
        .sort((a, b) => a - b)
        .slice(0, 4)
        .map((value) => ({
          key: `classDays:${value}`,
          value,
          count: plans.filter((p) => p.classDays.length <= value).length,
          refinement: { kind: "maxClassDays", value } satisfies Refinement,
        })),
    });
  }

  // Optional courses present in some plans but not all
  const optionalOptions: DifferenceOption[] = [];
  for (const [code, appearances] of courseAppearance) {
    if (appearances === plans.length) continue;
    optionalOptions.push({
      key: `include:${code}`,
      value: code,
      count: appearances,
      refinement: { kind: "includeCourse", courseCode: code } satisfies Refinement,
    });
  }
  if (optionalOptions.length > 0) {
    groups.push({
      id: "course",
      type: "course",
      courseCode: null,
      options: optionalOptions.sort((a, b) => b.count - a.count).slice(0, 8),
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
