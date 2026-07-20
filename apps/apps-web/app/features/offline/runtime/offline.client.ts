import { createIndexedDbOfflineStoragePort } from "../storage/indexeddb-offline-storage";
import { mountOfflineBanner } from "./banner";
import { ensureOfflineGlobalStatus } from "./global-status";
import { registerOfflineServiceWorker } from "./service-worker";

export default defineNuxtPlugin(() => {
  if (!import.meta.client) {
    return;
  }

  const status = ensureOfflineGlobalStatus(window);
  status.network = navigator.onLine ? "online" : "offline";

  createIndexedDbOfflineStoragePort();
  const teardownBanner = mountOfflineBanner(window, document);

  window.addEventListener("beforeunload", teardownBanner, { once: true });

  window.addEventListener("yuzan:offline-account-switch", async () => {
    const storage = createIndexedDbOfflineStoragePort();
    await storage.clearForAccountSwitch();

    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith("yuzan-runtime-"))
          .map((cacheName) => caches.delete(cacheName)),
      );
    }
  });

  window.addEventListener("load", () => {
    void registerOfflineServiceWorker({
      navigator,
      window,
    });
  });
});
