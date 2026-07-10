import { reactive } from "vue";
import type {
  AuthViewStatus,
  LoginPageState,
  SessionSnapshot,
} from "../models";
import type { AuthGateway } from "../ports/auth-gateway";
import type { SessionGateway } from "../ports/session-gateway";
import {
  resolvePostLoginRedirect,
  sanitizeInternalRedirect,
} from "../utils/redirect";
import { normalizeRole } from "../utils/roles";

export interface LoginPageDependencies {
  authGateway: AuthGateway;
  sessionGateway: SessionGateway;
  navigate: (to: string) => Promise<void> | void;
  redirectTo?: string;
  expired?: boolean;
}

function applySnapshot(
  state: LoginPageState,
  snapshot: SessionSnapshot,
): AuthViewStatus {
  state.status = snapshot.status;
  state.serviceMode = snapshot.serviceMode;
  state.message = "message" in snapshot ? snapshot.message : undefined;
  state.role = snapshot.status === "authenticated" ? snapshot.role : undefined;
  return snapshot.status;
}

export function createLoginPageState(dependencies: LoginPageDependencies) {
  const state = reactive<LoginPageState>({
    status: "loading",
    serviceMode: "demo",
    identifier: "",
    password: "",
    redirectTo: sanitizeInternalRedirect(dependencies.redirectTo),
    role: undefined,
    message: undefined,
    submitting: false,
  });

  async function initialize() {
    if (dependencies.expired) {
      await dependencies.sessionGateway.clear();
      applySnapshot(state, {
        status: "expired",
        serviceMode: "demo",
        message: "当前会话已过期，请重新登录。",
      });
      return;
    }

    const snapshot = await dependencies.sessionGateway.restore();
    const status = applySnapshot(state, snapshot);

    if (status === "authenticated" && state.role) {
      await dependencies.navigate(
        resolvePostLoginRedirect(state.role, state.redirectTo),
      );
    }
  }

  async function submit() {
    if (state.submitting) {
      return;
    }

    state.submitting = true;
    state.status = "loading";
    state.message = undefined;

    try {
      const result = await dependencies.authGateway.signIn({
        identifier: state.identifier.trim(),
        password: state.password,
        redirectTo: state.redirectTo,
      });

      state.password = "";

      if (result.status === "authenticated") {
        const role = normalizeRole(result.role);

        if (!role) {
          await dependencies.sessionGateway.clear();
          state.status = "error";
          state.serviceMode = result.serviceMode;
          state.role = undefined;
          state.message = "当前账号角色暂不受支持，未授予任何前端权限。";
          return;
        }

        state.status = "authenticated";
        state.serviceMode = result.serviceMode;
        state.role = role;
        state.message = "登录状态已确认，正在返回原页面。";

        await dependencies.sessionGateway.persist({
          status: "authenticated",
          role,
          serviceMode: result.serviceMode,
          expiresAt: result.expiresAt,
        });

        await dependencies.navigate(
          resolvePostLoginRedirect(role, state.redirectTo),
        );
        return;
      }

      await dependencies.sessionGateway.clear();
      state.role = undefined;
      state.status = result.status;
      state.serviceMode = result.serviceMode;
      state.message = result.message;
    } catch {
      await dependencies.sessionGateway.clear();
      state.role = undefined;
      state.status = "error";
      state.serviceMode = "demo";
      state.message = "登录流程发生异常，请稍后重试。";
    } finally {
      state.submitting = false;
      state.password = "";
    }
  }

  return {
    state,
    initialize,
    submit,
  };
}
