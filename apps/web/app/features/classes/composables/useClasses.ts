import { ref, computed } from "vue";
import type { DataState, UserRole } from "~/features/classes/types";
import { fetchClassList } from "~/features/classes/gateway/class.gateway";
import {
  adaptClassList,
  type ClassListViewModel,
} from "~/features/classes/adapters/class.adapter";

export function useClasses() {
  const state = ref<DataState>("loading");
  const role = ref<UserRole>("unknown");
  const classes = ref<ClassListViewModel[]>([]);
  const errorMessage = ref<string>("");

  const load = async () => {
    state.value = "loading";
    errorMessage.value = "";
    try {
      const result = await fetchClassList();
      role.value = result.role;
      classes.value = adaptClassList(result.classes);
      state.value = classes.value.length === 0 ? "empty" : "ready";
    } catch (err) {
      state.value = "error";
      errorMessage.value =
        err instanceof Error ? err.message : "加载班级列表失败";
    }
  };

  const canManage = computed(() => role.value === "teacher");

  return {
    state,
    role,
    classes,
    errorMessage,
    canManage,
    load,
  };
}
