/**
 * Pure scheduling domain types. This module deliberately has no UI, database,
 * network, or framework dependencies so the planner can be tested in isolation.
 */

/** 0 = Saturday ... 6 = Friday (Iranian academic week). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
/** Normal university teaching week: Saturday through Wednesday. */
export const CLASS_DAYS: Weekday[] = [0, 1, 2, 3, 4];

export const DAY_START = "07:45";
export const DAY_END = "20:00";
export const MINUTE_STEPS = [0, 15, 30, 45] as const;
export const MIN_CREDITS = 12;
export const MAX_CREDITS = 24;

export type Gender = "male" | "female" | "mixed";

export interface Meeting {
  day: number;
  /** 24-hour HH:MM. */
  start: string;
  /** 24-hour HH:MM. Endpoints are exclusive, so adjacent classes are valid. */
  end: string;
}

export interface ExamSlot {
  /** ISO date or the normalized date label supplied by the university. */
  date: string;
  start: string;
  end: string;
}

export type PrereqNode =
  | { type: "course"; code: string; minGrade?: number }
  | { type: "and"; items: PrereqNode[] }
  | { type: "or"; items: PrereqNode[] };

export interface Course {
  id: string;
  code: string;
  nameEn: string;
  nameFa: string;
  credits: number;
  department?: string | null;
  courseType?: string | null;
  repeatable?: boolean;
  prerequisites?: PrereqNode | null;
  corequisites?: PrereqNode | null;
}

export interface Section {
  id: string;
  courseId: string;
  courseCode: string;
  sectionName: string;
  groupNumber?: string | null;
  gender: Gender;
  professor?: string | null;
  capacity?: number | null;
  location?: string | null;
  meetings: Meeting[];
  exam?: ExamSlot | null;
}

export type CoursePreference = "take" | "neutral" | "skip";
export type CoursePreferenceMap = Record<string, CoursePreference>;

export interface Preferences {
  minCredits: number;
  maxCredits: number;
  /** Times the student can never attend. */
  blockedTimes: Meeting[];
  /** Section eligibility constraint. Mixed sections remain available to everyone. */
  gender: "male" | "female" | null;
  /** Hard class-time bounds selected by the student. */
  noEarlierThan: string | null;
  noLaterThan: string | null;
  /** Soft ranking preference; a refinement can turn one into a hard free day. */
  preferredFreeDays: number[];
  /** Hard limit when set. */
  maxClassDays: number | null;
  /** Optional Gregorian dates used only to produce accurate recurring ICS events. */
  semesterStart: string | null;
  semesterEnd: string | null;
}

export const defaultPreferences = (): Preferences => ({
  minCredits: MIN_CREDITS,
  maxCredits: MAX_CREDITS,
  blockedTimes: [],
  gender: null,
  noEarlierThan: null,
  noLaterThan: null,
  preferredFreeDays: [],
  maxClassDays: null,
  semesterStart: null,
  semesterEnd: null,
});

/** Hard filters selected while browsing candidates. */
export type Refinement =
  | { kind: "professor"; courseCode: string; professor: string }
  | { kind: "section"; courseCode: string; sectionId: string; label: string }
  | { kind: "includeCourse"; courseCode: string }
  | { kind: "excludeCourse"; courseCode: string }
  | { kind: "freeDay"; day: number }
  | { kind: "courseDay"; courseCode: string; day: number }
  | { kind: "maxClassDays"; value: number }
  | { kind: "noEarlierThan"; time: string }
  | { kind: "noLaterThan"; time: string };

export interface PlanEntry {
  section: Section;
  course: Course;
}

export interface Plan {
  id: string;
  entries: PlanEntry[];
  credits: number;
  classDays: number[];
  freeDays: number[];
  earliestStart: string;
  latestEnd: string;
  score: number;
  /** Relative 0–100 display score. It never changes validity. */
  match: number;
}

export type StudentCourseStatus = "passed" | "current" | "failed" | "required" | "avoid";

export interface StudentState {
  passed: string[];
  current: string[];
  failed: string[];
  required: string[];
  avoid: string[];
  /** Explicit human review of otherwise uncertain eligibility. */
  overrides: Record<string, boolean>;
}

export const emptyStudentState = (): StudentState => ({
  passed: [],
  current: [],
  failed: [],
  required: [],
  avoid: [],
  overrides: {},
});
