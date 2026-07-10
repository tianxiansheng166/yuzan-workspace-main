export type CookieSameSite = "lax" | "strict" | "none";

export interface ValidatedEnvironment extends Record<string, unknown> {
  API_PORT: number;
  COOKIE_SAME_SITE: CookieSameSite;
  COOKIE_SECURE: boolean;
  DATABASE_URL: string;
  NODE_ENV: string;
  SESSION_SECRET: string;
  WEB_ORIGINS: readonly string[];
  WEB_ORIGIN: string;
}

const COOKIE_SAME_SITE_VALUES = new Set<CookieSameSite>([
  "lax",
  "strict",
  "none",
]);

function requireString(env: Record<string, unknown>, key: string): string {
  const value = env[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.trim();
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  throw new Error("COOKIE_SECURE must be true or false");
}

function parsePort(value: unknown): number {
  if (value === undefined || value === "") return 4000;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error("API_PORT must be an integer between 0 and 65535");
  }
  return port;
}

function parseOrigins(value: string, production: boolean): readonly string[] {
  const origins = [
    ...new Set(value.split(",").map((item) => item.trim())),
  ].filter(Boolean);
  if (origins.length === 0) {
    throw new Error("WEB_ORIGIN must contain at least one origin");
  }

  for (const origin of origins) {
    if (origin === "*") {
      throw new Error("WEB_ORIGIN must not contain a wildcard origin");
    }
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`WEB_ORIGIN contains an invalid origin: ${origin}`);
    }
    if (
      parsed.origin !== origin ||
      !["http:", "https:"].includes(parsed.protocol)
    ) {
      throw new Error(
        `WEB_ORIGIN must contain origins without paths: ${origin}`,
      );
    }
    if (production && parsed.protocol !== "https:") {
      throw new Error("Production WEB_ORIGIN entries must use https");
    }
  }
  return origins;
}

export function validateEnvironment(
  env: Record<string, unknown>,
): ValidatedEnvironment {
  const nodeEnv =
    typeof env.NODE_ENV === "string" && env.NODE_ENV.trim()
      ? env.NODE_ENV.trim()
      : "development";
  const production = nodeEnv === "production";
  const sessionSecret = requireString(env, "SESSION_SECRET");
  if (sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }

  const webOrigin = requireString(env, "WEB_ORIGIN");
  const webOrigins = parseOrigins(webOrigin, production);
  const cookieSecure = parseBoolean(env.COOKIE_SECURE, production);
  const sameSiteValue =
    typeof env.COOKIE_SAME_SITE === "string"
      ? env.COOKIE_SAME_SITE.toLowerCase()
      : "strict";
  if (!COOKIE_SAME_SITE_VALUES.has(sameSiteValue as CookieSameSite)) {
    throw new Error("COOKIE_SAME_SITE must be lax, strict, or none");
  }
  if (production && !cookieSecure) {
    throw new Error("COOKIE_SECURE must not be false in production");
  }
  if (sameSiteValue === "none" && !cookieSecure) {
    throw new Error("COOKIE_SAME_SITE=none requires COOKIE_SECURE=true");
  }

  return {
    ...env,
    API_PORT: parsePort(env.API_PORT),
    COOKIE_SAME_SITE: sameSiteValue as CookieSameSite,
    COOKIE_SECURE: cookieSecure,
    DATABASE_URL: requireString(env, "DATABASE_URL"),
    NODE_ENV: nodeEnv,
    SESSION_SECRET: sessionSecret,
    WEB_ORIGINS: webOrigins,
    WEB_ORIGIN: webOrigin,
  };
}
