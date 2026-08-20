import { isValidDate, isValidTime, toMinutes } from "./time";
import type { Course, Meeting, Section } from "./types";

export type IssueLevel = "error" | "warning";

export interface ValidationIssue {
  level: IssueLevel;
  /** Stable key the UI translates. */
  code:
    | "duplicate_course"
    | "duplicate_section"
    | "missing_code"
    | "missing_name"
    | "invalid_credits"
    | "invalid_time"
    | "invalid_date"
    | "reversed_time"
    | "missing_professor"
    | "missing_meetings"
    | "unknown_prerequisite"
    | "conflicting_meetings";
  target: string;
  detail?: string;
}

export interface ValidationInput {
  courses: Course[];
  sections: Section[];
}

/** Validates imported / manually entered data before it may reach the engine. */
export function validateCatalog({ courses, sections }: ValidationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenCodes = new Set<string>();
  const knownCodes = new Set(courses.map((c) => c.code));

  for (const course of courses) {
    if (!course.code?.trim()) {
      issues.push({ level: "error", code: "missing_code", target: course.nameEn || course.id });
      continue;
    }
    if (seenCodes.has(course.code)) {
      issues.push({ level: "error", code: "duplicate_course", target: course.code });
    }
    seenCodes.add(course.code);
    if (!course.nameEn?.trim() && !course.nameFa?.trim()) {
      issues.push({ level: "error", code: "missing_name", target: course.code });
    }
    if (!Number.isFinite(course.credits) || course.credits < 0 || course.credits > 12) {
      issues.push({ level: "error", code: "invalid_credits", target: course.code });
    }
    for (const referenced of collectCodes(course)) {
      if (!knownCodes.has(referenced)) {
        issues.push({
          level: "warning",
          code: "unknown_prerequisite",
          target: course.code,
          detail: referenced,
        });
      }
    }
  }

  const seenSections = new Set<string>();
  for (const section of sections) {
    const key = `${section.courseCode}#${section.sectionName}`;
    if (seenSections.has(key)) {
      issues.push({ level: "error", code: "duplicate_section", target: key });
    }
    seenSections.add(key);

    if (!section.professor?.trim()) {
      issues.push({ level: "warning", code: "missing_professor", target: key });
    }
    if (!section.meetings || section.meetings.length === 0) {
      issues.push({ level: "warning", code: "missing_meetings", target: key });
    }
    for (const meeting of section.meetings ?? []) {
      if (!isValidTime(meeting.start) || !isValidTime(meeting.end)) {
        issues.push({
          level: "error",
          code: "invalid_time",
          target: key,
          detail: `${meeting.start}-${meeting.end}`,
        });
        continue;
      }
      if (toMinutes(meeting.end) <= toMinutes(meeting.start)) {
        issues.push({ level: "error", code: "reversed_time", target: key });
      }
      if (meeting.day < 0 || meeting.day > 6) {
        issues.push({
          level: "error",
          code: "invalid_time",
          target: key,
          detail: String(meeting.day),
        });
      }
    }
    if (selfConflicting(section.meetings ?? [])) {
      issues.push({ level: "error", code: "conflicting_meetings", target: key });
    }
    if (section.exam) {
      if (!isValidDate(section.exam.date)) {
        issues.push({
          level: "error",
          code: "invalid_date",
          target: key,
          detail: section.exam.date,
        });
      }
      if (!isValidTime(section.exam.start) || !isValidTime(section.exam.end)) {
        issues.push({ level: "error", code: "invalid_time", target: key });
      } else if (toMinutes(section.exam.end) <= toMinutes(section.exam.start)) {
        issues.push({ level: "error", code: "reversed_time", target: key });
      }
    }
  }

  return issues;
}

function selfConflicting(meetings: Meeting[]): boolean {
  for (let i = 0; i < meetings.length; i++) {
    for (let j = i + 1; j < meetings.length; j++) {
      const a = meetings[i]!;
      const b = meetings[j]!;
      if (a.day !== b.day) continue;
      if (!isValidTime(a.start) || !isValidTime(b.start)) continue;
      if (toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end))
        return true;
    }
  }
  return false;
}

function collectCodes(course: Course): string[] {
  const out: string[] = [];
  const walk = (node: Course["prerequisites"]): void => {
    if (!node) return;
    if (node.type === "course") {
      out.push(node.code);
      return;
    }
    node.items.forEach(walk);
  };
  walk(course.prerequisites);
  walk(course.corequisites);
  return out;
}
