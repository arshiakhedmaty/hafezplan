/**
 * Core scheduling domain types.
 * This module is pure data — no UI, no database, no framework imports.
 */

/** 0 = Saturday ... 6 = Friday (Iranian academic week). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

/** University week: Saturday..Wednesday. Thursday and Friday are always off. */
export const CLASS_DAYS: number[] = [0, 1, 2, 3, 4];

/** Hard bounds of the teaching day. */
export const DAY_START = "07:45";
export const DAY_END = "20:00";

/** Selectable minutes for blocked-time pickers. */
export const MINUTE_STEPS = [0, 15, 30, 45];

export const MIN_CREDITS = 12;
export const MAX_CREDITS = 24;

export type Gender = "male" | "female" | "mixed";

export interface Meeting {
  day: number;
  /** "HH:MM" 24h */
  start: string;
  /** "HH:MM" 24h */
  end: string;
}

export interface ExamSlot {
  /** As written in the university table (usually a Jalali date). */
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

/** The only three choices a student makes per course. */
export type CoursePreference = "take" | "neutral" | "skip";

export type CoursePreferenceMap = Record<string, CoursePreference>;

export interface Preferences {
  minCredits: number;
  maxCredits: number;
  /** Times the student is never available. */
  blockedTimes: Meeting[];
  /** Student gender; drives which sections are allowed. */
  gender: "male" | "female" | null;
}

export const defaultPreferences = (): Preferences => ({
  minCredits: MIN_CREDITS,
  maxCredits: MAX_CREDITS,
  blockedTimes: [],
  gender: null,
});

/** Hard filters chosen while browsing results. */
export type Refinement =
  | { kind: "professor"; courseCode: string; professor: string }
  | { kind: "section"; courseCode: string; sectionId: string; label: string }
  | { kind: "includeCourse"; courseCode: string }
  | { kind: "excludeCourse"; courseCode: string }
  | { kind: "freeDay"; day: number }
  | { kind: "maxClassDays"; value: number };

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
}

/* ---- legacy student-record types, kept for the eligibility helpers ---- */

export type StudentCourseStatus = "passed" | "current" | "failed" | "required" | "avoid";

export interface StudentState {
  passed: string[];
  current: string[];
  failed: string[];
  required: string[];
  avoid: string[];
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
