import { evaluateEligibility } from "./eligibility";
import { evaluatePrereq } from "./prereq";
import { examsOverlap, meetingSetsConflict, meetingsOverlap, toMinutes } from "./time";
import {
  CLASS_DAYS,
  DAY_END,
  DAY_START,
  MAX_CREDITS,
  emptyStudentState,
  type Course,
  type CoursePreferenceMap,
  type Plan,
  type PlanEntry,
  type Preferences,
  type Refinement,
  type Section,
  type StudentState,
} from "./types";

/** Public results are absolutely capped at this value. */
export const MAX_CANDIDATE_PLANS = 100;
const MAX_RAW_SOLUTIONS = 4_000;
const MAX_SEARCH_NODES = 400_000;

export interface SolveInput {
  courses: Course[];
  sections: Section[];
  /** Academic record used for prerequisite and duplicate-course enforcement. */
  student?: StudentState;
  /** courseCode -> take | neutral | skip */
  coursePreferences?: CoursePreferenceMap;
  preferences: Preferences;
  refinements?: Refinement[];
}

export type BlockReason =
  | { kind: "no_courses" }
  | { kind: "invalid_credit_range"; min: number; max: number }
  | { kind: "required_not_eligible"; courseCode: string }
  | { kind: "take_no_valid_section"; courseCode: string }
  | { kind: "required_over_max"; credits: number; max: number }
  | { kind: "take_over_max"; credits: number; max: number }
  | { kind: "not_enough_credits"; available: number; min: number }
  | { kind: "required_class_conflict"; a: string; b: string }
  | { kind: "required_exam_conflict"; a: string; b: string }
  | { kind: "take_class_conflict"; a: string; b: string }
  | { kind: "take_exam_conflict"; a: string; b: string }
  | { kind: "corequisite_unsatisfied"; courseCode: string }
  | { kind: "no_valid_combination" }
  | { kind: "refinement_too_strict" };

export interface SolveResult {
  plans: Plan[];
  /** Number enumerated before the diverse 100-result presentation cap. */
  totalFound: number;
  /** True when either search or presentation was capped. */
  truncated: boolean;
  blockers: BlockReason[];
}

interface CourseOption {
  course: Course;
  sections: Section[];
  mandatory: boolean;
  required: boolean;
}

/** A section is usable only if it satisfies every individual hard constraint. */
export function isSectionAllowed(
  section: Section,
  preferences: Preferences,
  refinements: Refinement[] = [],
): boolean {
  if (preferences.gender === "male" && section.gender === "female") return false;
  if (preferences.gender === "female" && section.gender === "male") return false;
  if (section.capacity !== null && section.capacity !== undefined && section.capacity <= 0)
    return false;
  if (!section.meetings.length) return false;

  const lowerBound = toMinutes(preferences.noEarlierThan ?? DAY_START);
  const upperBound = toMinutes(preferences.noLaterThan ?? DAY_END);
  const teachingStart = toMinutes(DAY_START);
  const teachingEnd = toMinutes(DAY_END);

  for (const meeting of section.meetings) {
    const start = toMinutes(meeting.start);
    const end = toMinutes(meeting.end);
    if (!CLASS_DAYS.includes(meeting.day as (typeof CLASS_DAYS)[number])) return false;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false;
    if (start < teachingStart || end > teachingEnd) return false;
    if (start < lowerBound || end > upperBound) return false;
    if (preferences.blockedTimes.some((blocked) => meetingsOverlap(meeting, blocked))) return false;
  }

  for (const refinement of refinements) {
    if (
      refinement.kind === "professor" &&
      refinement.courseCode === section.courseCode &&
      (section.professor ?? "") !== refinement.professor
    ) {
      return false;
    }
    if (
      refinement.kind === "section" &&
      refinement.courseCode === section.courseCode &&
      section.id !== refinement.sectionId
    ) {
      return false;
    }
    if (
      refinement.kind === "courseDay" &&
      refinement.courseCode === section.courseCode &&
      !section.meetings.some((meeting) => meeting.day === refinement.day)
    ) {
      return false;
    }
    if (
      refinement.kind === "noEarlierThan" &&
      section.meetings.some((meeting) => toMinutes(meeting.start) < toMinutes(refinement.time))
    ) {
      return false;
    }
    if (
      refinement.kind === "noLaterThan" &&
      section.meetings.some((meeting) => toMinutes(meeting.end) > toMinutes(refinement.time))
    ) {
      return false;
    }
  }

  return true;
}

