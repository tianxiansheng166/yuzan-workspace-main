import { ref, computed } from "vue";
import type {
  DataState,
  UserRole,
  ClassDetail,
} from "~/features/classes/types";
import { fetchClassDetail } from "~/features/classes/gateway/class.gateway";
import {
  adaptStudents,
  adaptAssessments,
  type StudentViewModel,
  type AssessmentViewModel,
} from "~/features/classes/adapters/class.adapter";

export function useClassDetail(classId: string) {
  const state = ref<DataState>("loading");
  const role = ref<UserRole>("unknown");
  const detail = ref<ClassDetail | null>(null);
  const errorMessage = ref<string>("");

  const students = computed<StudentViewModel[]>(() =>
    detail.value ? adaptStudents(detail.value.students) : [],
  );

  const assessments = computed<AssessmentViewModel[]>(() =>
    detail.value ? adaptAssessments(detail.value.assessments) : [],
  );

  const load = async () => {
    state.value = "loading";
    errorMessage.value = "";
    try {
      const result = await fetchClassDetail(classId);
      role.value = result.role;
      detail.value = result.class;
      if (!result.class) {
        state.value = "unavailable";
      } else if (
        result.class.students.length === 0 &&
        result.class.assessments.length === 0
      ) {
        state.value = "empty";
      } else {
        state.value = "ready";
      }
    } catch (err) {
      state.value = "error";
      errorMessage.value =
        err instanceof Error ? err.message : "加载班级详情失败";
    }
  };

  const canManage = computed(() => role.value === "teacher");

  return {
    state,
    role,
    detail,
    students,
    assessments,
    errorMessage,
    canManage,
    load,
  };
}


