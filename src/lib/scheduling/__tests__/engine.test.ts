import { describe, expect, it } from "vitest";
import { analyzeDifferences } from "../analyze";
import { evaluateEligibility } from "../eligibility";
import { MAX_CANDIDATE_PLANS, solve } from "../engine";
import { evaluatePrereq } from "../prereq";
import { examsOverlap, meetingsOverlap } from "../time";
import { validateCatalog } from "../validate";
import {
  defaultPreferences,
  emptyStudentState,
  type Course,
  type Preferences,
  type PrereqNode,
  type Section,
  type StudentState,
} from "../types";

const course = (code: string, credits = 3, extra: Partial<Course> = {}): Course => ({
  id: code,
  code,
  nameEn: code,
  nameFa: code,
  credits,
  repeatable: false,
  prerequisites: null,
  corequisites: null,
  ...extra,
});

const section = (
  code: string,
  name: string,
  professor: string,
  meetings: { day: number; start: string; end: string }[],
  exam?: { date: string; start: string; end: string },
): Section => ({
  id: `${code}-${name}`,
  courseId: code,
  courseCode: code,
  sectionName: name,
  gender: "mixed",
  professor,
  capacity: 30,
  location: null,
  meetings,
  exam: exam ?? null,
});

const student = (over: Partial<StudentState> = {}): StudentState => ({
  ...emptyStudentState(),
  ...over,
});
const prefs = (over: Partial<Preferences> = {}): Preferences => ({
  ...defaultPreferences(),
  ...over,
});

describe("time conflicts", () => {
  it("detects identical overlapping classes", () => {
    expect(
      meetingsOverlap(
        { day: 0, start: "11:00", end: "13:00" },
        { day: 0, start: "11:00", end: "13:00" },
      ),
    ).toBe(true);
  });
  it("detects partial overlap", () => {
    expect(
      meetingsOverlap(
        { day: 0, start: "11:00", end: "13:00" },
        { day: 0, start: "12:00", end: "14:00" },
      ),
    ).toBe(true);
  });
  it("allows back-to-back classes", () => {
    expect(
      meetingsOverlap(
        { day: 0, start: "11:00", end: "13:00" },
        { day: 0, start: "13:00", end: "15:00" },
      ),
    ).toBe(false);
  });
  it("ignores different days", () => {
    expect(
      meetingsOverlap(
        { day: 0, start: "11:00", end: "13:00" },
        { day: 1, start: "11:00", end: "13:00" },
      ),
    ).toBe(false);
  });
  it("detects exam overlap only on the same date", () => {
    expect(
      examsOverlap(
        { date: "2026-06-10", start: "09:00", end: "11:00" },
        { date: "2026-06-10", start: "10:00", end: "12:00" },
      ),
    ).toBe(true);
    expect(
      examsOverlap(
        { date: "2026-06-10", start: "09:00", end: "11:00" },
        { date: "2026-06-11", start: "09:00", end: "11:00" },
      ),
    ).toBe(false);
    expect(
      examsOverlap(
        { date: "2026-06-10", start: "09:00", end: "11:00" },
        { date: "2026-06-10", start: "11:00", end: "13:00" },
      ),
    ).toBe(false);
  });
});

