import { createActiveSchoolStore } from "./active-school";
import type { SchoolSelectionGateway } from "./gateway";
import { isMembershipRole } from "./role-route";
import type {
  CurrentSchoolUser,
  AuthSessionResponse,
  MembershipLoadResult,
  SchoolMembership,
} from "./types";

interface CurrentUserEnvelope {
  data?: CurrentSchoolUser;
}

export function createBrowserSchoolSelectionGateway(
  apiBase: string,
): SchoolSelectionGateway {
  const activeSchool = createActiveSchoolStore();

  async function loadMemberships(): Promise<MembershipLoadResult> {
    try {
      const response = await $fetch<CurrentUserEnvelope>(`${apiBase}/me`, {
        credentials: "include",
      });
      if (!response.data || !Array.isArray(response.data.memberships)) {
        return {
          status: "network-error",
          message: "学校成员信息格式无效，请稍后重试。",
        };
      }
      return { status: "ready", user: response.data };
    } catch (error: unknown) {
      const status =
        (error as { status?: number; statusCode?: number }).status ??
        (error as { statusCode?: number }).statusCode;
      if (status === 401) {
        activeSchool.clear();
        return {
          status: "session-expired",
          message: "登录状态已过期，请重新登录。",
        };
      }
      return {
        status: "network-error",
        message: "暂时无法读取学校列表，请检查网络后重试。",
      };
    }
  }

  return {
    loadMemberships,
    async selectSchool(schoolId) {
      const previous = activeSchool.read();
      const loaded = await loadMemberships();
      if (loaded.status !== "ready") return loaded;
      const membership = loaded.user.memberships.find(
        (item: SchoolMembership) => item.schoolId === schoolId,
      );
      if (!membership)
        return {
          status: "failed",
          message: "该学校已不在当前账号的可访问范围内。",
        };
      if (
        membership.membershipStatus === "inactive" ||
        membership.membershipStatus === "deleted"
      ) {
        return {
          status: "membership-inactive",
          message: "你在该学校的成员身份已停用。",
        };
      }
      if (
        membership.schoolStatus === "inactive" ||
        membership.schoolStatus === "deleted"
      ) {
        return { status: "school-inactive", message: "该学校当前不可进入。" };
      }
      if (!isMembershipRole(membership.role)) {
        return {
          status: "unknown-role",
          message: "该成员身份角色无法识别，未授予任何页面权限。",
        };
      }
      try {
        const selected = await $fetch<AuthSessionResponse>(`${apiBase}/auth/select-school`, {
          method: "POST",
          credentials: "include",
          body: { schoolId },
        });
        if (selected.data.user.activeSchoolId !== schoolId) {
          return { status: "failed", message: "服务端未确认所选学校，原学校上下文保持不变。" };
        }
        const verified = await $fetch<CurrentUserEnvelope>(`${apiBase}/me`, { credentials: "include" });
        if (!verified.data || verified.data.activeSchoolId !== schoolId) {
          return { status: "failed", message: "学校上下文复核失败，原学校上下文保持不变。" };
        }
      } catch (error: unknown) {
        const status = (error as { status?: number; statusCode?: number }).status ?? (error as { statusCode?: number }).statusCode;
        if (status === 401) return { status: "session-expired", message: "登录状态已过期，请重新登录。" };
        if (status === 403) return { status: "failed", message: "服务端拒绝切换到该学校，原学校上下文保持不变。" };
        return { status: "network-error", message: previous ? "学校切换未完成，仍保留原学校上下文。" : "学校切换未完成，请检查网络后重试。" };
      }
      const context = {
        schoolId: membership.schoolId,
        schoolName: membership.schoolName,
        role: membership.role,
        selectedAt: new Date().toISOString(),
      };
      activeSchool.write(context);
      return { status: "selected", context };
    },
    clearActiveSchool: activeSchool.clear,
  };
}
