import { evaluatePrereq, type PrereqContext } from "./prereq";
import type { Course, Section, StudentState } from "./types";

export type EligibilityStatus =
  | "eligible"
  | "passed"
  | "current"
  | "missing_prereq"
  | "missing_coreq"
  | "uncertain"
  | "avoided"
  | "no_sections";

export interface CourseEligibility {
  course: Course;
  status: EligibilityStatus;
  required: boolean;
  offered: boolean;
  sections: Section[];
  /** Missing prerequisite / corequisite course codes. */
  missing: string[];
  unknownCodes: string[];
  overridden: boolean;
}

export interface EligibilityInput {
  courses: Course[];
  sections: Section[];
  student: StudentState;
}

/**
 * Determines, for every offered course, whether the student may actually take it.
 * "Offered" never implies "eligible".
 */
export function evaluateEligibility({ courses, sections, student }: EligibilityInput): CourseEligibility[] {
  const known = new Set(courses.map((c) => c.code));
  const completed = new Set(student.passed);
  const current = new Set(student.current);
  const avoid = new Set(student.avoid);
  const required = new Set(student.required);

  const sectionsByCourse = new Map<string, Section[]>();
  for (const s of sections) {
    const list = sectionsByCourse.get(s.courseCode) ?? [];
    list.push(s);
    sectionsByCourse.set(s.courseCode, list);
  }

  // Corequisites may be satisfied by courses taken in the same semester,
  // so every offered course counts as potentially concurrent.
  const concurrent = new Set(courses.map((c) => c.code));

  const ctx: PrereqContext = { completed, known };
  const coreqCtx: PrereqContext = { completed, known, concurrent };

  return courses.map((course) => {
    const courseSections = sectionsByCourse.get(course.code) ?? [];
    const override = student.overrides[course.code];
    const base: Omit<CourseEligibility, "status"> = {
      course,
      required: required.has(course.code),
      offered: courseSections.length > 0,
      sections: courseSections,
      missing: [],
      unknownCodes: [],
      overridden: override !== undefined,
    };

    if (override === false) return { ...base, status: "missing_prereq" };

    if (completed.has(course.code) && !course.repeatable) {
      return { ...base, status: "passed" };
    }
    if (current.has(course.code)) return { ...base, status: "current" };
    if (avoid.has(course.code)) return { ...base, status: "avoided" };

    if (override === true) {
      return { ...base, status: courseSections.length ? "eligible" : "no_sections" };
    }

    const pre = evaluatePrereq(course.prerequisites, ctx);
    if (pre.outcome === "unsatisfied") {
      return { ...base, status: "missing_prereq", missing: unique(pre.missing) };
    }
    if (pre.outcome === "unknown") {
      return {
        ...base,
        status: "uncertain",
        missing: unique(pre.missing),
        unknownCodes: unique(pre.unknownCodes),
      };
    }

    const co = evaluatePrereq(course.corequisites, coreqCtx);
    if (co.outcome === "unsatisfied") {
      return { ...base, status: "missing_coreq", missing: unique(co.missing) };
    }
    if (co.outcome === "unknown") {
      return {
        ...base,
        status: "uncertain",
        missing: unique(co.missing),
        unknownCodes: unique(co.unknownCodes),
      };
    }

    if (courseSections.length === 0) return { ...base, status: "no_sections" };
    return { ...base, status: "eligible" };
  });
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function isTakeable(status: EligibilityStatus): boolean {
  return status === "eligible";
}