/** Deterministic, UI-independent constraint solver. */
export function solve(input: SolveInput): SolveResult {
  const student = input.student ?? emptyStudentState();
  const coursePreferences = input.coursePreferences ?? {};
  const refinements = input.refinements ?? [];
  const { courses, sections, preferences } = input;
  const blockers: BlockReason[] = [];

  if (
    !Number.isFinite(preferences.minCredits) ||
    !Number.isFinite(preferences.maxCredits) ||
    preferences.minCredits < 0 ||
    preferences.maxCredits > MAX_CREDITS ||
    preferences.maxCredits < preferences.minCredits
  ) {
    return {
      plans: [],
      totalFound: 0,
      truncated: false,
      blockers: [
        {
          kind: "invalid_credit_range",
          min: preferences.minCredits,
          max: preferences.maxCredits,
        },
      ],
    };
  }

  const forcedInclude = new Set(
    refinements.filter((item) => item.kind === "includeCourse").map((item) => item.courseCode),
  );
  const forcedExclude = new Set(
    refinements.filter((item) => item.kind === "excludeCourse").map((item) => item.courseCode),
  );
  const requiredCodes = new Set(student.required);

  const eligibility = evaluateEligibility({ courses, sections, student });
  const eligibilityByCode = new Map(eligibility.map((item) => [item.course.code, item]));
  const sectionsByCourse = new Map<string, Section[]>();
  for (const section of sections) {
    const list = sectionsByCourse.get(section.courseCode) ?? [];
    list.push(section);
    sectionsByCourse.set(section.courseCode, list);
  }

  const options: CourseOption[] = [];
  for (const course of courses) {
    const coursePreference = coursePreferences[course.code] ?? "neutral";
    const required = requiredCodes.has(course.code);
    const mandatory = required || coursePreference === "take" || forcedInclude.has(course.code);

    // A hard exclusion cannot silently override a must-take course.
    if (forcedExclude.has(course.code) || coursePreference === "skip") {
      if (mandatory && required)
        blockers.push({ kind: "required_not_eligible", courseCode: course.code });
      continue;
    }

    const status = eligibilityByCode.get(course.code)?.status;
    if (status !== "eligible") {
      if (mandatory) blockers.push({ kind: "required_not_eligible", courseCode: course.code });
      continue;
    }

    const usable = (sectionsByCourse.get(course.code) ?? [])
      .filter((section) => isSectionAllowed(section, preferences, refinements))
      .sort((a, b) => stableSectionKey(a).localeCompare(stableSectionKey(b)));

    if (usable.length === 0) {
      if (mandatory) blockers.push({ kind: "take_no_valid_section", courseCode: course.code });
      continue;
    }
    options.push({ course, sections: usable, mandatory, required });
  }

  if (options.length === 0) {
    if (blockers.length === 0) blockers.push({ kind: "no_courses" });
    return { plans: [], totalFound: 0, truncated: false, blockers: uniqueBlockers(blockers) };
  }

  const mandatoryOptions = options.filter((option) => option.mandatory);
  const mandatoryCredits = mandatoryOptions.reduce((sum, option) => sum + option.course.credits, 0);
  if (mandatoryCredits > preferences.maxCredits) {
    blockers.push({
      kind: mandatoryOptions.some((option) => option.required)
        ? "required_over_max"
        : "take_over_max",
      credits: mandatoryCredits,
      max: preferences.maxCredits,
    });
  }

  const availableCredits = options.reduce((sum, option) => sum + option.course.credits, 0);
  if (availableCredits < preferences.minCredits) {
    blockers.push({
      kind: "not_enough_credits",
      available: availableCredits,
      min: preferences.minCredits,
    });
  }

  blockers.push(...diagnoseMandatoryPairs(mandatoryOptions));
  if (blockers.length > 0) {
    return { plans: [], totalFound: 0, truncated: false, blockers: uniqueBlockers(blockers) };
  }

  // Most constrained first substantially reduces the search tree without changing validity.
  const ordered = [...options].sort((a, b) => {
    if (a.mandatory !== b.mandatory) return a.mandatory ? -1 : 1;
    if (a.sections.length !== b.sections.length) return a.sections.length - b.sections.length;
    if (a.course.credits !== b.course.credits) return b.course.credits - a.course.credits;
    return a.course.code.localeCompare(b.course.code);
  });

  const suffixCredits = new Array<number>(ordered.length + 1).fill(0);
  const suffixMandatory = new Array<number>(ordered.length + 1).fill(0);
  for (let index = ordered.length - 1; index >= 0; index--) {
    suffixCredits[index] = suffixCredits[index + 1]! + ordered[index]!.course.credits;
    suffixMandatory[index] =
      suffixMandatory[index + 1]! +
      (ordered[index]!.mandatory ? ordered[index]!.course.credits : 0);
  }

  const solutions: Section[][] = [];
  const chosen: Section[] = [];
  let searchedNodes = 0;
  let searchTruncated = false;

  const conflictsWithChosen = (section: Section): boolean =>
    chosen.some(
      (other) =>
        meetingSetsConflict(other.meetings, section.meetings) ||
        examsOverlap(other.exam, section.exam),
    );

  const recurse = (index: number, credits: number): void => {
    if (searchTruncated) return;
    searchedNodes += 1;
    if (searchedNodes > MAX_SEARCH_NODES) {
      searchTruncated = true;
      return;
    }
    if (credits > preferences.maxCredits) return;
    if (credits + suffixCredits[index]! < preferences.minCredits) return;
    if (credits + suffixMandatory[index]! > preferences.maxCredits) return;

    if (index >= ordered.length) {
      if (
        credits >= preferences.minCredits &&
        credits <= preferences.maxCredits &&
        combinationSatisfiesCorequisites(chosen, courses, student)
      ) {
        solutions.push([...chosen]);
        if (solutions.length >= MAX_RAW_SOLUTIONS) searchTruncated = true;
      }
      return;
    }

    const option = ordered[index]!;
    const nextCredits = credits + option.course.credits;
    if (nextCredits <= preferences.maxCredits) {
      for (const section of option.sections) {
        if (conflictsWithChosen(section)) continue;
        chosen.push(section);
        recurse(index + 1, nextCredits);
        chosen.pop();
        if (searchTruncated) return;
      }
    }
    if (!option.mandatory) recurse(index + 1, credits);
  };

  recurse(0, 0);

  const allPlans = solutions
    .map((combination) => buildPlan(combination, options, preferences))
    .filter((plan) => matchesPlanConstraints(plan, preferences, refinements))
    .sort((a, b) => b.score - a.score || planKey(a).localeCompare(planKey(b)));

  withMatchScores(allPlans);
  const plans = diversify(allPlans, MAX_CANDIDATE_PLANS);
  const hadRefinements = refinements.length > 0;

  return {
    plans,
    totalFound: allPlans.length,
    truncated: searchTruncated || allPlans.length > plans.length,
    blockers:
      allPlans.length > 0
        ? []
        : [{ kind: hadRefinements ? "refinement_too_strict" : "no_valid_combination" }],
  };
}

