import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthUser } from "@/hooks/use-auth-user";
import {
  fetchCatalog,
  fetchCoursePreferences,
  fetchPreferences,
  fetchStudentState,
  preferencesByCode,
  saveCoursePreference,
  saveImport,
  savePreferences,
  saveStudentState,
  type ImportSummary,
} from "./catalog";
import type { ParsedSection } from "@/lib/import/types";
import {
  defaultPreferences,
  emptyStudentState,
  type CoursePreference,
  type CoursePreferenceMap,
  type Preferences,
  type StudentState,
} from "@/lib/scheduling";

export function useCatalog() {
  return useQuery({ queryKey: ["catalog"], queryFn: fetchCatalog, staleTime: 5 * 60 * 1000 });
}

/** Three-state per-course choice: take / neutral / skip. */
export function useCoursePreferences() {
  const { user } = useAuthUser();
  const queryClient = useQueryClient();
  const key = ["course-preferences", user?.id];

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchCoursePreferences(user!.id),
    enabled: Boolean(user?.id),
  });

  const mutation = useMutation({
    mutationFn: ({ courseId, preference }: { courseId: string; preference: CoursePreference }) =>
      saveCoursePreference(user!.id, courseId, preference),
    onMutate: async ({ courseId, preference }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Record<string, CoursePreference>>(key);
      const next = { ...(previous ?? {}) };
      if (preference === "neutral") delete next[courseId];
      else next[courseId] = preference;
      queryClient.setQueryData(key, next);
      return { previous };
    },
    onError: (_error, _vars, context) => {
      queryClient.setQueryData(key, context?.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });

  const byCourseId: Record<string, CoursePreference> = query.data ?? {};

  return {
    byCourseId,
    /** Code-keyed map the scheduling engine expects. */
    toCodeMap: (courses: Parameters<typeof preferencesByCode>[1]): CoursePreferenceMap =>
      preferencesByCode(byCourseId, courses),
    isLoading: query.isLoading,
    setPreference: mutation.mutate,
    isSaving: mutation.isPending,
  };
}

/** Persists a freshly parsed university table as the student's catalog. */
export function useImport() {
  const { user } = useAuthUser();
  const queryClient = useQueryClient();

  const mutation = useMutation<ImportSummary, Error, { rawInput: string; parsed: ParsedSection[] }>({
    mutationFn: ({ rawInput, parsed }) => saveImport(user!.id, rawInput, parsed),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["catalog"] });
      void queryClient.invalidateQueries({ queryKey: ["course-preferences", user?.id] });
    },
  });

  return {
    runImport: mutation.mutateAsync,
    summary: mutation.data,
    isImporting: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}

export function useStudentState() {
  const { user } = useAuthUser();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["student-state", user?.id],
    queryFn: () => fetchStudentState(user!.id),
    enabled: Boolean(user?.id),
  });

  const mutation = useMutation({
    mutationFn: (state: StudentState) => saveStudentState(user!.id, state),
    onMutate: async (state) => {
      await queryClient.cancelQueries({ queryKey: ["student-state", user?.id] });
      const previous = queryClient.getQueryData<StudentState>(["student-state", user?.id]);
      queryClient.setQueryData(["student-state", user?.id], state);
      return { previous };
    },
    onError: (_error, _state, context) => {
      queryClient.setQueryData(["student-state", user?.id], context?.previous);
    },
  });

  return {
    state: query.data ?? emptyStudentState(),
    isLoading: query.isLoading,
    save: mutation.mutate,
    isSaving: mutation.isPending,
  };
}

export function usePreferences() {
  const { user } = useAuthUser();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["preferences", user?.id],
    queryFn: () => fetchPreferences(user!.id),
    enabled: Boolean(user?.id),
  });

  const mutation = useMutation({
    mutationFn: (preferences: Preferences) => savePreferences(user!.id, preferences),
    onMutate: async (preferences) => {
      await queryClient.cancelQueries({ queryKey: ["preferences", user?.id] });
      const previous = queryClient.getQueryData<Preferences>(["preferences", user?.id]);
      queryClient.setQueryData(["preferences", user?.id], preferences);
      return { previous };
    },
    onError: (_error, _prefs, context) => {
      queryClient.setQueryData(["preferences", user?.id], context?.previous);
    },
  });

  return {
    preferences: query.data ?? defaultPreferences(),
    isLoading: query.isLoading,
    save: mutation.mutate,
    isSaving: mutation.isPending,
  };
}
