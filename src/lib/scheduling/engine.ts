import { evaluateEligibility, type CourseEligibility } from "./eligibility";
import { examsOverlap, meetingSetsConflict, meetingsOverlap, toMinutes } from "./time";
import type { Course, Plan, PlanEntry, Preferences, Refinement, Section, StudentState } from "./types";

export const MAX_CANDIDATE_PLANS = 100;
/** Safety valves so the search never explodes on large catalogs. */
const MAX_RAW_SOLUTIONS = 4000;
const MAX_NODES = 400_000;

export interface SolveInput {
  courses: Course[];
  sections: Section[];
  student: StudentState;
  preferences: Preferences;
  refinements: Refinement[];
}

export type BlockReason =
  | { kind: "required_not_eligible"; courseCode: string; detail: CourseEligibility }
  | { kind: "required_over_max"; credits: number; max: number }
  | { kind: "required_class_conflict"; a: string; b: string }
  | { kind: "required_exam_conflict"; a: string; b: string }
  | { kind: "required_blocked_by_personal_time"; courseCode: string }
  | { kind: "refinement_too_strict" }
  | { kind: "not_enough_credits"; available: number; min: number }
  | { kind: "no_eligible_courses" };

export interface SolveResult {
  plans: Plan[];
  /** Real number of distinct valid schedules found before diversity capping. */
  totalFound: number;
  truncated: boolean;
  eligibility: CourseEligibility[];
  blockers: BlockReason[];
}

interface CourseOption {
  course: Course;
  sections: Section[];
  required: boolean;
}

export function solve(input: SolveInput): SolveResult {
  const { courses, sections, student, preferences, refinements } = input;
  const eligibility = evaluateEligibility({ courses, sections, student });
  const blockers: BlockReason[] = [];

  const byCode = new Map(eligibility.map((e) => [e.course.code, e]));

  const includeOnly = refinements
    .filter((r): r is Extract<Refinement, { kind: "includeCourse" }> => r.kind === "includeCourse")
    .map((r) => r.courseCode);
  const excluded = new Set(
    refinements
      .filter((r): r is Extract<Refinement, { kind: "excludeCourse" }> => r.kind === "excludeCourse")
      .map((r) => r.courseCode),
  );

  // Required courses must be eligible.
  for (const code of student.required) {
    const detail = byCode.get(code);
    if (!detail || detail.status !== "eligible") {
      if (detail) blockers.push({ kind: "required_not_eligible", courseCode: code, detail });
    }
  }

  const options: CourseOption[] = [];
  for (const entry of eligibility) {
    if (entry.status !== "eligible") continue;
    if (excluded.has(entry.course.code)) continue;
    const filtered = filterSections(entry.sections, entry.course, preferences, refinements);
    const required = entry.required || includeOnly.includes(entry.course.code);
    if (filtered.length === 0) {
      if (required) {
        blockers.push({ kind: "required_blocked_by_personal_time", courseCode: entry.course.code });
      }
      continue;
    }
    options.push({ course: entry.course, sections: filtered, required });
  }

  if (options.length === 0) {
    blockers.push({ kind: "no_eligible_courses" });
    return { plans: [], totalFound: 0, truncated: false, eligibility, blockers };
  }

  const requiredOptions = options.filter((o) => o.required);
  const requiredCredits = requiredOptions.reduce((sum, o) => sum + o.course.credits, 0);
  if (requiredCredits > preferences.maxCredits) {
    blockers.push({ kind: "required_over_max", credits: requiredCredits, max: preferences.maxCredits });
  }
  const availableCredits = options.reduce((sum, o) => sum + o.course.credits, 0);
  if (availableCredits < preferences.minCredits) {
    blockers.push({ kind: "not_enough_credits", available: availableCredits, min: preferences.minCredits });
  }

  // Pairwise impossibility among required courses (all section combos conflict).
  for (let i = 0; i < requiredOptions.length; i++) {
    for (let j = i + 1; j < requiredOptions.length; j++) {
      const a = requiredOptions[i]!;
      const b = requiredOptions[j]!;
      let classOk = false;
      let examOk = false;
      for (const sa of a.sections) {
        for (const sb of b.sections) {
          if (!meetingSetsConflict(sa.meetings, sb.meetings)) classOk = true;
          if (!examsOverlap(sa.exam, sb.exam)) examOk = true;
        }
      }
      if (!classOk) blockers.push({ kind: "required_class_conflict", a: a.course.code, b: b.course.code });
      else if (!examOk) blockers.push({ kind: "required_exam_conflict", a: a.course.code, b: b.course.code });
    }
  }

  if (blockers.length > 0) {
    return { plans: [], totalFound: 0, truncated: false, eligibility, blockers };
  }

  const maxClassDays = maxClassDaysRefinement(refinements);
  const forcedFreeDays = refinements
    .filter((r): r is Extract<Refinement, { kind: "freeDay" }> => r.kind === "freeDay")
    .map((r) => r.day);

  // Order: required first, then fewest sections (most constrained), then most credits.
  const ordered = [...options].sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1;
    if (a.sections.length !== b.sections.length) return a.sections.length - b.sections.length;
    return b.course.credits - a.course.credits;
  });

  const suffixCredits: number[] = new Array(ordered.length + 1).fill(0);
  for (let i = ordered.length - 1; i >= 0; i--) {
    suffixCredits[i] = suffixCredits[i + 1]! + ordered[i]!.course.credits;
  }
  const suffixRequired: number[] = new Array(ordered.length + 1).fill(0);
  for (let i = ordered.length - 1; i >= 0; i--) {
    suffixRequired[i] = suffixRequired[i + 1]! + (ordered[i]!.required ? ordered[i]!.course.credits : 0);
  }

  const solutions: Section[][] = [];
  let nodes = 0;
  let truncated = false;
  const chosen: Section[] = [];

  const conflictsWithChosen = (section: Section): boolean => {
    for (const s of chosen) {
      if (meetingSetsConflict(s.meetings, section.meetings)) return true;
      if (examsOverlap(s.exam, section.exam)) return true;
    }
    return false;
  };

  const daysUsed = (): Set<number> => {
    const set = new Set<number>();
    for (const s of chosen) for (const m of s.meetings) set.add(m.day);
    return set;
  };

  const recurse = (index: number, credits: number): void => {
    if (truncated) return;
    if (++nodes > MAX_NODES) {
      truncated = true;
      return;
    }
    if (credits >= preferences.minCredits && credits <= preferences.maxCredits && chosen.length > 0) {
      solutions.push([...chosen]);
      if (solutions.length >= MAX_RAW_SOLUTIONS) {
        truncated = true;
        return;
      }
    }
    if (index >= ordered.length) return;
    // Prune: can we still reach the minimum?
    if (credits + suffixCredits[index]! < preferences.minCredits) return;
    // Prune: remaining required courses would blow the maximum.
    if (credits + suffixRequired[index]! > preferences.maxCredits) return;

    const option = ordered[index]!;
    const nextCredits = credits + option.course.credits;
    if (nextCredits <= preferences.maxCredits) {
      for (const section of option.sections) {
        if (conflictsWithChosen(section)) continue;
        if (forcedFreeDays.length || maxClassDays !== null) {
          const days = daysUsed();
          for (const m of section.meetings) days.add(m.day);
          if (forcedFreeDays.some((d) => days.has(d))) continue;
          if (maxClassDays !== null && days.size > maxClassDays) continue;
        }
        chosen.push(section);
        recurse(index + 1, nextCredits);
        chosen.pop();
        if (truncated) return;
      }
    }
    if (!option.required) recurse(index + 1, credits);
  };

  recurse(0, 0);

  const scored = solutions.map((sections, i) => buildPlan(String(i), sections, options, preferences));
  scored.sort((a, b) => b.score - a.score || a.entries.length - b.entries.length);

  const diverse = diversify(scored, MAX_CANDIDATE_PLANS);

  return {
    plans: diverse.map((plan, index) => ({ ...plan, id: `plan-${index + 1}` })),
    totalFound: scored.length,
    truncated,
    eligibility,
    blockers,
  };
}

