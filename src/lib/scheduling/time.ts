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
  const match = date.match(/^(\d{4})([-/])(\d{2})\2(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[3]);
  const day = Number(match[4]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  if (match[2] === "/") return true; // A validated local-calendar label (normally Jalali).
  const value = new Date(Date.UTC(year, month - 1, day));
  return (
    value.getUTCFullYear() === year &&
    value.getUTCMonth() === month - 1 &&
    value.getUTCDate() === day
  );
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
