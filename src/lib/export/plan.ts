import type { Plan } from "@/lib/scheduling";

export interface ExportLabels {
  title: string;
  course: string;
  section: string;
  professor: string;
  meetings: string;
  exam: string;
  credits: string;
  dayName: (day: number) => string;
}

export function planToCsv(plan: Plan, labels: ExportLabels): string {
  const rows = [
    [labels.course, labels.section, labels.professor, labels.meetings, labels.exam, labels.credits],
    ...plan.entries.map((entry) => [
      `${entry.course.code} — ${entry.course.nameEn}`,
      entry.section.sectionName,
      entry.section.professor ?? "",
      entry.section.meetings
        .map((meeting) => `${labels.dayName(meeting.day)} ${meeting.start}-${meeting.end}`)
        .join(" | "),
      entry.section.exam
        ? `${entry.section.exam.date} ${entry.section.exam.start}-${entry.section.exam.end}`
        : "",
      String(entry.course.credits),
    ]),
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

/** HTML-table .xls is intentionally dependency-free and opens in Excel/LibreOffice. */
export function planToExcelHtml(plan: Plan, labels: ExportLabels): string {
  const escape = escapeHtml;
  const rows = plan.entries
    .map(
      (entry) =>
        `<tr><td>${escape(`${entry.course.code} — ${entry.course.nameEn}`)}</td><td>${escape(entry.section.sectionName)}</td><td>${escape(entry.section.professor ?? "")}</td><td>${escape(entry.section.meetings.map((m) => `${labels.dayName(m.day)} ${m.start}-${m.end}`).join(" | "))}</td><td>${escape(entry.section.exam ? `${entry.section.exam.date} ${entry.section.exam.start}-${entry.section.exam.end}` : "")}</td><td>${entry.course.credits}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><table><thead><tr><th>${escape(labels.course)}</th><th>${escape(labels.section)}</th><th>${escape(labels.professor)}</th><th>${escape(labels.meetings)}</th><th>${escape(labels.exam)}</th><th>${escape(labels.credits)}</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

export function planToIcs(
  plan: Plan,
  dates: { start: string | null; end: string | null },
  title = "HafezPlan",
): string {
  const startDate = parseDate(dates.start);
  const endDate = parseDate(dates.end);
  if (!startDate || !endDate || endDate < startDate) throw new Error("semester_dates_required");
  const stamp = formatUtc(new Date());
  const events: string[] = [];

  for (const entry of plan.entries) {
    for (const meeting of entry.section.meetings) {
      const first = firstWeekday(startDate, meeting.day);
      if (first > endDate) continue;
      events.push(
        [
          "BEGIN:VEVENT",
          `UID:${icsEscape(`${plan.id}-${entry.section.id}-${meeting.day}-${meeting.start}`)}@hafezplan`,
          `DTSTAMP:${stamp}`,
          `DTSTART:${formatLocal(first, meeting.start)}`,
          `DTEND:${formatLocal(first, meeting.end)}`,
          `RRULE:FREQ=WEEKLY;UNTIL=${formatUtc(endOfDayUtc(endDate))}`,
          `SUMMARY:${icsEscape(`${entry.course.code} ${entry.course.nameEn}`)}`,
          `DESCRIPTION:${icsEscape(`${entry.section.professor ?? ""} · ${entry.section.sectionName}`)}`,
          ...(entry.section.location ? [`LOCATION:${icsEscape(entry.section.location)}`] : []),
          "END:VEVENT",
        ].join("\r\n"),
      );
    }
    const exam = entry.section.exam;
    const examDate = exam ? parseDate(exam.date) : null;
    if (exam && examDate) {
      events.push(
        [
          "BEGIN:VEVENT",
          `UID:${icsEscape(`${plan.id}-${entry.section.id}-exam`)}@hafezplan`,
          `DTSTAMP:${stamp}`,
          `DTSTART:${formatLocal(examDate, exam.start)}`,
          `DTEND:${formatLocal(examDate, exam.end)}`,
          `SUMMARY:${icsEscape(`${title}: ${entry.course.code}`)}`,
          "END:VEVENT",
        ].join("\r\n"),
      );
    }
  }

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HafezPlan//Schedule//EN",
    "CALSCALE:GREGORIAN",
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function downloadText(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  downloadBlob(filename, blob);
}

export async function downloadPlanImage(plan: Plan, labels: ExportLabels): Promise<void> {
  const width = 1400;
  const rowHeight = 76;
  const height = 150 + plan.entries.length * rowHeight;
  const lines = plan.entries.map((entry, index) => {
    const y = 125 + index * rowHeight;
    const meeting = entry.section.meetings
      .map((m) => `${labels.dayName(m.day)} ${m.start}–${m.end}`)
      .join(" · ");
    return `<rect x="40" y="${y - 34}" width="1320" height="60" rx="12" fill="${index % 2 ? "#f4f4f5" : "#fafafa"}"/><text x="65" y="${y - 6}" font-size="22" font-weight="700">${escapeXml(`${entry.course.code} — ${entry.course.nameEn}`)}</text><text x="65" y="${y + 18}" font-size="16" fill="#52525b">${escapeXml(`${entry.section.professor ?? ""} · ${meeting}`)}</text>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><text x="40" y="52" font-family="sans-serif" font-size="32" font-weight="700" fill="#18181b">${escapeXml(labels.title)}</text><text x="40" y="82" font-family="sans-serif" font-size="18" fill="#71717a">${plan.credits} ${escapeXml(labels.credits)}</text><g font-family="sans-serif" fill="#18181b">${lines.join("")}</g></svg>`;
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas_unavailable");
    context.drawImage(image, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error("image_export_failed"))),
        "image/png",
      ),
    );
    downloadBlob(`hafezplan-${plan.id}.png`, blob);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image_export_failed"));
    image.src = url;
  });
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function parseDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function firstWeekday(start: Date, appDay: number): Date {
  const jsDay = (appDay + 6) % 7;
  const date = new Date(start);
  date.setDate(date.getDate() + ((jsDay - date.getDay() + 7) % 7));
  return date;
}

function formatLocal(date: Date, time: string): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${time.replace(":", "")}00`;
}

function formatUtc(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function endOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59));
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function icsEscape(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\n", "\\n");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeXml(value: string): string {
  return escapeHtml(value).replaceAll("'", "&apos;");
}
