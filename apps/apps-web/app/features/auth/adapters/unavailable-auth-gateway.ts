import type { AuthGateway } from "../ports/auth-gateway";

export function createUnavailableAuthGateway(): AuthGateway {
  return {
    async signIn() {
      return {
        status: "unavailable",
        serviceMode: "unavailable",
        message:
          "统一登录服务尚未接入当前环境，请等待 GOV-006 / IDN-001 联调。",
      };
    },
  };
}
