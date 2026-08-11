import type { ExamSlot, Meeting } from "./types";

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map((v) => parseInt(v, 10));
  return (h || 0) * 60 + (m || 0);
}

export function fromMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

export function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date));
}

/** Half-open overlap: 11:00-13:00 and 13:00-15:00 do NOT overlap. */
export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function meetingsOverlap(a: Meeting, b: Meeting): boolean {
  if (a.day !== b.day) return false;
  return rangesOverlap(toMinutes(a.start), toMinutes(a.end), toMinutes(b.start), toMinutes(b.end));
}

export function examsOverlap(a?: ExamSlot | null, b?: ExamSlot | null): boolean {
  if (!a || !b) return false;
  if (a.date !== b.date) return false;
  return rangesOverlap(toMinutes(a.start), toMinutes(a.end), toMinutes(b.start), toMinutes(b.end));
}

export function meetingSetsConflict(a: Meeting[], b: Meeting[]): boolean {
  for (const m of a) for (const n of b) if (meetingsOverlap(m, n)) return true;
  return false;
}
