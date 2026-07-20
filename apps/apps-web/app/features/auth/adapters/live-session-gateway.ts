import { ApiError, ApiUnavailableError } from "../../../lib/api/client";
import type { createProductApiClient } from "../../../lib/api/client";
import type { SessionGateway } from "../ports/session-gateway";
import { normalizeRole } from "../utils/roles";

type ProductApi = ReturnType<typeof createProductApiClient>;

export function createLiveSessionGateway(api: ProductApi): SessionGateway {
  return {
    async restore() {
      try {
        const response = await api.currentUser();
        const activeMembership = response.data.memberships.find(
          (membership) => membership.schoolId === response.data.activeSchoolId,
        );
        const role = normalizeRole(activeMembership?.role ?? "unassigned");
        if (!role) {
          api.clearSession();
          return {
            status: "error",
            serviceMode: "live",
            message: "当前会话包含未知角色，已按无权限状态处理。",
          } as const;
        }
        return {
          status: "authenticated",
          role,
          serviceMode: "live",
          nextRoute: activeMembership ? undefined : "/select-school",
        } as const;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return {
            status: "unauthenticated",
            serviceMode: "live",
            message: "请使用学校账号登录。",
          } as const;
        }
        if (error instanceof ApiError && error.status === 403) {
          return {
            status: "error",
            serviceMode: "live",
            message: "当前会话没有读取账号信息的权限。",
          } as const;
        }
        return {
          status: "unavailable",
          serviceMode: "unavailable",
          message: error instanceof ApiUnavailableError
            ? "当前网络不可用，暂时无法恢复登录状态。"
            : "会话服务暂时不可用，请稍后重试。",
        } as const;
      }
    },
    persist() {
      // Access tokens remain in the in-memory API client. Refresh state is
      // carried only by the server-issued httpOnly cookie.
    },
    clear() {
      api.clearSession();
    },
  };
}