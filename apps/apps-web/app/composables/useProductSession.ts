import { computed } from "vue";
import { ApiError } from "../lib/api/client";
import type { CurrentUser, Membership } from "../lib/api/types";

type SessionStatus =
  "unknown" | "authenticated" | "unauthenticated" | "unavailable";

interface ProductSessionState {
  status: SessionStatus;
  user: CurrentUser | null;
  message: string | null;
}

const refreshFlights = new WeakMap<object, Promise<void>>();

export function useProductSession() {
  const api = useProductApi();
  const state = useState<ProductSessionState>("product-session", () => ({
    status: "unknown",
    user: null,
    message: null,
  }));
  const nuxtApp = useNuxtApp();

  const activeMembership = computed<Membership | null>(() => {
    const user = state.value.user;
    if (!user?.activeSchoolId) return null;
    return (
      user.memberships.find((item) => item.schoolId === user.activeSchoolId) ??
      null
    );
  });

  async function refresh(force = false) {
    if (!force && state.value.status === "authenticated") return;
    const existing = refreshFlights.get(nuxtApp);
    if (existing) return existing;
    const flight = (async () => {
      try {
        const response = await api.currentUser();
        state.value = {
          status: "authenticated",
          user: response.data,
          message: null,
        };
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          state.value = {
            status: "unauthenticated",
            user: null,
            message: "请先登录后继续。",
          };
          return;
        }
        state.value = {
          status: "unavailable",
          user: null,
          message:
            error instanceof Error ? error.message : "会话服务暂不可用。",
        };
      }
    })();
    refreshFlights.set(nuxtApp, flight);
    try {
      await flight;
    } finally {
      refreshFlights.delete(nuxtApp);
    }
  }

  function adopt(user: CurrentUser) {
    state.value = { status: "authenticated", user, message: null };
  }

  function clear() {
    api.clearSession();
    state.value = { status: "unauthenticated", user: null, message: null };
  }

  return { state, activeMembership, refresh, adopt, clear };
}