describe("prerequisites", () => {
  const known = new Set(["A", "B", "C"]);
  it("handles a single prerequisite", () => {
    expect(
      evaluatePrereq({ type: "course", code: "A" }, { completed: new Set(["A"]), known }).outcome,
    ).toBe("satisfied");
    expect(
      evaluatePrereq({ type: "course", code: "A" }, { completed: new Set(), known }).outcome,
    ).toBe("unsatisfied");
  });
  it("handles AND", () => {
    const node: PrereqNode = {
      type: "and",
      items: [
        { type: "course", code: "A" },
        { type: "course", code: "B" },
      ],
    };
    expect(evaluatePrereq(node, { completed: new Set(["A"]), known }).outcome).toBe("unsatisfied");
    expect(evaluatePrereq(node, { completed: new Set(["A", "B"]), known }).outcome).toBe(
      "satisfied",
    );
  });
  it("handles OR", () => {
    const node: PrereqNode = {
      type: "or",
      items: [
        { type: "course", code: "A" },
        { type: "course", code: "B" },
      ],
    };
    expect(evaluatePrereq(node, { completed: new Set(["B"]), known }).outcome).toBe("satisfied");
    expect(evaluatePrereq(node, { completed: new Set(), known }).outcome).toBe("unsatisfied");
  });
  it("handles nested (A AND B) OR C", () => {
    const node: PrereqNode = {
      type: "or",
      items: [
        {
          type: "and",
          items: [
            { type: "course", code: "A" },
            { type: "course", code: "B" },
          ],
        },
        { type: "course", code: "C" },
      ],
    };
    expect(evaluatePrereq(node, { completed: new Set(["C"]), known }).outcome).toBe("satisfied");
    expect(evaluatePrereq(node, { completed: new Set(["A", "B"]), known }).outcome).toBe(
      "satisfied",
    );
    expect(evaluatePrereq(node, { completed: new Set(["A"]), known }).outcome).toBe("unsatisfied");
  });
  it("reports unknown when the prerequisite is not in the catalog", () => {
    const res = evaluatePrereq({ type: "course", code: "ZZZ" }, { completed: new Set(), known });
    expect(res.outcome).toBe("unknown");
    expect(res.unknownCodes).toEqual(["ZZZ"]);
  });
});

describe("eligibility", () => {
  const courses = [
    course("A"),
    course("B", 3, { prerequisites: { type: "course", code: "A" } }),
    course("L", 1, { corequisites: { type: "course", code: "A" } }),
    course("X", 3, { prerequisites: { type: "course", code: "GHOST" } }),
  ];
  const sections = [
    section("A", "01", "P1", [{ day: 0, start: "08:00", end: "10:00" }]),
    section("B", "01", "P2", [{ day: 1, start: "08:00", end: "10:00" }]),
    section("L", "01", "P3", [{ day: 2, start: "08:00", end: "10:00" }]),
    section("X", "01", "P4", [{ day: 3, start: "08:00", end: "10:00" }]),
  ];

  it("marks passed courses as passed, not eligible", () => {
    const result = evaluateEligibility({ courses, sections, student: student({ passed: ["A"] }) });
    expect(result.find((r) => r.course.code === "A")?.status).toBe("passed");
    expect(result.find((r) => r.course.code === "B")?.status).toBe("eligible");
  });
  it("blocks courses whose prerequisites are missing", () => {
    const result = evaluateEligibility({ courses, sections, student: student() });
    expect(result.find((r) => r.course.code === "B")?.status).toBe("missing_prereq");
  });
  it("satisfies corequisites with concurrently offered courses", () => {
    const result = evaluateEligibility({ courses, sections, student: student() });
    expect(result.find((r) => r.course.code === "L")?.status).toBe("eligible");
  });
  it("reports uncertain instead of guessing", () => {
    const result = evaluateEligibility({ courses, sections, student: student() });
    expect(result.find((r) => r.course.code === "X")?.status).toBe("uncertain");
  });
  it("honours a manual override", () => {
    const result = evaluateEligibility({
      courses,
      sections,
      student: student({ overrides: { B: true } }),
    });
    expect(result.find((r) => r.course.code === "B")?.status).toBe("eligible");
  });
});

