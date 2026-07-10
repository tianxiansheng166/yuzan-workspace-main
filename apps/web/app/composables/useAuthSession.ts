import { ApiError, ApiUnavailableError } from "../lib/api/client";
import type { WebSession } from "../features/auth/models";
import { toWebSession } from "../features/auth/utils/session";

export function useAuthSession() {
  const session = useState<WebSession | null>("auth.session", () => null);
  const restored = useState("auth.restored", () => false);
  const unavailable = useState<string | null>("auth.unavailable", () => null);
  const api = useAuthApi(() => {
    session.value = null;
    restored.value = true;
  });

  async function restore(force = false) {
    if (restored.value && !force) return session.value;
    try {
      session.value = toWebSession((await api.currentUser()).data);
      unavailable.value = null;
    } catch (error) {
      session.value = null;
      if (
        error instanceof ApiUnavailableError ||
        !(error instanceof ApiError)
      ) {
        unavailable.value = "身份服务或其持久化依赖暂不可用。";
      } else if (error.status !== 401) {
        unavailable.value = error.message;
      }
    } finally {
      restored.value = true;
    }
    return session.value;
  }

  async function login(identifier: string, password: string) {
    const result = await api.login(identifier, password);
    session.value = toWebSession(result.data.user);
    restored.value = true;
    unavailable.value = null;
    return session.value;
  }

  async function logout() {
    try {
      await api.logout();
    } finally {
      session.value = null;
      restored.value = true;
      unavailable.value = null;
    }
  }

  return { session, restored, unavailable, restore, login, logout };
}
