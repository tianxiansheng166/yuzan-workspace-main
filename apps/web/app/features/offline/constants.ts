export const OFFLINE_APP_VERSION = "v1";
export const OFFLINE_STORAGE_PREFIX = "yuzan:offline";
export const OFFLINE_DB_NAME = "yuzan-offline";
export const OFFLINE_DB_VERSION = 1;
export const OFFLINE_OBJECT_STORE = "kv";
export const OFFLINE_MANIFEST_PATH = "/manifest.webmanifest";
export const OFFLINE_SERVICE_WORKER_PATH = "/service-worker.js";
export const OFFLINE_ICON_PATH = "/icons/pwa-icon.svg";
export const OFFLINE_MASKABLE_ICON_PATH = "/icons/pwa-maskable.svg";
export const OFFLINE_FALLBACK_DOCUMENT = "/offline.html";

export const BLOCKED_CACHE_PATTERNS = [
  /^\/api(?:\/|$)/i,
  /^\/_nuxt\/builds\/meta\//i,
] as const;

export const SENSITIVE_FIELD_PATTERN =
  /(password|token|secret|authorization|cookie|phone|email|student|parent)/i;

export type GlobalRegistrationStatus =
  "idle" | "unsupported" | "registering" | "registered" | "failed";

export function createOfflineNamespace(accountId?: string): string {
  return accountId
    ? `${OFFLINE_STORAGE_PREFIX}:${OFFLINE_APP_VERSION}:account:${accountId}`
    : `${OFFLINE_STORAGE_PREFIX}:${OFFLINE_APP_VERSION}:shared`;
}
