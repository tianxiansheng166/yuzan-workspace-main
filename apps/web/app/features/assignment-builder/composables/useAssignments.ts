import { ref, computed } from "vue";
import type { DataState, UserRole } from "../types";
import { fetchAssignmentList } from "../gateway/assignment.gateway";
import {
  adaptAssignmentList,
  type AssignmentListItemViewModel,
} from "../adapters/assignment.adapter";

export function useAssignments() {
  const state = ref<DataState>("loading");
  const role = ref<UserRole>("unknown");
  const assignments = ref<AssignmentListItemViewModel[]>([]);
  const errorMessage = ref<string>("");

  const load = async () => {
    state.value = "loading";
    errorMessage.value = "";
    try {
      const result = await fetchAssignmentList();
      role.value = result.role;
      assignments.value = adaptAssignmentList(result.assignments);
      state.value = assignments.value.length === 0 ? "empty" : "ready";
    } catch (err) {
      state.value = "error";
      errorMessage.value =
        err instanceof Error ? err.message : "加载任务列表失败";
    }
  };

  const canCreate = computed(() => role.value === "teacher");

  return {
    state,
    role,
    assignments,
    errorMessage,
    canCreate,
    load,
  };
}
