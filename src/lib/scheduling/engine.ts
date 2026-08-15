import { examsOverlap, meetingSetsConflict, meetingsOverlap, toMinutes } from "./time";
import {
  CLASS_DAYS,
  DAY_END,
  DAY_START,
  type Course,
  type CoursePreferenceMap,
  type Plan,
  type PlanEntry,
  type Preferences,
  type Refinement,
  type Section,
} from "./types";

export const MAX_CANDIDATE_PLANS = 100;
const MAX_RAW_SOLUTIONS = 4000;
const MAX_NODES = 400_000;

export interface SolveInput {
  courses: Course[];
  sections: Section[];
  /** courseCode -> take | neutral | skip */
  coursePreferences: CoursePreferenceMap;
  preferences: Preferences;
  refinements: Refinement[];
}

export type BlockReason =
  | { kind: "no_courses" }
  | { kind: "take_no_valid_section"; courseCode: string }
  | { kind: "take_over_max"; credits: number; max: number }
  | { kind: "not_enough_credits"; available: number; min: number }
  | { kind: "take_class_conflict"; a: string; b: string }
  | { kind: "take_exam_conflict"; a: string; b: string }
  | { kind: "refinement_too_strict" };

export interface SolveResult {
  plans: Plan[];
  totalFound: number;
  truncated: boolean;
  blockers: BlockReason[];
}

interface CourseOption {
  course: Course;
  sections: Section[];
  mandatory: boolean;
}

/** A section is usable only if it satisfies every hard constraint on its own. */
export function isSectionAllowed(
  section: Section,
  preferences: Preferences,
  refinements: Refinement[] = [],
): boolean {
  if (preferences.gender === "male" && section.gender === "female") return false;
  if (preferences.gender === "female" && section.gender === "male") return false;

  const dayStart = toMinutes(DAY_START);
  const dayEnd = toMinutes(DAY_END);

  for (const meeting of section.meetings) {
    if (!CLASS_DAYS.includes(meeting.day)) return false;
    if (toMinutes(meeting.start) < dayStart) return false;
    if (toMinutes(meeting.end) > dayEnd) return false;
    if (toMinutes(meeting.end) <= toMinutes(meeting.start)) return false;
    for (const blocked of preferences.blockedTimes) {
      if (meetingsOverlap(meeting, blocked)) return false;
    }
  }

  for (const refinement of refinements) {
    if (refinement.kind === "professor" && refinement.courseCode === section.courseCode) {
      if ((section.professor ?? "") !== refinement.professor) return false;
    }
    if (refinement.kind === "section" && refinement.courseCode === section.courseCode) {
      if (section.id !== refinement.sectionId) return false;
    }
  }

  return true;
}