function maxClassDaysRefinement(refinements: Refinement[]): number | null {
  let value: number | null = null;
  for (const r of refinements) {
    if (r.kind === "maxClassDays") value = value === null ? r.value : Math.min(value, r.value);
  }
  return value;
}

function filterSections(
  sections: Section[],
  course: Course,
  preferences: Preferences,
  refinements: Refinement[],
): Section[] {
  const professorPick = refinements.find(
    (r): r is Extract<Refinement, { kind: "professor" }> =>
      r.kind === "professor" && r.courseCode === course.code,
  );
  const sectionPick = refinements.find(
    (r): r is Extract<Refinement, { kind: "section" }> =>
      r.kind === "section" && r.courseCode === course.code,
  );
  const dayPick = refinements.filter(
    (r): r is Extract<Refinement, { kind: "courseDay" }> =>
      r.kind === "courseDay" && r.courseCode === course.code,
  );
  const earliest = refinements
    .filter((r): r is Extract<Refinement, { kind: "noEarlierThan" }> => r.kind === "noEarlierThan")
    .map((r) => toMinutes(r.time));
  const latest = refinements
    .filter((r): r is Extract<Refinement, { kind: "noLaterThan" }> => r.kind === "noLaterThan")
    .map((r) => toMinutes(r.time));
  const freeDays = refinements
    .filter((r): r is Extract<Refinement, { kind: "freeDay" }> => r.kind === "freeDay")
    .map((r) => r.day);
  const minStart = earliest.length ? Math.max(...earliest) : null;
  const maxEnd = latest.length ? Math.min(...latest) : null;

  return sections.filter((section) => {
    if (professorPick && (section.professor ?? "") !== professorPick.professor) return false;
    if (sectionPick && section.id !== sectionPick.sectionId) return false;
    if (dayPick.length && !dayPick.every((d) => section.meetings.some((m) => m.day === d.day))) return false;
    for (const m of section.meetings) {
      if (freeDays.includes(m.day)) return false;
      if (minStart !== null && toMinutes(m.start) < minStart) return false;
      if (maxEnd !== null && toMinutes(m.end) > maxEnd) return false;
      for (const blocked of preferences.blockedTimes) {
        if (meetingsOverlap(m, blocked)) return false;
      }
    }
    return true;
  });
}

