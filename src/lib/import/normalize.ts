/** Text normalisation helpers for university table input. Pure, testable. */

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function normalizeDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (ch) => {
    const fa = FA_DIGITS.indexOf(ch);
    if (fa >= 0) return String(fa);
    return String(AR_DIGITS.indexOf(ch));
  });
}

/** Collapses odd whitespace, unifies Arabic/Persian letters and digits. */
export function normalizeText(input: string): string {
  return normalizeDigits(input)
    .replace(/\u200c/g, " ")
    .replace(/[ي]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/[\t\u00a0]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Splits a pasted table into raw rows, dropping empty lines. */
export function splitRows(input: string): string[] {
  return normalizeDigits(input)
    .split(/\r?\n/)
    .map((line) => line.replace(/[\u200e\u200f]/g, "").trimEnd())
    .filter((line) => line.trim().length > 0);
}

export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (ch === "," && !quoted) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out;
}

/** Splits one row into cells: tab, pipe, comma (CSV) or 2+ spaces. */
export function splitCells(row: string): string[] {
  let raw: string[];
  if (/\t/.test(row)) raw = row.split("\t");
  else if (/\|/.test(row)) raw = row.split("|");
  else if (/ {2,}/.test(row)) raw = row.split(/ {2,}/);
  else if (/,/.test(row)) raw = splitCsvLine(row);
  else raw = [row];
  return raw.map((cell) => normalizeText(cell));
}
