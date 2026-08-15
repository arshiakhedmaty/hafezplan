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
        row.exam_date && row.exam_start && row.exam_end
          ? { date: row.exam_date_label ?? row.exam_date, start: row.exam_start, end: row.exam_end }
          : null,
    }));

  return { courses, sections };
}

/* -------------------- import (paste / CSV) -------------------- */

export interface ImportSummary {
  importId: string;
  courses: number;
  sections: number;
}

/**
 * Replaces the student's own catalog with the freshly parsed table.
 * Only rows owned by this user are touched; shared rows stay untouched.
 */
export async function saveImport(
  userId: string,
  rawInput: string,
  parsed: ParsedSection[],
): Promise<ImportSummary> {
  const importRes = await supabase
    .from("imports")
    .insert({ user_id: userId, raw_input: rawInput.slice(0, 200000), source_type: "paste" })
    .select("id")
    .single();
  if (importRes.error) throw importRes.error;
  const importId = importRes.data.id;

  // Start clean: a new import is the new source of truth for this user.
  const delSections = await supabase.from("course_sections").delete().eq("owner_id", userId);
  if (delSections.error) throw delSections.error;
  const delCourses = await supabase.from("courses").delete().eq("owner_id", userId);
  if (delCourses.error) throw delCourses.error;

  const uniqueCourses = new Map<string, { code: string; name: string; credits: number }>();
  for (const section of parsed) {
    if (!uniqueCourses.has(section.courseCode)) {
      uniqueCourses.set(section.courseCode, {
        code: section.courseCode,
        name: section.courseName,
        credits: section.units,
      });
    }
  }

  const courseRows = [...uniqueCourses.values()].map((course) => ({
    owner_id: userId,
    import_id: importId,
    code: course.code,
    name_en: course.name,
    name_fa: course.name,
    credits: Math.max(0, Math.round(course.credits)),
  }));

  if (courseRows.length === 0) return { importId, courses: 0, sections: 0 };

  const insertedCourses = await supabase.from("courses").insert(courseRows).select("id, code");
  if (insertedCourses.error) throw insertedCourses.error;
  const idByCode = new Map((insertedCourses.data ?? []).map((row) => [row.code, row.id]));

  const sectionRows = parsed
    .filter((section) => idByCode.has(section.courseCode))
    .map((section) => ({
      owner_id: userId,
      import_id: importId,
      course_id: idByCode.get(section.courseCode)!,
      section_name: section.groupNumber,
      group_number: section.groupNumber,
      gender: section.gender,
      professor: section.professor || null,
      capacity: section.capacity,
      meetings: section.meetings as unknown as never,
      exam_date: section.exam ? section.exam.date : null,
      exam_date_label: section.exam ? section.exam.label : null,
      exam_start: section.exam ? section.exam.start : null,
      exam_end: section.exam ? section.exam.end : null,
    }));

  if (sectionRows.length > 0) {
    const insertedSections = await supabase.from("course_sections").insert(sectionRows);
    if (insertedSections.error) throw insertedSections.error;
  }

  await supabase
    .from("imports")
    .update({ stats: { courses: courseRows.length, sections: sectionRows.length } })
    .eq("id", importId);

  return { importId, courses: courseRows.length, sections: sectionRows.length };
}

/* -------------------- per-course take/neutral/skip -------------------- */

export async function fetchCoursePreferences(userId: string): Promise<Record<string, CoursePreference>> {
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
    .upsert({ user_id: userId, course_id: courseId, preference }, { onConflict: "user_id,course_id" });
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

/** Replaces the student's whole record; simple and always consistent. */
export async function saveStudentState(userId: string, state: StudentState): Promise<void> {
  const rows: {
    user_id: string;
    course_code: string;
    status: string;
    override_eligible: boolean | null;
  }[] = [];
  const statuses: (keyof StudentState)[] = ["passed", "current", "failed", "required", "avoid"];
  for (const status of statuses) {
    for (const code of state[status] as string[]) {
      rows.push({
        user_id: userId,
        course_code: code,
        status,
        override_eligible: state.overrides[code] ?? null,
      });
    }
  }
  for (const [code, value] of Object.entries(state.overrides)) {
    if (!rows.some((r) => r.course_code === code)) {
      rows.push({ user_id: userId, course_code: code, status: "current", override_eligible: value });
    }
  }

  const del = await supabase.from("student_courses").delete().eq("user_id", userId);
  if (del.error) throw del.error;
  if (rows.length > 0) {
    const ins = await supabase.from("student_courses").insert(rows);
    if (ins.error) throw ins.error;
  }
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

export async function saveChosenPlan(userId: string, label: string, data: unknown): Promise<void> {
  await supabase.from("plans").update({ is_final: false }).eq("user_id", userId);
  const { error } = await supabase.from("plans").insert({
    user_id: userId,
    label,
    is_final: true,
    data: data as never,
  });
  if (error) throw error;
}
