import type { ExamSlot, Meeting } from "@/lib/scheduling/types";
import { normalizeText } from "./normalize";

const DAY_PATTERNS: { day: number; re: RegExp }[] = [
  { day: 0, re: /saturday/gi },
  { day: 1, re: /sunday/gi },
  { day: 2, re: /monday/gi },
  { day: 3, re: /tuesday/gi },
  { day: 4, re: /wednesday/gi },
  { day: 5, re: /thursday/gi },
  { day: 6, re: /friday/gi },
  { day: 1, re: /یک\s*شنبه/g },
  { day: 2, re: /دو\s*شنبه/g },
  { day: 3, re: /سه\s*شنبه/g },
  { day: 4, re: /چهار\s*شنبه/g },
  { day: 5, re: /پنج\s*شنبه/g },
  { day: 6, re: /جمعه/g },
  { day: 0, re: /شنبه/g },
];

const TIME_RANGE =
  /(\d{1,2})\s*[:.]\s*(\d{2})\s*(?:-|–|—|تا|الی|لغایت)\s*(\d{1,2})\s*[:.]\s*(\d{2})/g;

function pad(value: string): string {
  return value.padStart(2, "0");
}

interface DayHit {
  day: number;
  index: number;
}

function findDays(text: string): DayHit[] {
  const hits: DayHit[] = [];
  const taken: boolean[] = new Array(text.length).fill(false);
  for (const { day, re } of DAY_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const start = m.index;
      if (taken[start]) continue;
      let overlaps = false;
      for (let i = start; i < start + m[0].length; i++) if (taken[i]) overlaps = true;
      if (overlaps) continue;
      for (let i = start; i < start + m[0].length; i++) taken[i] = true;
      hits.push({ day, index: start });
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

export interface ParsedSchedule {
  meetings: Meeting[];
  /** True when the cell has content the parser could not interpret. */
  ambiguous: boolean;
}

/** Parses a class-time cell like "شنبه 08:00-09:30 و دوشنبه 10:00 تا 11:30". */
export function parseClassSchedule(raw: string): ParsedSchedule {
  const text = normalizeText(raw ?? "");
  if (!text) return { meetings: [], ambiguous: false };

  const days = findDays(text);
  const times: { start: string; end: string; index: number }[] = [];
  TIME_RANGE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TIME_RANGE.exec(text))) {
    times.push({
      start: `${pad(m[1]!)}:${m[2]!}`,
      end: `${pad(m[3]!)}:${m[4]!}`,
      index: m.index,
    });
  }

  if (times.length === 0 || days.length === 0) {
    return { meetings: [], ambiguous: true };
  }

  const meetings: Meeting[] = [];
  for (let i = 0; i < times.length; i++) {
    const time = times[i]!;
    const previousTimeIndex = i > 0 ? times[i - 1]!.index : -1;
    // Days written between the previous time range and this one share this time.
    let owners = days.filter((d) => d.index < time.index && d.index > previousTimeIndex);
    if (owners.length === 0) {
      const before = days.filter((d) => d.index < time.index);
      const after = days.filter((d) => d.index > time.index);
      const fallback = before.length ? before[before.length - 1] : after[0];
      owners = fallback ? [fallback] : [];
    }
    for (const owner of owners) {
      meetings.push({ day: owner.day, start: time.start, end: time.end });
    }
  }

  const deduped: Meeting[] = [];
  for (const meeting of meetings) {
    if (
      !deduped.some(
        (d) => d.day === meeting.day && d.start === meeting.start && d.end === meeting.end,
      )
    ) {
      deduped.push(meeting);
    }
  }

  return { meetings: deduped, ambiguous: deduped.length === 0 };
}

export interface ParsedExam {
  exam: (ExamSlot & { label: string }) | null;
  ambiguous: boolean;
}

/** Parses an exam cell; Gregorian dates are normalized to ISO while Jalali labels stay unchanged. */
export function parseExam(raw: string): ParsedExam {
  const text = normalizeText(raw ?? "");
  if (!text || /^(ندارد|-|—|بدون امتحان)$/i.test(text)) return { exam: null, ambiguous: false };

  const dateMatch = text.match(/(\d{4})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{1,2})/);
  TIME_RANGE.lastIndex = 0;
  const timeMatch = TIME_RANGE.exec(text);

  if (!dateMatch) return { exam: null, ambiguous: true };

  const label = `${dateMatch[1]}/${pad(dateMatch[2]!)}/${pad(dateMatch[3]!)}`;
  const date = Number(dateMatch[1]) >= 1900 ? label.replaceAll("/", "-") : label;
  if (!timeMatch) {
    const single = text.match(/(\d{1,2})\s*[:.]\s*(\d{2})/);
    if (!single) return { exam: null, ambiguous: true };
    const start = `${pad(single[1]!)}:${single[2]!}`;
    const endMinutes = Number(single[1]) * 60 + Number(single[2]) + 120;
    const end = `${pad(String(Math.floor(endMinutes / 60)))}:${pad(String(endMinutes % 60))}`;
    return { exam: { date, start, end, label }, ambiguous: false };
  }

  return {
    exam: {
      date,
      start: `${pad(timeMatch[1]!)}:${timeMatch[2]!}`,
      end: `${pad(timeMatch[3]!)}:${timeMatch[4]!}`,
      label,
    },
    ambiguous: false,
  };
}

export function parseGender(raw: string): "male" | "female" | "mixed" {
  const text = normalizeText(raw ?? "");
  if (/زن|خواهر|دختر|female|women/i.test(text)) return "female";
  if (/مرد|برادر|پسر|male|men/i.test(text)) return "male";
  return "mixed";
}
