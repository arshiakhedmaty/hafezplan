import type { Meeting } from "@/lib/scheduling";
import { emptyDraftRow, reviewDraftRows, type ImportDraftRow } from "./review";
import type { AmbiguousRow, ParseResult, ParsedSection } from "./types";

const DAY_NAMES = ["شنبه", "یکشنبه", "دوشنبه", "سه شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

type JsonRecord = Record<string, unknown>;

/**
 * Parses JSON without trusting its shape. Both a flat section array and
 * `{ sections: [...] }` / `{ courses: [{ sections: [...] }] }` are accepted.
 */
export function parseJsonOfferings(raw: string): ParseResult {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return emptyResult("invalid_json");
  }

  const records = flattenRecords(value);
  if (records.length === 0) return emptyResult("json_has_no_sections");

  const rows = records.map(({ section, course }, index) => recordToDraft(section, course, index));
  const reviewed = reviewDraftRows(rows);
  const validById = new Map<string, ParsedSection>();
  let validIndex = 0;
  for (const row of rows) {
    if (!reviewed.rowErrors[row.id]) validById.set(row.id, reviewed.validSections[validIndex++]!);
  }

  const sections: ParsedSection[] = [];
  const ambiguous: AmbiguousRow[] = [];
  rows.forEach((row, index) => {
    const parsed = validById.get(row.id);
    if (parsed) {
      sections.push(parsed);
      return;
    }
    ambiguous.push({
      line: index + 1,
      raw: JSON.stringify(records[index]!.section),
      reason: (reviewed.rowErrors[row.id] ?? ["invalid_section"]).join(", "),
      partial: draftToPartial(row),
    });
  });

  return {
    sections,
    ambiguous,
    skipped: 0,
    duplicates: 0,
    headerFound: true,
  };
}

function flattenRecords(value: unknown): Array<{ section: JsonRecord; course?: JsonRecord }> {
  if (Array.isArray(value)) {
    return value.filter(isRecord).map((section) => ({ section }));
  }
  if (!isRecord(value)) return [];

  const direct = value["sections"];
  if (Array.isArray(direct)) return direct.filter(isRecord).map((section) => ({ section }));

  const courses = value["courses"];
  if (!Array.isArray(courses)) return [];
  return courses.filter(isRecord).flatMap((course) => {
    const sections = Array.isArray(course["sections"]) ? course["sections"] : [];
    return sections.filter(isRecord).map((section) => ({ section, course }));
  });
}

function recordToDraft(
  section: JsonRecord,
  course: JsonRecord | undefined,
  index: number,
): ImportDraftRow {
  const row = emptyDraftRow(index);
  row.id = `json-${index}`;
  row.sourceLine = index + 1;
  row.courseCode =
    text(section, "courseCode", "course_code", "code") || text(course, "code", "courseCode");
  row.courseName =
    text(section, "courseName", "course_name", "name", "nameFa", "nameEn") ||
    text(course, "name", "nameFa", "nameEn");
  row.groupNumber = text(section, "groupNumber", "group_number", "sectionName", "group") || "1";
  row.units =
    numberText(section, "units", "credits") || numberText(course, "units", "credits") || "3";
  row.capacity = numberText(section, "capacity");
  row.professor = text(section, "professor", "instructor");
  row.gender = normalizeGender(text(section, "gender"));
  row.classSchedule =
    text(section, "classScheduleRaw", "classSchedule", "schedule") ||
    meetingsToText(section["meetings"]);
  row.examSchedule =
    text(section, "examScheduleRaw", "examSchedule") || examToText(section["exam"]);
  return row;
}

function text(record: JsonRecord | undefined, ...keys: string[]): string {
  if (!record) return "";
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
  }
  return "";
}

function numberText(record: JsonRecord | undefined, ...keys: string[]): string {
  return text(record, ...keys);
}

function meetingsToText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .filter(isRecord)
    .map((meeting) => {
      const day = Number(meeting["day"]);
      const start = typeof meeting["start"] === "string" ? meeting["start"] : "";
      const end = typeof meeting["end"] === "string" ? meeting["end"] : "";
      return Number.isInteger(day) && DAY_NAMES[day] && start && end
        ? `${DAY_NAMES[day]} ${start}-${end}`
        : "";
    })
    .filter(Boolean)
    .join(" و ");
}

function examToText(value: unknown): string {
  if (!isRecord(value)) return "";
  const date = text(value, "label", "date");
  const start = text(value, "start");
  const end = text(value, "end");
  return date && start && end ? `${date} ${start}-${end}` : "";
}

function normalizeGender(value: string): ImportDraftRow["gender"] {
  if (/^(female|women|زن|دختر)$/i.test(value)) return "female";
  if (/^(male|men|مرد|پسر)$/i.test(value)) return "male";
  return "mixed";
}

function draftToPartial(row: ImportDraftRow): Partial<ParsedSection> {
  return {
    courseCode: row.courseCode,
    courseName: row.courseName,
    groupNumber: row.groupNumber,
    units: Number(row.units),
    capacity: row.capacity ? Number(row.capacity) : null,
    gender: row.gender,
    professor: row.professor,
    classScheduleRaw: row.classSchedule,
    examScheduleRaw: row.examSchedule,
  };
}

function emptyResult(reason: string): ParseResult {
  return {
    sections: [],
    ambiguous: [{ line: 1, raw: "", reason, partial: {} }],
    skipped: 0,
    duplicates: 0,
    headerFound: false,
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