function buildPlan(
  id: string,
  sections: Section[],
  options: CourseOption[],
  preferences: Preferences,
): Plan {
  const courseByCode = new Map(options.map((o) => [o.course.code, o.course]));
  const entries: PlanEntry[] = sections.map((section) => ({
    section,
    course: courseByCode.get(section.courseCode)!,
  }));
  const credits = entries.reduce((sum, e) => sum + e.course.credits, 0);
  const dayset = new Set<number>();
  let earliest = Infinity;
  let latest = -Infinity;
  for (const e of entries) {
    for (const m of e.section.meetings) {
      dayset.add(m.day);
      earliest = Math.min(earliest, toMinutes(m.start));
      latest = Math.max(latest, toMinutes(m.end));
    }
  }
  const classDays = [...dayset].sort((a, b) => a - b);
  const freeDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !dayset.has(d));

  const { score, match, matched } = scorePlan(entries, classDays, freeDays, credits, preferences);

  return {
    id,
    entries,
    credits,
    classDays,
    freeDays,
    earliestStart: earliest === Infinity ? "--:--" : minutesToLabel(earliest),
    latestEnd: latest === -Infinity ? "--:--" : minutesToLabel(latest),
    score,
    match,
    matchedPreferences: matched,
  };
}

function minutesToLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function scorePlan(
  entries: PlanEntry[],
  classDays: number[],
  freeDays: number[],
  credits: number,
  preferences: Preferences,
): { score: number; match: number; matched: string[] } {
  let score = 0;
  let possible = 0;
  let satisfied = 0;
  const matched: string[] = [];

  for (const [code, professor] of Object.entries(preferences.preferredProfessors)) {
    if (!professor) continue;
    const entry = entries.find((e) => e.course.code === code);
    if (!entry) continue;
    possible += 1;
    if ((entry.section.professor ?? "") === professor) {
      satisfied += 1;
      score += 6;
      matched.push(`professor:${code}`);
    }
  }

  for (const day of preferences.preferredFreeDays) {
    possible += 1;
    if (freeDays.includes(day)) {
      satisfied += 1;
      score += 5;
      matched.push(`freeDay:${day}`);
    }
  }

  for (const day of preferences.avoidDays) {
    possible += 1;
    if (!classDays.includes(day)) {
      satisfied += 1;
      score += 4;
      matched.push(`avoidDay:${day}`);
    } else {
      score -= 3;
    }
  }

  if (preferences.noEarlierThan) {
    possible += 1;
    const limit = toMinutes(preferences.noEarlierThan);
    const violations = entries.flatMap((e) => e.section.meetings).filter((m) => toMinutes(m.start) < limit);
    if (violations.length === 0) {
      satisfied += 1;
      score += 4;
      matched.push("noEarlierThan");
    } else score -= violations.length;
  }

  if (preferences.noLaterThan) {
    possible += 1;
    const limit = toMinutes(preferences.noLaterThan);
    const violations = entries.flatMap((e) => e.section.meetings).filter((m) => toMinutes(m.end) > limit);
    if (violations.length === 0) {
      satisfied += 1;
      score += 4;
      matched.push("noLaterThan");
    } else score -= violations.length;
  }

  if (preferences.maxClassDays) {
    possible += 1;
    if (classDays.length <= preferences.maxClassDays) {
      satisfied += 1;
      score += 4;
      matched.push("maxClassDays");
    }
  }

  // Gentle structural preferences, always applied.
  score += (7 - classDays.length) * 0.5;
  score += credits * 0.2;

  const match = possible === 0 ? 100 : Math.round((satisfied / possible) * 100);
  return { score, match, matched };
}

/**
 * Removes near-duplicate schedules so the student sees meaningfully different
 * options instead of dozens of almost identical ones.
 */
export function diversify(plans: Plan[], limit: number): Plan[] {
  const seenExact = new Set<string>();
  const seenShape = new Set<string>();
  const primary: Plan[] = [];
  const secondary: Plan[] = [];

  for (const plan of plans) {
    const exact = plan.entries
      .map((e) => e.section.id)
      .sort()
      .join("|");
    if (seenExact.has(exact)) continue;
    seenExact.add(exact);

    const shape = [
      plan.entries
        .map((e) => `${e.course.code}@${e.section.professor ?? ""}`)
        .sort()
        .join(","),
      plan.classDays.join(""),
      plan.credits,
    ].join("#");

    if (seenShape.has(shape)) {
      secondary.push(plan);
      continue;
    }
    seenShape.add(shape);
    primary.push(plan);
    if (primary.length >= limit) break;
  }

  if (primary.length >= limit) return primary.slice(0, limit);
  return [...primary, ...secondary].slice(0, limit);
}
