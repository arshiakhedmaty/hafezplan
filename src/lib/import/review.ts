import type { Course, Section, ValidationIssue } from "@/lib/scheduling";
import { validateCatalog } from "@/lib/scheduling";
import { normalizeText } from "./normalize";
import { parseClassSchedule, parseExam, parseGender } from "./schedule";
import type { AmbiguousRow, ParsedSection, ParseResult } from "./types";

export interface ImportDraftRow {
  id: string;
  sourceLine: number | null;
  courseCode: string;
  courseName: string;
  groupNumber: string;
  units: string;
  capacity: string;
  gender: "male" | "female" | "mixed";
  professor: string;
  classSchedule: string;
  examSchedule: string;
  uncertainty: string | null;
}

export interface ReviewedImport {
  validSections: ParsedSection[];
  rowErrors: Record<string, string[]>;
  issues: ValidationIssue[];
  canConfirm: boolean;
}

export function emptyDraftRow(index = 0): ImportDraftRow {
  return {
    id: `manual-${Date.now()}-${index}`,
    sourceLine: null,
    courseCode: "",
    courseName: "",
    groupNumber: "1",
    units: "3",
    capacity: "",
    gender: "mixed",
    professor: "",
    classSchedule: "",
    examSchedule: "",
    uncertainty: null,
  };
}

export function resultToDraftRows(result: ParseResult): ImportDraftRow[] {
  const accepted = result.sections.map((section, index) =>
    parsedToDraft(section, `parsed-${index}`, null, null),
  );
  const uncertain = result.ambiguous.map((row, index) => ambiguousToDraft(row, index));
  return [...accepted, ...uncertain];
}

function parsedToDraft(
  section: ParsedSection,
  id: string,
  sourceLine: number | null,
  uncertainty: string | null,
): ImportDraftRow {
  return {
    id,
    sourceLine,
    courseCode: section.courseCode,
    courseName: section.courseName,
    groupNumber: section.groupNumber,
    units: String(section.units),
    capacity: section.capacity === null ? "" : String(section.capacity),
    gender: section.gender,
    professor: section.professor,
    classSchedule: section.classScheduleRaw,
    examSchedule: section.examScheduleRaw,
    uncertainty,
  };
}

function ambiguousToDraft(row: AmbiguousRow, index: number): ImportDraftRow {
  const partial = row.partial;
  return {
    id: `uncertain-${row.line}-${index}`,
    sourceLine: row.line,
    courseCode: partial.courseCode ?? "",
    courseName: partial.courseName ?? "",
    groupNumber: partial.groupNumber ?? "1",
    units: partial.units === undefined ? "" : String(partial.units),
    capacity:
      partial.capacity === null || partial.capacity === undefined ? "" : String(partial.capacity),
    gender: partial.gender ?? "mixed",
    professor: partial.professor ?? "",
    classSchedule: partial.classScheduleRaw ?? "",
    examSchedule: partial.examScheduleRaw ?? "",
    uncertainty: row.reason,
  };
}

/** Converts editable review rows only after applying strict, deterministic validation. */
export function reviewDraftRows(rows: ImportDraftRow[]): ReviewedImport {
  const rowErrors: Record<string, string[]> = {};
  const parsed: ParsedSection[] = [];
  const seen = new Map<string, string>();
  const courseMetadata = new Map<string, { name: string; units: number; rowId: string }>();

  for (const row of rows) {
    const errors: string[] = [];
    const courseCode = normalizeText(row.courseCode);
    const courseName = normalizeText(row.courseName);
    const groupNumber = normalizeText(row.groupNumber) || "1";
    const units = Number(row.units);
    const capacity = row.capacity.trim() === "" ? null : Number(row.capacity);
    const schedule = parseClassSchedule(row.classSchedule);
    const exam = parseExam(row.examSchedule);

    if (!courseCode) errors.push("missing_code");
    if (!courseName) errors.push("missing_name");
    if (!Number.isFinite(units) || units <= 0 || units > 12) errors.push("invalid_credits");
    if (capacity !== null && (!Number.isInteger(capacity) || capacity < 0))
      errors.push("invalid_capacity");
    if (schedule.ambiguous || schedule.meetings.length === 0) errors.push("unreadable_class_time");
    if (exam.ambiguous) errors.push("unreadable_exam_time");

    const previousMetadata = courseMetadata.get(courseCode);
    if (
      courseCode &&
      previousMetadata &&
      (previousMetadata.name !== courseName || previousMetadata.units !== units)
    ) {
      errors.push("conflicting_course_metadata");
      rowErrors[previousMetadata.rowId] = [
        ...(rowErrors[previousMetadata.rowId] ?? []),
        "conflicting_course_metadata",
      ];
    } else if (courseCode && !previousMetadata) {
      courseMetadata.set(courseCode, { name: courseName, units, rowId: row.id });
    }

    const duplicateKey = `${courseCode}#${groupNumber}`;
    const firstId = seen.get(duplicateKey);
    if (courseCode && firstId) {
      errors.push("duplicate_section");
      rowErrors[firstId] = [...(rowErrors[firstId] ?? []), "duplicate_section"];
    } else if (courseCode) {
      seen.set(duplicateKey, row.id);
    }

    if (errors.length > 0) {
      rowErrors[row.id] = [...new Set([...(rowErrors[row.id] ?? []), ...errors])];
      continue;
    }

    parsed.push({
      courseCode,
      courseName,
      groupNumber,
      units,
      capacity,
      gender: parseGender(row.gender),
      professor: normalizeText(row.professor),
      classScheduleRaw: normalizeText(row.classSchedule),
      examScheduleRaw: normalizeText(row.examSchedule),
      meetings: schedule.meetings,
      exam: exam.exam,
    });
  }

  const { courses, sections } = parsedSectionsToCatalog(parsed);
  const issues = validateCatalog({ courses, sections });
  const hasCatalogErrors = issues.some((issue) => issue.level === "error");
  return {
    validSections: parsed,
    rowErrors,
    issues,
    canConfirm: rows.length > 0 && Object.keys(rowErrors).length === 0 && !hasCatalogErrors,
  };
}

/** Builds temporary domain records so the same validator is used before persistence and scheduling. */
export function parsedSectionsToCatalog(parsed: ParsedSection[]): {
  courses: Course[];
  sections: Section[];
} {
  const courseByCode = new Map<string, Course>();
  for (const item of parsed) {
    const existing = courseByCode.get(item.courseCode);
    if (!existing) {
      courseByCode.set(item.courseCode, {
        id: `course:${item.courseCode}`,
        code: item.courseCode,
        nameEn: item.courseName,
        nameFa: item.courseName,
        credits: item.units,
        repeatable: false,
        prerequisites: null,
        corequisites: null,
      });
    }
  }
  const courses = [...courseByCode.values()];
  const sections: Section[] = parsed.map((item, index) => ({
    id: `section:${item.courseCode}:${item.groupNumber}:${index}`,
    courseId: `course:${item.courseCode}`,
    courseCode: item.courseCode,
    sectionName: item.groupNumber,
    groupNumber: item.groupNumber,
    gender: item.gender,
    professor: item.professor || null,
    capacity: item.capacity,
    location: null,
    meetings: item.meetings,
    exam: item.exam,
  }));
  return { courses, sections };
}
