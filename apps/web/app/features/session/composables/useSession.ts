import { onMounted, ref } from "vue";
import type { DemoSession } from "../../auth/types";
import { DemoSessionGateway } from "../gateway";

export type SessionState = "idle" | "loading" | "ready" | "error";

/**
 * 当前 demo session 状态组合式函数。
 *
 * 在 onMounted 时自动刷新，避免 SSR 阶段读取 storage。
 * 所有 storage 访问都通过 DemoSessionGateway 间接完成，服务端安全。
 */
export function useSession() {
  const state = ref<SessionState>("idle");
  const error = ref<Error | null>(null);
  const session = ref<DemoSession | null>(null);
  const gateway = new DemoSessionGateway();

  async function refresh(): Promise<void> {
    state.value = "loading";
    error.value = null;

    try {
      session.value = await gateway.getSession();
      state.value = "ready";
    } catch (cause) {
      error.value = cause instanceof Error ? cause : new Error(String(cause));
      state.value = "error";
    }
  }

  async function logout(): Promise<void> {
    state.value = "loading";
    error.value = null;

    try {
      await gateway.logout();
      session.value = null;
      state.value = "ready";
    } catch (cause) {
      error.value = cause instanceof Error ? cause : new Error(String(cause));
      state.value = "error";
    }
  }

  onMounted(() => {
    void refresh();
  });

  return {
    state,
    error,
    session,
    refresh,
    logout,
  };
}
