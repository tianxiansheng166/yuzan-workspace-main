import { ApiError, ApiUnavailableError } from "../../../lib/api/client";
import type { createProductApiClient } from "../../../lib/api/client";
import type { AuthGateway } from "../ports/auth-gateway";
import { normalizeRole } from "../utils/roles";

type ProductApi = ReturnType<typeof createProductApiClient>;

function messageFor(error: ApiError) {
  if (error.status === 401) return "账号或密码不正确，请重新输入。";
  if (error.status === 403) return "当前账号没有进入该服务的权限。";
  if (error.status === 503) return "登录服务暂时不可用，请稍后重试。";
  return error.message;
}

export function createLiveAuthGateway(api: ProductApi): AuthGateway {
  return {
    async signIn(credentials) {
      try {
        const session = await api.login(credentials.identifier, credentials.password);
        const activeMembership = session.data.user.memberships.find(
          (membership) => membership.schoolId === session.data.activeSchoolId,
        );
        const firstMembership = activeMembership ?? session.data.user.memberships[0];
        const role = normalizeRole(firstMembership?.role ?? "unassigned");

        if (!role) {
          api.clearSession();
          return {
            status: "error",
            serviceMode: "live",
            message: "服务端返回了未知角色，未授予任何页面权限。",
          };
        }

        return {
          status: "authenticated",
          role,
          serviceMode: "live",
          expiresAt: new Date(Date.now() + session.data.expiresIn * 1000).toISOString(),
          nextRoute: "/select-school",
        };
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return {
            status: "unauthenticated",
            serviceMode: "live",
            message: messageFor(error),
          };
        }
        if (error instanceof ApiError && error.status === 503) {
          return {
            status: "unavailable",
            serviceMode: "unavailable",
            message: messageFor(error),
          };
        }
        if (error instanceof ApiError) {
          return {
            status: "error",
            serviceMode: "live",
            message: messageFor(error),
          };
        }
        return {
          status: "error",
          serviceMode: "live",
          message: error instanceof ApiUnavailableError
            ? "无法连接登录服务，请检查网络后重试。"
            : "登录请求失败，请稍后重试。",
        };
      }
    },
  };
}