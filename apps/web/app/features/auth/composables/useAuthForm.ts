import { ref } from "vue";
import { DemoSessionGateway } from "../../session/gateway";
import type { DemoSession, LoginCredentials } from "../types";

export type AuthFormState = "idle" | "loading" | "success" | "error";

/**
 * 登录表单状态管理。
 *
 * 仅包装 DemoSessionGateway，不直接访问 storage，
 * 密码仅在内存中用于校验，不会被写入 storage。
 */
export function useAuthForm() {
  const state = ref<AuthFormState>("idle");
  const errorMessage = ref("");
  const session = ref<DemoSession | null>(null);

  const identifier = ref("");
  const password = ref("");
  const remember = ref(false);

  const gateway = new DemoSessionGateway();

  async function login(): Promise<boolean> {
    state.value = "loading";
    errorMessage.value = "";

    const credentials: LoginCredentials = {
      identifier: identifier.value,
      password: password.value,
      remember: remember.value,
    };

    const result = await gateway.login(credentials);

    if (result.kind === "error") {
      state.value = "error";
      errorMessage.value = result.message;
      return false;
    }

    state.value = "success";
    session.value = result.session;
    return true;
  }

  return {
    state,
    errorMessage,
    session,
    identifier,
    password,
    remember,
    login,
  };
}
