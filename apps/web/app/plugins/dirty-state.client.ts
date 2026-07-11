import {
  createLeaveCoordinator,
  resetLeaveCoordinator,
} from "~/features/dirty-state/leave-coordinator";
import { getDirtyStateRegistry } from "~/features/dirty-state/composables/useDirtyStateRegistry";

export default defineNuxtPlugin(() => {
  const router = useRouter();
  resetLeaveCoordinator();
  const coordinator = createLeaveCoordinator({ router });
  const registry = getDirtyStateRegistry();

  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");

  if (import.meta.dev || isLocalhost) {
    (window as unknown as Record<string, unknown>).__yuzanDirtyState = {
      registry,
      coordinator,
    };
  }

  window.addEventListener("beforeunload", (event) => {
    if (!coordinator.requestBeforeUnload()) return;
    event.preventDefault();
    event.returnValue = "";
  });

  router.beforeEach(async (to, from, next) => {
    if (typeof window === "undefined") {
      return next();
    }

    if (to.path === from.path) {
      return next();
    }

    const leaveRequest = registry.getLeaveRequest();
    if (leaveRequest) {
      return next(false);
    }

    if (!registry.hasBlockingChanges()) {
      return next();
    }

    const allowed = await coordinator.requestRouteLeave(to.path);
    next(allowed ? undefined : false);
  });
});
