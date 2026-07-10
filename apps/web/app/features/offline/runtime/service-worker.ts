import {
  OFFLINE_SERVICE_WORKER_PATH,
  type GlobalRegistrationStatus,
} from "../constants";
import { ensureOfflineGlobalStatus } from "./global-status";

interface ServiceWorkerNavigator {
  serviceWorker?: {
    register(
      scriptURL: string,
      options?: RegistrationOptions,
    ): Promise<ServiceWorkerRegistration>;
    ready?: Promise<ServiceWorkerRegistration>;
  };
  onLine?: boolean;
}

interface BrowserEnvironment {
  navigator: ServiceWorkerNavigator;
  window?: Window;
}

export async function registerOfflineServiceWorker(
  environment: BrowserEnvironment,
): Promise<GlobalRegistrationStatus> {
  const { navigator, window } = environment;
  const status = ensureOfflineGlobalStatus(window);

  if (!("serviceWorker" in navigator) || !navigator.serviceWorker) {
    status.registration = "unsupported";
    return status.registration;
  }

  try {
    status.registration = "registering";
    const registration = await navigator.serviceWorker.register(
      OFFLINE_SERVICE_WORKER_PATH,
      {
        scope: "/",
      },
    );

    status.registration = "registered";
    status.serviceWorkerScope = registration.scope;
    return status.registration;
  } catch (error) {
    status.registration = "failed";
    status.lastError =
      error instanceof Error ? error.message : "Unknown service worker error.";
    return status.registration;
  }
}
