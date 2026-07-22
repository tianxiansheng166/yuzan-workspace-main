import { describe, expect, it } from "vitest";
import { validateEnvironment } from "../../src/config/environment.js";

const valid = {
  DATABASE_URL: "postgresql://unused:unused@127.0.0.1:5432/unused",
  SESSION_SECRET: "test-only-session-secret-at-least-32-characters",
  WEB_ORIGIN: "https://app.example.test",
};

describe("root environment validation", () => {
  it("normalizes CORS and cookie settings from the environment", () => {
    const environment = validateEnvironment({
      ...valid,
      COOKIE_SAME_SITE: "lax",
      COOKIE_SECURE: "true",
      WEB_ORIGIN: "https://one.example.test,https://two.example.test",
    });

    expect(environment.WEB_ORIGINS).toEqual([
      "https://one.example.test",
      "https://two.example.test",
    ]);
    expect(environment.COOKIE_SECURE).toBe(true);
    expect(environment.COOKIE_SAME_SITE).toBe("lax");
  });

  it("rejects wildcard and insecure production origins", () => {
    expect(() =>
      validateEnvironment({
        ...valid,
        NODE_ENV: "production",
        WEB_ORIGIN: "*",
      }),
    ).toThrow(/wildcard/);
    expect(() =>
      validateEnvironment({
        ...valid,
        NODE_ENV: "production",
        WEB_ORIGIN: "http://app.example.test",
      }),
    ).toThrow(/https/);
  });

  it("rejects insecure production cookies", () => {
    expect(() =>
      validateEnvironment({
        ...valid,
        COOKIE_SECURE: "false",
        NODE_ENV: "production",
      }),
    ).toThrow(/COOKIE_SECURE/);
  });
});