function diagnoseMandatoryPairs(options: CourseOption[]): BlockReason[] {
  const reasons: BlockReason[] = [];
  for (let left = 0; left < options.length; left++) {
    for (let right = left + 1; right < options.length; right++) {
      const a = options[left]!;
      const b = options[right]!;
      const hasClassCompatiblePair = a.sections.some((first) =>
        b.sections.some((second) => !meetingSetsConflict(first.meetings, second.meetings)),
      );
      const hasExamCompatiblePair = a.sections.some((first) =>
        b.sections.some((second) => !examsOverlap(first.exam, second.exam)),
      );
      const prefix = a.required || b.required ? "required" : "take";
      if (!hasClassCompatiblePair) {
        reasons.push({
          kind: `${prefix}_class_conflict` as "required_class_conflict" | "take_class_conflict",
          a: a.course.code,
          b: b.course.code,
        });
      } else if (!hasExamCompatiblePair) {
        reasons.push({
          kind: `${prefix}_exam_conflict` as "required_exam_conflict" | "take_exam_conflict",
          a: a.course.code,
          b: b.course.code,
        });
      }
    }
  }
  return reasons;
}

function combinationSatisfiesCorequisites(
  sections: Section[],
  courses: Course[],
  student: StudentState,
): boolean {
  const known = new Set(courses.map((course) => course.code));
  const concurrent = new Set(sections.map((section) => section.courseCode));
  const completed = new Set(student.passed);
  const byCode = new Map(courses.map((course) => [course.code, course]));

  return sections.every((section) => {
    const course = byCode.get(section.courseCode);
    if (!course?.corequisites) return true;
    return (
      evaluatePrereq(course.corequisites, { known, completed, concurrent }).outcome === "satisfied"
    );
  });
}

