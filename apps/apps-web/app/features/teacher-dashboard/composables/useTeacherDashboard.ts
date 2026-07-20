import { computed } from "vue";

import { createTeacherDashboardGateway } from "../gateway/teacher-dashboard.gateway";

export function useTeacherDashboard() {
  const config = useRuntimeConfig();
  const gateway = createTeacherDashboardGateway({
    apiBase: String(config.public.apiBase),
  });

  const state = useLazyAsyncData("teacher-dashboard", () => gateway.load(), {
    server: false,
    default: () => undefined,
  });

  const isLoading = computed(
    () => state.status.value === "idle" || state.status.value === "pending",
  );

  return {
    result: state.data,
    error: state.error,
    status: state.status,
    isLoading,
    refresh: state.refresh,
  };
}