export function solve(input: SolveInput): SolveResult {
  const { courses, sections, coursePreferences, preferences, refinements } = input;
  const blockers: BlockReason[] = [];

  const forcedInclude = new Set(
    refinements.filter((r) => r.kind === "includeCourse").map((r) => r.courseCode),
  );
  const forcedExclude = new Set(
    refinements.filter((r) => r.kind === "excludeCourse").map((r) => r.courseCode),
  );

  const sectionsByCourse = new Map<string, Section[]>();
  for (const section of sections) {
    const list = sectionsByCourse.get(section.courseCode) ?? [];
    list.push(section);
    sectionsByCourse.set(section.courseCode, list);
  }

  const options: CourseOption[] = [];
  for (const course of courses) {
    const preference = coursePreferences[course.code] ?? "neutral";
    if (preference === "skip") continue;
    if (forcedExclude.has(course.code)) continue;

    const mandatory = preference === "take" || forcedInclude.has(course.code);
    const usable = (sectionsByCourse.get(course.code) ?? []).filter((s) =>
      isSectionAllowed(s, preferences, refinements),
    );

    if (usable.length === 0) {
      if (mandatory) blockers.push({ kind: "take_no_valid_section", courseCode: course.code });
      continue;
    }
    options.push({ course, sections: usable, mandatory });
  }

  if (options.length === 0) {
    blockers.push({ kind: "no_courses" });
    return { plans: [], totalFound: 0, truncated: false, blockers };
  }

  const mandatoryOptions = options.filter((o) => o.mandatory);
  const mandatoryCredits = mandatoryOptions.reduce((sum, o) => sum + o.course.credits, 0);
  if (mandatoryCredits > preferences.maxCredits) {
    blockers.push({ kind: "take_over_max", credits: mandatoryCredits, max: preferences.maxCredits });
  }
  const availableCredits = options.reduce((sum, o) => sum + o.course.credits, 0);
  if (availableCredits < preferences.minCredits) {
    blockers.push({ kind: "not_enough_credits", available: availableCredits, min: preferences.minCredits });
  }

  for (let i = 0; i < mandatoryOptions.length; i++) {
    for (let j = i + 1; j < mandatoryOptions.length; j++) {
      const a = mandatoryOptions[i]!;
      const b = mandatoryOptions[j]!;
      let classOk = false;
      let examOk = false;
      for (const sa of a.sections) {
        for (const sb of b.sections) {
          if (!meetingSetsConflict(sa.meetings, sb.meetings)) classOk = true;
          if (!examsOverlap(sa.exam, sb.exam)) examOk = true;
        }
      }
      if (!classOk) blockers.push({ kind: "take_class_conflict", a: a.course.code, b: b.course.code });
      else if (!examOk) blockers.push({ kind: "take_exam_conflict", a: a.course.code, b: b.course.code });
    }
  }

  if (blockers.length > 0) {
    return { plans: [], totalFound: 0, truncated: false, blockers };
  }

  // Most constrained first keeps the search small.
  const ordered = [...options].sort((a, b) => {
    if (a.mandatory !== b.mandatory) return a.mandatory ? -1 : 1;
    if (a.sections.length !== b.sections.length) return a.sections.length - b.sections.length;
    return b.course.credits - a.course.credits;
  });

  const suffixCredits: number[] = new Array(ordered.length + 1).fill(0);
  const suffixMandatory: number[] = new Array(ordered.length + 1).fill(0);
  for (let i = ordered.length - 1; i >= 0; i--) {
    suffixCredits[i] = suffixCredits[i + 1]! + ordered[i]!.course.credits;
    suffixMandatory[i] = suffixMandatory[i + 1]! + (ordered[i]!.mandatory ? ordered[i]!.course.credits : 0);
  }

  const solutions: Section[][] = [];
  const chosen: Section[] = [];
  let nodes = 0;
  let truncated = false;

  const conflicts = (section: Section): boolean => {
    for (const s of chosen) {
      if (meetingSetsConflict(s.meetings, section.meetings)) return true;
      if (examsOverlap(s.exam, section.exam)) return true;
    }
    return false;
  };

  const recurse = (index: number, credits: number): void => {
    if (truncated) return;
    if (++nodes > MAX_NODES) {
      truncated = true;
      return;
    }
    if (
      index >= ordered.length &&
      credits >= preferences.minCredits &&
      credits <= preferences.maxCredits
    ) {
      solutions.push([...chosen]);
      if (solutions.length >= MAX_RAW_SOLUTIONS) truncated = true;
      return;
    }
    if (index >= ordered.length) return;
    if (credits + suffixCredits[index]! < preferences.minCredits) return;
    if (credits + suffixMandatory[index]! > preferences.maxCredits) return;

    const option = ordered[index]!;
    const nextCredits = credits + option.course.credits;
    if (nextCredits <= preferences.maxCredits) {
      for (const section of option.sections) {
        if (conflicts(section)) continue;
        chosen.push(section);
        recurse(index + 1, nextCredits);
        chosen.pop();
        if (truncated) return;
      }
    }
    // Optional courses may also be left out.
    if (!option.mandatory) recurse(index + 1, credits);
  };

  recurse(0, 0);

  const plans = solutions
    .map((combo, i) => buildPlan(`plan-${i}`, combo, options, preferences))
    .filter((plan) => matchesPlanRefinements(plan, refinements))
    .sort((a, b) => b.score - a.score);

  withMatchScores(plans);
  const diversified = diversify(plans, MAX_CANDIDATE_PLANS);

  return {
    plans: diversified,
    totalFound: plans.length,
    truncated: truncated || plans.length > diversified.length,
    blockers: plans.length === 0 ? [{ kind: "refinement_too_strict" }] : [],
  };
}

/** Refinements that can only be judged once a whole schedule exists. */
function matchesPlanRefinements(plan: Plan, refinements: Refinement[]): boolean {
  for (const refinement of refinements) {
    if (refinement.kind === "freeDay" && !plan.freeDays.includes(refinement.day)) return false;
    if (refinement.kind === "maxClassDays" && plan.classDays.length > refinement.value) return false;
    if (refinement.kind === "includeCourse") {
      if (!plan.entries.some((e) => e.course.code === refinement.courseCode)) return false;
    }
    if (refinement.kind === "excludeCourse") {
      if (plan.entries.some((e) => e.course.code === refinement.courseCode)) return false;
    }
  }
  return true;
}

/** Turns raw scores into a 0–100 display value relative to the best plan found. */
function withMatchScores(plans: Plan[]): void {
  if (plans.length === 0) return;
  const scores = plans.map((p) => p.score);
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const span = max - min;
  for (const plan of plans) {
    plan.match = span <= 0 ? 100 : Math.round(60 + ((plan.score - min) / span) * 40);
  }
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
  for (const entry of entries) {
    for (const meeting of entry.section.meetings) {
      dayset.add(meeting.day);
      earliest = Math.min(earliest, toMinutes(meeting.start));
      latest = Math.max(latest, toMinutes(meeting.end));
    }
  }
  const classDays = [...dayset].sort((a, b) => a - b);
  const freeDays = CLASS_DAYS.filter((d) => !dayset.has(d));

  // Soft ranking only: fuller, tighter, fewer-day schedules float to the top.
  const mid = (preferences.minCredits + preferences.maxCredits) / 2;
  const score =
    credits * 0.6 - Math.abs(credits - mid) * 0.3 + freeDays.length * 1.5 - (latest - earliest) / 240;

  return {
    id,
    entries,
    credits,
    classDays,
    freeDays,
    earliestStart: earliest === Infinity ? "--:--" : minutesToLabel(earliest),
    latestEnd: latest === -Infinity ? "--:--" : minutesToLabel(latest),
    score: Number.isFinite(score) ? score : 0,
    match: 100,
  };
}

function minutesToLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Removes near-duplicate schedules so the student sees genuinely different options. */
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
