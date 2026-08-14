import type { ExamSlot, Meeting } from "@/lib/scheduling/types";

export type Gender = "male" | "female" | "mixed";

export interface ParsedSection {
  courseCode: string;
  courseName: string;
  groupNumber: string;
  units: number;
  capacity: number | null;
  gender: Gender;
  professor: string;
  classScheduleRaw: string;
  examScheduleRaw: string;
  meetings: Meeting[];
  exam: (ExamSlot & { label: string }) | null;
}

export interface AmbiguousRow {
  line: number;
  raw: string;
  reason: string;
  /** Whatever the rule-based parser managed to read; may be partial. */
  partial: Partial<ParsedSection>;
}

export interface ParseResult {
  sections: ParsedSection[];
  ambiguous: AmbiguousRow[];
  /** Rows dropped as repeated headers / separators / duplicates. */
  skipped: number;
  duplicates: number;
  headerFound: boolean;
}
