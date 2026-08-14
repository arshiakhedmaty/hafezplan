import { normalizeText, splitCells, splitRows } from "./normalize";
import { parseClassSchedule, parseExam, parseGender } from "./schedule";
import type { AmbiguousRow, ParsedSection, ParseResult } from "./types";

type Field =
  | "courseCode"
  | "courseName"
  | "groupNumber"
  | "units"
  | "capacity"
  | "gender"
  | "professor"
  | "classSchedule"
  | "examSchedule";

const HEADER_HINTS: { field: Field; patterns: RegExp[] }[] = [
  { field: "courseCode", patterns: [/کد\s*درس/, /شماره\s*درس/, /course\s*code/i, /^کد$/] },
  { field: "courseName", patterns: [/نام\s*درس/, /عنوان\s*درس/, /course\s*name/i, /^درس$/] },
  { field: "groupNumber", patterns: [/گروه/, /شماره\s*گروه/, /group/i] },
  { field: "units", patterns: [/تعداد\s*واحد/, /^واحد/, /unit/i, /credit/i] },
  { field: "capacity", patterns: [/ظرفیت/, /capacity/i] },
  { field: "gender", patterns: [/جنسیت/, /gender/i] },
  { field: "professor", patterns: [/استاد/, /مدرس/, /professor/i, /instructor/i] },
  {
    field: "classSchedule",
    patterns: [/زمان\s*(و\s*مکان\s*)?(ارائه|کلاس)/, /ساعت\s*کلاس/, /زمان\s*ارایه/, /class\s*(time|schedule)/i],
  },
  {
    field: "examSchedule",
    patterns: [/(زمان|تاریخ|ساعت)\s*(و\s*ساعت\s*)?امتحان/, /امتحان/, /exam/i],
  },
];

function matchField(cell: string): Field | null {
  const text = normalizeText(cell);
  if (!text) return null;
  for (const { field, patterns } of HEADER_HINTS) {
    if (patterns.some((p) => p.test(text))) return field;
  }
  return null;
}

function isHeaderRow(cells: string[]): boolean {
  const matches = cells.map(matchField).filter(Boolean).length;
  return matches >= 3;
}

function buildMap(cells: string[]): Partial<Record<Field, number>> {
  const map: Partial<Record<Field, number>> = {};
  cells.forEach((cell, index) => {
    const field = matchField(cell);
    // Exam header often also contains "زمان"; keep the first specific match.
    if (field && map[field] === undefined) map[field] = index;
  });
  return map;
}

function pick(cells: string[], index: number | undefined): string {
  if (index === undefined) return "";
  return normalizeText(cells[index] ?? "");
}

function toNumber(value: string): number | null {
  const match = value.match(/\d+(\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Rule-based parser for a pasted university offerings table.
 * Repeated headers, separators and duplicate rows are dropped; rows the parser
 * cannot read confidently are returned as `ambiguous` for AI fallback.
 */
export function parseTable(input: string): ParseResult {
  const rows = splitRows(input ?? "");
  const sections: ParsedSection[] = [];
  const ambiguous: AmbiguousRow[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  let duplicates = 0;
  let map: Partial<Record<Field, number>> = {};
  let headerFound = false;

  rows.forEach((row, i) => {
    const cells = splitCells(row);
    const meaningful = cells.filter((c) => c.length > 0);
    if (meaningful.length === 0) {
      skipped++;
      return;
    }

    if (isHeaderRow(cells)) {
      map = buildMap(cells);
      headerFound = true;
      skipped++;
      return;
    }

    // Separator / title rows inside the table.
    if (meaningful.length < 3 || /^[-=_\s|]+$/.test(row.trim())) {
      skipped++;
      return;
    }

    if (!headerFound) {
      ambiguous.push({ line: i + 1, raw: row, reason: "no_header", partial: {} });
      return;
    }

    const courseCode = pick(cells, map.courseCode);
    const courseName = pick(cells, map.courseName);
    const unitsRaw = pick(cells, map.units);
    const units = toNumber(unitsRaw);
    const groupNumber = pick(cells, map.groupNumber) || "1";
    const capacity = toNumber(pick(cells, map.capacity));
    const gender = parseGender(pick(cells, map.gender));
    const professor = pick(cells, map.professor);
    const classScheduleRaw = pick(cells, map.classSchedule);
    const examScheduleRaw = pick(cells, map.examSchedule);

    const partial: Partial<ParsedSection> = {
      courseCode,
      courseName,
      groupNumber,
      gender,
      professor,
      classScheduleRaw,
      examScheduleRaw,
    };
    if (units !== null) partial.units = units;
    if (capacity !== null) partial.capacity = capacity;

    if (!courseName || units === null || units < 0 || units > 12) {
      ambiguous.push({ line: i + 1, raw: row, reason: "missing_core_fields", partial });
      return;
    }

    const schedule = parseClassSchedule(classScheduleRaw);
    if (schedule.ambiguous) {
      ambiguous.push({ line: i + 1, raw: row, reason: "unreadable_class_time", partial });
      return;
    }

    const exam = parseExam(examScheduleRaw);
    if (exam.ambiguous) {
      ambiguous.push({ line: i + 1, raw: row, reason: "unreadable_exam_time", partial });
      return;
    }

    const key = `${courseCode || courseName}#${groupNumber}`;
    if (seen.has(key)) {
      duplicates++;
      return;
    }
    seen.add(key);

    sections.push({
      courseCode: courseCode || courseName,
      courseName,
      groupNumber,
      units,
      capacity,
      gender,
      professor,
      classScheduleRaw,
      examScheduleRaw,
      meetings: schedule.meetings,
      exam: exam.exam,
    });
  });

  return { sections, ambiguous, skipped, duplicates, headerFound };
}
