import { ref, computed } from "vue";
import type { DataState, UserRole } from "../types";
import { fetchAssignmentDetail } from "../gateway/assignment.gateway";
import {
  adaptAssignmentDetail,
  adaptStudentProgress,
  type AssignmentDetailViewModel,
  type StudentProgressViewModel,
} from "../adapters/assignment.adapter";

export function useAssignmentDetail(assignmentId: string) {
  const state = ref<DataState>("loading");
  const role = ref<UserRole>("unknown");
  const detail = ref<AssignmentDetailViewModel | null>(null);
  const students = ref<StudentProgressViewModel[]>([]);
  const errorMessage = ref<string>("");

  const load = async () => {
    state.value = "loading";
    errorMessage.value = "";
    try {
      const result = await fetchAssignmentDetail(assignmentId);
      role.value = result.role;
      if (!result.assignment) {
        state.value = "unavailable";
        detail.value = null;
        students.value = [];
      } else {
        detail.value = adaptAssignmentDetail(result.assignment);
        students.value = adaptStudentProgress(result.assignment.students);
        state.value = "ready";
      }
    } catch (err) {
      state.value = "error";
      errorMessage.value =
        err instanceof Error ? err.message : "加载任务详情失败";
    }
  };

  const canManage = computed(() => role.value === "teacher");

  return {
    state,
    role,
    detail,
    students,
    errorMessage,
    canManage,
    load,
  };
}
