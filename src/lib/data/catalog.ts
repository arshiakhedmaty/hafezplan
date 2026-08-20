import { supabase } from "@/integrations/supabase/client";
import type { ParsedSection } from "@/lib/import/types";
import {
  defaultPreferences,
  emptyStudentState,
  type Course,
  type CoursePreference,
  type CoursePreferenceMap,
  type Gender,
  type Preferences,
  type PrereqNode,
  type Section,
  type StudentState,
} from "@/lib/scheduling";

export interface Catalog {
  courses: Course[];
  sections: Section[];
}

export interface AcademicProfile {
  displayName: string | null;
  major: string | null;
  degree: string | null;
  semester: number | null;
  gender: Exclude<Gender, "mixed"> | null;
  minCredits: number;
  maxCredits: number;
}

export async function fetchProfile(userId: string): Promise<AcademicProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, major, degree, semester, gender, min_credits, max_credits")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    displayName: data.display_name,
    major: data.major,
    degree: data.degree,
    semester: data.semester,
    gender: data.gender === "male" || data.gender === "female" ? data.gender : null,
    minCredits: data.min_credits,
    maxCredits: data.max_credits,
  };
}

export async function saveProfile(userId: string, patch: Partial<AcademicProfile>): Promise<void> {
  const row = {
    user_id: userId,
    ...(patch.displayName !== undefined ? { display_name: patch.displayName } : {}),
    ...(patch.major !== undefined ? { major: patch.major } : {}),
    ...(patch.degree !== undefined ? { degree: patch.degree } : {}),
    ...(patch.semester !== undefined ? { semester: patch.semester } : {}),
    ...(patch.gender !== undefined ? { gender: patch.gender } : {}),
    ...(patch.minCredits !== undefined ? { min_credits: patch.minCredits } : {}),
    ...(patch.maxCredits !== undefined ? { max_credits: patch.maxCredits } : {}),
  };
  const { error } = await supabase.from("profiles").upsert(row, { onConflict: "user_id" });
  if (error) throw error;
}

export async function fetchCatalog(): Promise<Catalog> {
  const [coursesRes, sectionsRes] = await Promise.all([
    supabase.from("courses").select("*").order("code"),
    supabase.from("course_sections").select("*").order("section_name"),
  ]);
  if (coursesRes.error) throw coursesRes.error;
  if (sectionsRes.error) throw sectionsRes.error;

  const courses: Course[] = (coursesRes.data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    nameEn: row.name_en,
    nameFa: row.name_fa,
    credits: row.credits,
    department: row.department,
    courseType: row.course_type,
    repeatable: row.repeatable,
    prerequisites: (row.prerequisites ?? null) as unknown as PrereqNode | null,
    corequisites: (row.corequisites ?? null) as unknown as PrereqNode | null,
  }));
  const byId = new Map(courses.map((c) => [c.id, c]));

  const sections: Section[] = (sectionsRes.data ?? [])
    .filter((row) => byId.has(row.course_id))
    .map((row) => ({
      id: row.id,
      courseId: row.course_id,
      courseCode: byId.get(row.course_id)!.code,
      sectionName: row.section_name,
      groupNumber: row.group_number,
      gender: (row.gender ?? "mixed") as Gender,
      professor: row.professor,
      capacity: row.capacity,
      location: row.location,
      meetings: (row.meetings ?? []) as unknown as Section["meetings"],
      exam:
        (row.exam_date_label || row.exam_date) && row.exam_start && row.exam_end
          ? {
              date: (row.exam_date ?? row.exam_date_label)!,
              start: row.exam_start,
              end: row.exam_end,
            }
          : null,
    }));

  return { courses, sections };
}

/* -------------------- reviewed catalog import -------------------- */

export type ImportSourceType = "paste" | "csv" | "json" | "image" | "manual";

export interface ImportSummary {
  importId: string;
  courses: number;
  sections: number;
}

/**
 * Atomically confirms a reviewed import. Validation happens in the review
 * layer and the database transaction either replaces the whole owned catalog
 * or leaves the previous catalog untouched.
 */
export async function saveImport(
  rawInput: string,
  parsed: ParsedSection[],
  sourceType: ImportSourceType,
): Promise<ImportSummary> {
  if (parsed.length === 0) throw new Error("sections_required");
  const courseCount = new Set(parsed.map((section) => section.courseCode)).size;
  const payload = parsed.map((section) => ({
    course_code: section.courseCode,
    course_name: section.courseName,
    group_number: section.groupNumber,
    units: Math.round(section.units),
    capacity: section.capacity,
    gender: section.gender,
    professor: section.professor,
    location: null,
    meetings: section.meetings,
    exam: section.exam,
  }));
  const { data, error } = await supabase.rpc("confirm_catalog_import", {
    p_raw_input: rawInput.slice(0, 200000),
    p_source_type: sourceType,
    p_stats: { courses: courseCount, sections: parsed.length },
    p_sections: payload as unknown as never,
  });
  if (error) throw error;
  return { importId: data, courses: courseCount, sections: parsed.length };
}