describe("scheduling engine", () => {
  const courses = [course("A"), course("B"), course("C"), course("D")];
  const sections = [
    section("A", "01", "P1", [{ day: 0, start: "08:00", end: "10:00" }], {
      date: "2026-06-01",
      start: "09:00",
      end: "11:00",
    }),
    section("A", "02", "P2", [{ day: 1, start: "08:00", end: "10:00" }], {
      date: "2026-06-01",
      start: "09:00",
      end: "11:00",
    }),
    section("B", "01", "P3", [{ day: 0, start: "10:00", end: "12:00" }], {
      date: "2026-06-03",
      start: "09:00",
      end: "11:00",
    }),
    section("B", "02", "P4", [{ day: 2, start: "10:00", end: "12:00" }], {
      date: "2026-06-03",
      start: "09:00",
      end: "11:00",
    }),
    section("C", "01", "P5", [{ day: 3, start: "10:00", end: "12:00" }], {
      date: "2026-06-05",
      start: "09:00",
      end: "11:00",
    }),
    section("D", "01", "P6", [{ day: 4, start: "10:00", end: "12:00" }], {
      date: "2026-06-07",
      start: "09:00",
      end: "11:00",
    }),
  ];

  it("rejects credit maxima above the absolute 24-credit limit", () => {
    const res = solve({
      courses,
      sections,
      student: student(),
      preferences: prefs({ minCredits: 12, maxCredits: 25 }),
    });
    expect(res.plans).toHaveLength(0);
    expect(res.blockers).toEqual([{ kind: "invalid_credit_range", min: 12, max: 25 }]);
  });

  it("finds plans that respect required courses and credit limits", () => {
    const res = solve({
      courses,
      sections,
      student: student({ required: ["A", "B"] }),
      preferences: prefs({ minCredits: 6, maxCredits: 9 }),
      refinements: [],
    });
    expect(res.plans.length).toBeGreaterThan(0);
    for (const plan of res.plans) {
      expect(plan.credits).toBeGreaterThanOrEqual(6);
      expect(plan.credits).toBeLessThanOrEqual(9);
      expect(plan.entries.map((e) => e.course.code)).toEqual(expect.arrayContaining(["A", "B"]));
    }
  });

  it("never returns overlapping classes", () => {
    const overlapping = [
      section("A", "01", "P1", [{ day: 0, start: "10:00", end: "12:00" }]),
      section("B", "01", "P2", [{ day: 0, start: "11:00", end: "13:00" }]),
    ];
    const res = solve({
      courses: [course("A"), course("B")],
      sections: overlapping,
      student: student(),
      preferences: prefs({ minCredits: 6, maxCredits: 6 }),
      refinements: [],
    });
    expect(res.plans).toHaveLength(0);
  });

  it("rejects exam conflicts", () => {
    const exams = [
      section("A", "01", "P1", [{ day: 0, start: "08:00", end: "10:00" }], {
        date: "2026-06-01",
        start: "09:00",
        end: "11:00",
      }),
      section("B", "01", "P2", [{ day: 1, start: "08:00", end: "10:00" }], {
        date: "2026-06-01",
        start: "10:00",
        end: "12:00",
      }),
    ];
    const res = solve({
      courses: [course("A"), course("B")],
      sections: exams,
      student: student(),
      preferences: prefs({ minCredits: 6, maxCredits: 6 }),
      refinements: [],
    });
    expect(res.plans).toHaveLength(0);
  });

  it("allows adjacent classes", () => {
    const adjacent = [
      section("A", "01", "P1", [{ day: 0, start: "11:00", end: "13:00" }]),
      section("B", "01", "P2", [{ day: 0, start: "13:00", end: "15:00" }]),
    ];
    const res = solve({
      courses: [course("A"), course("B")],
      sections: adjacent,
      student: student(),
      preferences: prefs({ minCredits: 6, maxCredits: 6 }),
      refinements: [],
    });
    expect(res.plans).toHaveLength(1);
  });

  it("reports zero plans with a reason when required credits exceed the maximum", () => {
    const res = solve({
      courses,
      sections,
      student: student({ required: ["A", "B", "C", "D"] }),
      preferences: prefs({ minCredits: 6, maxCredits: 9 }),
      refinements: [],
    });
    expect(res.plans).toHaveLength(0);
    expect(res.blockers.some((b) => b.kind === "required_over_max")).toBe(true);
  });

  it("explains an impossible required pair", () => {
    const clashing = [
      section("A", "01", "P1", [{ day: 0, start: "10:00", end: "12:00" }]),
      section("B", "01", "P2", [{ day: 0, start: "10:00", end: "12:00" }]),
    ];
    const res = solve({
      courses: [course("A"), course("B")],
      sections: clashing,
      student: student({ required: ["A", "B"] }),
      preferences: prefs({ minCredits: 6, maxCredits: 6 }),
      refinements: [],
    });
    expect(res.blockers.some((b) => b.kind === "required_class_conflict")).toBe(true);
  });

  it("respects personal blocked times", () => {
    const res = solve({
      courses,
      sections,
      student: student({ required: ["A"] }),
      preferences: prefs({
        minCredits: 3,
        maxCredits: 3,
        blockedTimes: [{ day: 0, start: "08:00", end: "12:00" }],
      }),
      refinements: [],
    });
    for (const plan of res.plans) {
      expect(plan.classDays).not.toContain(0);
    }
  });

  it("applies professor refinement as a real constraint", () => {
    const res = solve({
      courses,
      sections,
      student: student({ required: ["A"] }),
      preferences: prefs({ minCredits: 3, maxCredits: 3 }),
      refinements: [{ kind: "professor", courseCode: "A", professor: "P2" }],
    });
    expect(res.plans.length).toBeGreaterThan(0);
    for (const plan of res.plans) {
      expect(plan.entries.find((e) => e.course.code === "A")?.section.professor).toBe("P2");
    }
  });

  it("applies a free-day refinement", () => {
    const res = solve({
      courses,
      sections,
      student: student(),
      preferences: prefs({ minCredits: 3, maxCredits: 12 }),
      refinements: [{ kind: "freeDay", day: 0 }],
    });
    expect(res.plans.length).toBeGreaterThan(0);
    for (const plan of res.plans) expect(plan.freeDays).toContain(0);
  });

  it("returns exactly one plan when only one combination is valid", () => {
    const res = solve({
      courses: [course("C"), course("D")],
      sections: sections.filter((s) => ["C", "D"].includes(s.courseCode)),
      student: student({ required: ["C", "D"] }),
      preferences: prefs({ minCredits: 6, maxCredits: 6 }),
      refinements: [],
    });
    expect(res.plans).toHaveLength(1);
  });

  it("never exposes more than 100 candidate plans", () => {
    const many: Course[] = [];
    const manySections: Section[] = [];
    for (let c = 0; c < 8; c++) {
      const code = `M${c}`;
      many.push(course(code, 3));
      for (let s = 0; s < 5; s++) {
        manySections.push(
          section(code, `0${s}`, `Prof ${c}-${s}`, [
            {
              day: c % 7,
              start: `${String(8 + s * 2).padStart(2, "0")}:00`,
              end: `${String(9 + s * 2).padStart(2, "0")}:00`,
            },
          ]),
        );
      }
    }
    const res = solve({
      courses: many,
      sections: manySections,
      student: student(),
      preferences: prefs({ minCredits: 12, maxCredits: 21 }),
      refinements: [],
    });
    expect(res.plans.length).toBeLessThanOrEqual(MAX_CANDIDATE_PLANS);
    expect(res.totalFound).toBeGreaterThan(res.plans.length);
  });

  it("removes exact duplicates", () => {
    const res = solve({
      courses,
      sections,
      student: student(),
      preferences: prefs({ minCredits: 3, maxCredits: 12 }),
      refinements: [],
    });
    const keys = res.plans.map((p) =>
      p.entries
        .map((e) => e.section.id)
        .sort()
        .join("|"),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("narrows results as refinements are added, and restores them when undone", () => {
    const base = solve({
      courses,
      sections,
      student: student({ required: ["A"] }),
      preferences: prefs({ minCredits: 3, maxCredits: 12 }),
      refinements: [],
    });
    const refined = solve({
      courses,
      sections,
      student: student({ required: ["A"] }),
      preferences: prefs({ minCredits: 3, maxCredits: 12 }),
      refinements: [{ kind: "professor", courseCode: "A", professor: "P1" }],
    });
    expect(refined.totalFound).toBeLessThan(base.totalFound);
    const undone = solve({
      courses,
      sections,
      student: student({ required: ["A"] }),
      preferences: prefs({ minCredits: 3, maxCredits: 12 }),
      refinements: [],
    });
    expect(undone.totalFound).toBe(base.totalFound);
  });

  it("enforces take and skip choices independently of academic history", () => {
    const res = solve({
      courses,
      sections,
      student: student(),
      coursePreferences: { A: "take", B: "skip" },
      preferences: prefs({ minCredits: 3, maxCredits: 6 }),
    });
    expect(res.plans.length).toBeGreaterThan(0);
    for (const plan of res.plans) {
      expect(plan.entries.some((entry) => entry.course.code === "A")).toBe(true);
      expect(plan.entries.some((entry) => entry.course.code === "B")).toBe(false);
    }
  });

  it("rejects unavailable, full, and gender-incompatible sections", () => {
    const unavailable = section("A", "01", "P1", []);
    const full = {
      ...section("A", "02", "P2", [{ day: 0, start: "08:00", end: "10:00" }]),
      capacity: 0,
    };
    const womenOnly = {
      ...section("A", "03", "P3", [{ day: 1, start: "08:00", end: "10:00" }]),
      gender: "female" as const,
    };
    const res = solve({
      courses: [course("A")],
      sections: [unavailable, full, womenOnly],
      coursePreferences: { A: "take" },
      preferences: prefs({ minCredits: 3, maxCredits: 3, gender: "male" }),
    });
    expect(res.plans).toHaveLength(0);
    expect(res.blockers.some((blocker) => blocker.kind === "take_no_valid_section")).toBe(true);
  });

  it("requires a corequisite to be selected in the actual plan", () => {
    const linkedCourses = [
      course("A"),
      course("L", 3, { corequisites: { type: "course", code: "A" } }),
    ];
    const linkedSections = [
      section("A", "01", "P1", [{ day: 0, start: "08:00", end: "10:00" }]),
      section("L", "01", "P2", [{ day: 1, start: "08:00", end: "10:00" }]),
    ];
    const impossible = solve({
      courses: linkedCourses,
      sections: linkedSections,
      coursePreferences: { L: "take" },
      preferences: prefs({ minCredits: 3, maxCredits: 3 }),
    });
    expect(impossible.plans).toHaveLength(0);

    const valid = solve({
      courses: linkedCourses,
      sections: linkedSections,
      coursePreferences: { L: "take" },
      preferences: prefs({ minCredits: 6, maxCredits: 6 }),
    });
    expect(valid.plans).toHaveLength(1);
    expect(valid.plans[0]!.entries.map((entry) => entry.course.code).sort()).toEqual(["A", "L"]);
  });

  it("handles courses with multiple weekly meetings", () => {
    const multi = [
      section("A", "01", "P1", [
        { day: 0, start: "08:00", end: "10:00" },
        { day: 2, start: "08:00", end: "10:00" },
      ]),
      section("B", "01", "P2", [{ day: 2, start: "09:00", end: "11:00" }]),
    ];
    const res = solve({
      courses: [course("A"), course("B")],
      sections: multi,
      student: student(),
      preferences: prefs({ minCredits: 6, maxCredits: 6 }),
      refinements: [],
    });
    expect(res.plans).toHaveLength(0);
  });
});

describe("plan analysis", () => {
  it("only reports dimensions that actually differ", () => {
    const courses = [course("A"), course("B")];
    const sections = [
      section("A", "01", "P1", [{ day: 0, start: "08:00", end: "10:00" }]),
      section("A", "02", "P2", [{ day: 1, start: "08:00", end: "10:00" }]),
      section("B", "01", "P3", [{ day: 3, start: "08:00", end: "10:00" }]),
    ];
    const res = solve({
      courses,
      sections,
      student: student({ required: ["A", "B"] }),
      preferences: prefs({ minCredits: 6, maxCredits: 6 }),
      refinements: [],
    });
    const groups = analyzeDifferences(res.plans);
    expect(groups.some((g) => g.id === "professor:A")).toBe(true);
    expect(groups.some((g) => g.id === "professor:B")).toBe(false);
  });
});

describe("import validation", () => {
  it("flags duplicates, bad credits and impossible times", () => {
    const issues = validateCatalog({
      courses: [course("A"), course("A"), course("B", 99)],
      sections: [
        section("A", "01", "", [{ day: 0, start: "10:00", end: "09:00" }]),
        section("A", "01", "P", [{ day: 0, start: "10:00", end: "12:00" }]),
      ],
    });
    const codes = issues.map((i) => i.code);
    expect(codes).toContain("duplicate_course");
    expect(codes).toContain("invalid_credits");
    expect(codes).toContain("reversed_time");
    expect(codes).toContain("duplicate_section");
    expect(codes).toContain("missing_professor");
  });
});
