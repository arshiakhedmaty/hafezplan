import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthUser } from "@/hooks/use-auth-user";
import {
  fetchCatalog,
  fetchPreferences,
  fetchStudentState,
  savePreferences,
  saveStudentState,
} from "./catalog";
import { defaultPreferences, emptyStudentState, type Preferences, type StudentState } from "@/lib/scheduling";

export function useCatalog() {
  return useQuery({ queryKey: ["catalog"], queryFn: fetchCatalog, staleTime: 5 * 60 * 1000 });
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
