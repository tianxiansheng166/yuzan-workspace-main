import { reactive } from "vue";
import type { SchoolSelectionGateway } from "./gateway";
import { routeForMembershipRole } from "./role-route";
import type {
  CurrentSchoolUser,
  SchoolMembership,
  SchoolSelectionState,
} from "./types";

export function createSchoolSelectionState(
  gateway: SchoolSelectionGateway,
  navigate: (to: string) => void | Promise<void>,
) {
  const state = reactive<{
    status: SchoolSelectionState;
    user: CurrentSchoolUser | null;
    memberships: SchoolMembership[];
    selectedId: string | null;
    message: string;
  }>({
    status: "LOADING_MEMBERSHIPS",
    user: null,
    memberships: [],
    selectedId: null,
    message: "正在读取你的学校成员身份。",
  });

  async function load() {
    state.status = "LOADING_MEMBERSHIPS";
    const result = await gateway.loadMemberships();
    if (result.status === "session-expired") {
      state.status = "SESSION_EXPIRED";
      state.message = result.message;
      return;
    }
    if (result.status === "network-error") {
      state.status = "NETWORK_ERROR";
      state.message = result.message;
      return;
    }
    state.user = result.user;
    state.memberships = result.user.memberships;
    if (!state.memberships.length) {
      state.status = "NO_SCHOOL";
      state.message = "当前账号尚未加入学校。";
      return;
    }
    state.status =
      state.memberships.length === 1 ? "ONE_SCHOOL" : "MULTIPLE_SCHOOLS";
    state.message =
      state.memberships.length === 1
        ? "确认后进入这所学校。"
        : "选择你今天要进入的学校。";
  }

  async function select(membership: SchoolMembership) {
    if (state.status === "SELECTING") return;
    state.status = "SELECTING";
    state.selectedId = membership.schoolId;
    state.message = "正在重新确认学校访问权限。";
    const result = await gateway.selectSchool(membership.schoolId);
    if (result.status === "selected") {
      state.status = "SELECTED";
      state.message = "学校已确认，正在进入工作区。";
      await navigate(routeForMembershipRole(result.context.role));
      return;
    }
    const statusMap = {
      "membership-inactive": "MEMBERSHIP_INACTIVE",
      "school-inactive": "SCHOOL_INACTIVE",
      "session-expired": "SESSION_EXPIRED",
      "network-error": "NETWORK_ERROR",
      "unknown-role": "UNKNOWN_ROLE",
      failed: "SELECTION_FAILED",
    } as const;
    state.status = statusMap[result.status];
    state.message = result.message;
    state.selectedId = null;
  }
  return { state, load, select };
}
