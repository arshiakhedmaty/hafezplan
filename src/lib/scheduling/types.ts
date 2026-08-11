/**
 * Core scheduling domain types.
 * This module is pure data — no UI, no database, no framework imports.
 */

/** 0 = Saturday ... 6 = Friday (Iranian academic week). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export interface Meeting {
  day: number;
  /** "HH:MM" 24h */
  start: string;
  /** "HH:MM" 24h */
  end: string;
}

export interface ExamSlot {
  date: string; // YYYY-MM-DD
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
  professor?: string | null;
  capacity?: number | null;
  location?: string | null;
  meetings: Meeting[];
  exam?: ExamSlot | null;
}

export type StudentCourseStatus = "passed" | "current" | "failed" | "required" | "avoid";

export interface StudentState {
  passed: string[];
  current: string[];
  failed: string[];
  required: string[];
  avoid: string[];
  /** courseCode -> forced eligible/ineligible, set manually by the student. */
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

export interface Preferences {
  minCredits: number;
  maxCredits: number;
  /** Times the student is never available. */
  blockedTimes: Meeting[];
  /** Soft: courseCode -> professor name. */
  preferredProfessors: Record<string, string>;
  /** Soft: days the student would rather keep free. */
  preferredFreeDays: number[];
  /** Soft: days the student would rather avoid. */
  avoidDays: number[];
  /** Soft: "HH:MM" — dislikes classes starting before this. */
  noEarlierThan?: string | null;
  /** Soft: "HH:MM" — dislikes classes ending after this. */
  noLaterThan?: string | null;
  /** Soft: prefers at most this many class days. */
  maxClassDays?: number | null;
}

export const defaultPreferences = (): Preferences => ({
  minCredits: 12,
  maxCredits: 20,
  blockedTimes: [],
  preferredProfessors: {},
  preferredFreeDays: [],
  avoidDays: [],
  noEarlierThan: null,
  noLaterThan: null,
  maxClassDays: null,
});

/**
 * Refinements are hard filters chosen by the student while browsing results.
 * They genuinely change the scheduling problem (not just the displayed list).
 */
export type Refinement =
  | { kind: "professor"; courseCode: string; professor: string }
  | { kind: "section"; courseCode: string; sectionId: string; label: string }
  | { kind: "freeDay"; day: number }
  | { kind: "courseDay"; courseCode: string; day: number }
  | { kind: "maxClassDays"; value: number }
  | { kind: "noEarlierThan"; time: string }
  | { kind: "noLaterThan"; time: string }
  | { kind: "includeCourse"; courseCode: string }
  | { kind: "excludeCourse"; courseCode: string };

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
  /** 0..100 how well soft preferences are met. */
  match: number;
  matchedPreferences: string[];
}
