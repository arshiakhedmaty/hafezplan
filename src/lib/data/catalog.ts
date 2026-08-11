import { supabase } from "@/integrations/supabase/client";
import {
  defaultPreferences,
  emptyStudentState,
  type Course,
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
    prerequisites: (row.prerequisites ?? null) as PrereqNode | null,
    corequisites: (row.corequisites ?? null) as PrereqNode | null,
  }));
  const byId = new Map(courses.map((c) => [c.id, c]));

  const sections: Section[] = (sectionsRes.data ?? [])
    .filter((row) => byId.has(row.course_id))
    .map((row) => ({
      id: row.id,
      courseId: row.course_id,
      courseCode: byId.get(row.course_id)!.code,
      sectionName: row.section_name,
      professor: row.professor,
      capacity: row.capacity,
      location: row.location,
      meetings: (row.meetings ?? []) as Section["meetings"],
      exam:
        row.exam_date && row.exam_start && row.exam_end
          ? { date: row.exam_date, start: row.exam_start, end: row.exam_end }
          : null,
    }));

  return { courses, sections };
}

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
      data: preferences as unknown as Record<string, unknown>,
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