function matchesPlanConstraints(
  plan: Plan,
  preferences: Preferences,
  refinements: Refinement[],
): boolean {
  if (preferences.maxClassDays !== null && plan.classDays.length > preferences.maxClassDays)
    return false;
  for (const refinement of refinements) {
    if (refinement.kind === "freeDay" && !plan.freeDays.includes(refinement.day)) return false;
    if (refinement.kind === "maxClassDays" && plan.classDays.length > refinement.value)
      return false;
    if (
      refinement.kind === "courseDay" &&
      !plan.entries.some(
        (entry) =>
          entry.course.code === refinement.courseCode &&
          entry.section.meetings.some((meeting) => meeting.day === refinement.day),
      )
    ) {
      return false;
    }
    if (
      refinement.kind === "includeCourse" &&
      !plan.entries.some((entry) => entry.course.code === refinement.courseCode)
    ) {
      return false;
    }
    if (
      refinement.kind === "excludeCourse" &&
      plan.entries.some((entry) => entry.course.code === refinement.courseCode)
    ) {
      return false;
    }
  }
  return true;
}

function withMatchScores(plans: Plan[]): void {
  if (plans.length === 0) return;
  const scores = plans.map((plan) => plan.score);
  const maximum = Math.max(...scores);
  const minimum = Math.min(...scores);
  const span = maximum - minimum;
  for (const plan of plans) {
    plan.match = span <= 0 ? 100 : Math.round(60 + ((plan.score - minimum) / span) * 40);
  }
}

function buildPlan(sections: Section[], options: CourseOption[], preferences: Preferences): Plan {
  const courseByCode = new Map(options.map((option) => [option.course.code, option.course]));
  const entries: PlanEntry[] = sections
    .map((section) => ({ section, course: courseByCode.get(section.courseCode)! }))
    .sort((a, b) => a.course.code.localeCompare(b.course.code));
  const credits = entries.reduce((sum, entry) => sum + entry.course.credits, 0);

  const daySet = new Set<number>();
  let earliest = Infinity;
  let latest = -Infinity;
  for (const entry of entries) {
    for (const meeting of entry.section.meetings) {
      daySet.add(meeting.day);
      earliest = Math.min(earliest, toMinutes(meeting.start));
      latest = Math.max(latest, toMinutes(meeting.end));
    }
  }
  const classDays = [...daySet].sort((a, b) => a - b);
  const freeDays: number[] = CLASS_DAYS.filter((day) => !daySet.has(day));
  const preferredFree = preferences.preferredFreeDays.filter((day) =>
    freeDays.includes(day),
  ).length;
  const middleCredits = (preferences.minCredits + preferences.maxCredits) / 2;
  const spanPenalty = Number.isFinite(latest - earliest) ? (latest - earliest) / 240 : 0;
  const score =
    credits * 0.6 -
    Math.abs(credits - middleCredits) * 0.3 +
    freeDays.length * 1.5 +
    preferredFree * 2 -
    spanPenalty;
  const key = entries.map((entry) => entry.section.id).join("|");

  return {
    id: `plan-${stableHash(key)}`,
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

function minutesToLabel(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function stableHash(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

function stableSectionKey(section: Section): string {
  return `${section.courseCode}#${section.sectionName}#${section.id}`;
}

function planKey(plan: Plan): string {
  return plan.entries
    .map((entry) => entry.section.id)
    .sort()
    .join("|");
}

function uniqueBlockers(blockers: BlockReason[]): BlockReason[] {
  const seen = new Set<string>();
  return blockers.filter((blocker) => {
    const key = JSON.stringify(blocker);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Removes exact and near duplicates while preserving deterministic rank order. */
export function diversify(plans: Plan[], limit = MAX_CANDIDATE_PLANS): Plan[] {
  const safeLimit = Math.max(0, Math.min(limit, MAX_CANDIDATE_PLANS));
  const exactSeen = new Set<string>();
  const shapeSeen = new Set<string>();
  const primary: Plan[] = [];
  const secondary: Plan[] = [];

  for (const plan of plans) {
    const exact = planKey(plan);
    if (exactSeen.has(exact)) continue;
    exactSeen.add(exact);

    const shape = [
      plan.entries
        .map((entry) => `${entry.course.code}@${entry.section.professor ?? ""}`)
        .sort()
        .join(","),
      plan.classDays.join(","),
      plan.credits,
    ].join("#");

    if (shapeSeen.has(shape)) secondary.push(plan);
    else {
      shapeSeen.add(shape);
      primary.push(plan);
    }
  }

  return [...primary, ...secondary].slice(0, safeLimit);
}
