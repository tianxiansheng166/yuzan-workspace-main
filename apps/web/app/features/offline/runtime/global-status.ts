import type { GlobalRegistrationStatus } from "../constants";

export interface OfflineGlobalStatusShape {
  registration: GlobalRegistrationStatus;
  network: "online" | "offline" | "unknown";
  serviceWorkerScope?: string;
  lastError?: string;
}

declare global {
  interface Window {
    __YUZAN_OFFLINE__?: OfflineGlobalStatusShape;
  }
}

export function ensureOfflineGlobalStatus(
  target?: Window,
): OfflineGlobalStatusShape {
  if (!target) {
    return {
      registration: "idle",
      network: "unknown",
    };
  }

  target.__YUZAN_OFFLINE__ ??= {
    registration: "idle",
    network: target.navigator.onLine ? "online" : "offline",
  };

  return target.__YUZAN_OFFLINE__;
}