/* -------------------- per-course take/neutral/skip -------------------- */

export async function fetchCoursePreferences(
  userId: string,
): Promise<Record<string, CoursePreference>> {
  const { data, error } = await supabase
    .from("course_preferences")
    .select("course_id, preference")
    .eq("user_id", userId);
  if (error) throw error;
  const map: Record<string, CoursePreference> = {};
  for (const row of data ?? []) map[row.course_id] = row.preference as CoursePreference;
  return map;
}

export async function saveCoursePreference(
  userId: string,
  courseId: string,
  preference: CoursePreference,
): Promise<void> {
  if (preference === "neutral") {
    const { error } = await supabase
      .from("course_preferences")
      .delete()
      .eq("user_id", userId)
      .eq("course_id", courseId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("course_preferences")
    .upsert(
      { user_id: userId, course_id: courseId, preference },
      { onConflict: "user_id,course_id" },
    );
  if (error) throw error;
}

/** Converts the id-keyed database map into the code-keyed map the engine expects. */
export function preferencesByCode(
  byCourseId: Record<string, CoursePreference>,
  courses: Course[],
): CoursePreferenceMap {
  const map: CoursePreferenceMap = {};
  for (const course of courses) {
    const value = byCourseId[course.id];
    if (value) map[course.code] = value;
  }
  return map;
}

/* -------------------- legacy student record + preferences -------------------- */

export async function fetchStudentState(userId: string): Promise<StudentState> {
  const { data, error } = await supabase
    .from("student_courses")
    .select("course_code, status, override_eligible")
    .eq("user_id", userId);
  if (error) throw error;

  const state = emptyStudentState();
  for (const row of data ?? []) {
    const bucket = row.status as keyof StudentState;
    if (Array.isArray(state[bucket])) (state[bucket] as string[]).push(row.course_code);
    if (row.override_eligible !== null && row.override_eligible !== undefined) {
      state.overrides[row.course_code] = row.override_eligible;
    }
  }
  return state;
}

/** Atomically replaces the student's whole academic record. */
export async function saveStudentState(_userId: string, state: StudentState): Promise<void> {
  const rows: {
    course_code: string;
    status: string;
    override_eligible: boolean | null;
  }[] = [];
  const statuses: (keyof StudentState)[] = ["passed", "current", "failed", "required", "avoid"];
  for (const status of statuses) {
    for (const code of state[status] as string[]) {
      rows.push({
        course_code: code,
        status,
        override_eligible: state.overrides[code] ?? null,
      });
    }
  }
  for (const [code, value] of Object.entries(state.overrides)) {
    if (!rows.some((r) => r.course_code === code)) {
      rows.push({
        course_code: code,
        status: "current",
        override_eligible: value,
      });
    }
  }

  const { error } = await supabase.rpc("replace_student_courses", {
    p_rows: rows as unknown as never,
  });
  if (error) throw error;
}

export async function fetchPreferences(userId: string): Promise<Preferences> {
  const { data, error } = await supabase
    .from("student_preferences")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return { ...defaultPreferences(), ...((data?.data ?? {}) as Partial<Preferences>) };
}

export async function savePreferences(userId: string, preferences: Preferences): Promise<void> {
  const { error } = await supabase.from("student_preferences").upsert(
    {
      user_id: userId,
      data: preferences as unknown as never,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

export interface SavedPlanRecord {
  id: string;
  label: string | null;
  isFinal: boolean;
  data: unknown;
  createdAt: string;
}

export async function fetchSavedPlans(userId: string): Promise<SavedPlanRecord[]> {
  const { data, error } = await supabase
    .from("plans")
    .select("id, label, is_final, data, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    isFinal: row.is_final,
    data: row.data,
    createdAt: row.created_at,
  }));
}

/** Saves a snapshot and promotes it as the user's only final plan in one transaction. */
export async function saveChosenPlan(
  _userId: string,
  label: string,
  data: unknown,
): Promise<string> {
  const { data: planId, error } = await supabase.rpc("save_final_plan", {
    p_label: label,
    p_data: data as never,
  });
  if (error) throw error;
  return planId;
}

export async function setFinalPlan(planId: string): Promise<void> {
  const { error } = await supabase.rpc("set_final_plan", { p_plan_id: planId });
  if (error) throw error;
}

export async function deleteSavedPlan(userId: string, planId: string): Promise<void> {
  const { error } = await supabase.from("plans").delete().eq("id", planId).eq("user_id", userId);
  if (error) throw error;
}
