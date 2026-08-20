import type { PrereqNode } from "./types";

export interface PrereqContext {
  /** Codes the student has completed. */
  completed: Set<string>;
  /** Codes known to the catalog (used to detect unresolvable references). */
  known: Set<string>;
  /** Codes being taken in the same semester (satisfies corequisites). */
  concurrent?: Set<string>;
}

export type PrereqOutcome = "satisfied" | "unsatisfied" | "unknown";

export interface PrereqResult {
  outcome: PrereqOutcome;
  /** Course codes that are missing and block satisfaction. */
  missing: string[];
  /** Referenced codes that are not present in the catalog at all. */
  unknownCodes: string[];
}

const merge = (a: PrereqResult, b: PrereqResult): PrereqResult => ({
  outcome: a.outcome,
  missing: [...a.missing, ...b.missing],
  unknownCodes: [...a.unknownCodes, ...b.unknownCodes],
});

/**
 * Deterministically evaluate a structured prerequisite tree.
 * Supports single, AND, OR and arbitrarily nested combinations.
 */
export function evaluatePrereq(
  node: PrereqNode | null | undefined,
  ctx: PrereqContext,
): PrereqResult {
  if (!node) return { outcome: "satisfied", missing: [], unknownCodes: [] };

  if (node.type === "course") {
    const code = node.code;
    if (ctx.completed.has(code)) return { outcome: "satisfied", missing: [], unknownCodes: [] };
    if (ctx.concurrent?.has(code)) return { outcome: "satisfied", missing: [], unknownCodes: [] };
    if (!ctx.known.has(code)) {
      return { outcome: "unknown", missing: [code], unknownCodes: [code] };
    }
    return { outcome: "unsatisfied", missing: [code], unknownCodes: [] };
  }

  const results = node.items.map((item) => evaluatePrereq(item, ctx));

  if (node.type === "and") {
    let acc: PrereqResult = { outcome: "satisfied", missing: [], unknownCodes: [] };
    let hasUnknown = false;
    let hasUnsatisfied = false;
    for (const r of results) {
      if (r.outcome === "unsatisfied") hasUnsatisfied = true;
      if (r.outcome === "unknown") hasUnknown = true;
      if (r.outcome !== "satisfied") acc = merge(acc, r);
    }
    return {
      outcome: hasUnsatisfied ? "unsatisfied" : hasUnknown ? "unknown" : "satisfied",
      missing: acc.missing,
      unknownCodes: acc.unknownCodes,
    };
  }

  // OR
  if (results.some((r) => r.outcome === "satisfied")) {
    return { outcome: "satisfied", missing: [], unknownCodes: [] };
  }
  const hasUnknown = results.some((r) => r.outcome === "unknown");
  return {
    outcome: hasUnknown ? "unknown" : "unsatisfied",
    missing: results.flatMap((r) => r.missing),
    unknownCodes: results.flatMap((r) => r.unknownCodes),
  };
}

/** Human-readable rendering of a prerequisite tree, e.g. "(A and B) or C". */
export function describePrereq(
  node: PrereqNode | null | undefined,
  and: string,
  or: string,
): string {
  if (!node) return "";
  if (node.type === "course") return node.code;
  const joiner = node.type === "and" ? ` ${and} ` : ` ${or} `;
  const parts = node.items.map((item) =>
    item.type === "course" ? item.code : `(${describePrereq(item, and, or)})`,
  );
  return parts.join(joiner);
}

/** All course codes referenced anywhere in the tree. */
export function prereqCodes(node: PrereqNode | null | undefined): string[] {
  if (!node) return [];
  if (node.type === "course") return [node.code];
  return node.items.flatMap(prereqCodes);
}
