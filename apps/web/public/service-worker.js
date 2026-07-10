const CACHE_VERSION = "yuzan-shell-v1";
const RUNTIME_CACHE = "yuzan-runtime-v1";
const OFFLINE_FALLBACK = "/offline.html";
const PRECACHE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/icons/pwa-icon.svg",
  "/icons/pwa-maskable.svg",
  OFFLINE_FALLBACK,
];
const BLOCKED_CACHE_PATTERNS = [/^\/api(?:\/|$)/i, /^\/_nuxt\/builds\/meta\//i];

function shouldBypassCache(request) {
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return true;
  }

  if (url.origin !== self.location.origin) {
    return true;
  }

  if (
    request.headers.has("authorization") ||
    request.headers.has("x-auth-token")
  ) {
    return true;
  }

  return BLOCKED_CACHE_PATTERNS.some((pattern) => pattern.test(url.pathname));
}

function shouldRuntimeCache(request) {
  return ["document", "script", "style", "image", "font"].includes(
    request.destination,
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "ACCOUNT_SWITCH") {
    event.waitUntil(caches.delete(RUNTIME_CACHE));
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (shouldBypassCache(request)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_VERSION);
        return (
          (await cache.match(request, { ignoreSearch: true })) ||
          (await cache.match(OFFLINE_FALLBACK))
        );
      }),
    );
    return;
  }

  if (!shouldRuntimeCache(request)) {
    return;
  }

  event.respondWith(
    caches.open(RUNTIME_CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });

      if (cached) {
        return cached;
      }

      const response = await fetch(request);

      if (response.ok && response.type !== "opaque") {
        cache.put(request, response.clone());
      }

      return response;
    }),
  );
});
