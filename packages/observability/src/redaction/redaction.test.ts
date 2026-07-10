import { describe, expect, it } from "vitest";
import {
  redact,
  redactBodySummary,
  redactHeaders,
  redactQueryString,
  redactValue,
} from "./redaction.js";

describe("redaction", () => {
  it("masks top-level sensitive keys", () => {
    const input = { password: "secret123", public: "visible" };
    const result = redact(input);
    expect(result.password).toBe("[REDACTED]");
    expect(result.public).toBe("visible");
  });

  it("masks nested sensitive fields", () => {
    const input = {
      user: { studentName: "Alice", age: 10 },
      data: { nested: { token: "abc" } },
    };
    const result = redact(input as Record<string, unknown>);
    const user = result.user as Record<string, unknown>;
    const data = result.data as Record<string, unknown>;
    expect(user.studentName).toBe("[REDACTED]");
    expect(user.age).toBe(10);
    expect((data.nested as Record<string, unknown>).token).toBe("[REDACTED]");
  });

  it("masks sensitive values in arrays", () => {
    const input = { items: [{ apiKey: "key1" }, { apiKey: "key2" }] };
    const result = redact(input as Record<string, unknown>);
    const items = result.items as Record<string, unknown>[];
    expect(items[0]!.apiKey).toBe("[REDACTED]");
    expect(items[1]!.apiKey).toBe("[REDACTED]");
  });

  it("redacts headers case-insensitively", () => {
    const headers = {
      Authorization: "Bearer abc",
      Cookie: "session=x",
      "Content-Type": "application/json",
    };
    const result = redactHeaders(headers);
    expect(result.Authorization).toBe("[REDACTED]");
    expect(result.Cookie).toBe("[REDACTED]");
    expect(result["Content-Type"]).toBe("application/json");
  });

  it("redacts URL query parameters", () => {
    expect(
      redactQueryString("https://example.com?token=secret&public=ok"),
    ).toBe("https://example.com/?token=[REDACTED]&public=ok");
    expect(redactQueryString("/path?access_token=abc&code=123")).toBe(
      "/path?access_token=[REDACTED]&code=[REDACTED]",
    );
  });

  it("redacts errors without leaking stack or original message details", () => {
    const cause = new Error("password=leak");
    const error = new Error("something failed", { cause });
    const result = redactValue(error) as Record<string, unknown>;
    expect(result.name).toBe("Error");
    expect(result.message).toContain("[REDACTED]");
    expect(result).not.toHaveProperty("stack");
    expect((result.cause as Record<string, unknown>).message).toContain(
      "[REDACTED]",
    );
  });

  it("does not mutate original input", () => {
    const input = { password: "secret", nested: { token: "tok" } };
    redact(input);
    expect(input.password).toBe("secret");
    expect(input.nested.token).toBe("tok");
  });

  it("handles circular references", () => {
    const input: Record<string, unknown> = { a: 1 };
    input.self = input;
    const result = redact(input);
    expect(result.self).toBe("[CIRCULAR]");
  });

  it("redacts private key variants through nested objects and arrays", () => {
    const input = {
      privateKey: "pk-top",
      nested: { private_key: "pk-nested" },
      items: [{ "private-key": "pk-array" }, { PRIVATE_KEY: "pk-upper" }],
    };
    const output = JSON.stringify(redact(input));
    for (const secret of ["pk-top", "pk-nested", "pk-array", "pk-upper"]) {
      expect(output).not.toContain(secret);
    }
  });

  it("redacts database URL key variants and DSNs", () => {
    const output = JSON.stringify(
      redact({
        databaseUrl: "db-url-secret",
        connectionString: "connection-secret",
        DSN: "dsn-secret",
        nested: { database_dsn: "nested-dsn-secret" },
      }),
    );
    for (const secret of [
      "db-url-secret",
      "connection-secret",
      "dsn-secret",
      "nested-dsn-secret",
    ]) {
      expect(output).not.toContain(secret);
    }
  });

  it.each([
    "postgresql://user:db-secret@db.internal:5432/app",
    "mysql://user:db-secret@db.internal/app",
    "mongodb://user:db-secret@db.internal/app",
    "redis://user:db-secret@db.internal/0",
    "amqp://user:db-secret@mq.internal/vhost",
  ])("redacts connection URL userinfo for %s", (url) => {
    const output = String(redactValue(`connection failed: ${url}`));
    expect(output).not.toContain("db-secret");
    expect(output).toMatch(/@(?:db|mq)\.internal/);
  });

  it("redacts encoded connection URL credentials", () => {
    const output = String(
      redactValue(
        "postgresql://encoded%40user:encoded%2Fpassword@db.internal/app",
      ),
    );
    expect(output).not.toContain("encoded%40user");
    expect(output).not.toContain("encoded%2Fpassword");
  });

  it("keeps ordinary URLs usable and redacts expanded query secrets", () => {
    expect(redactValue("https://example.com/public?q=ok")).toBe(
      "https://example.com/public?q=ok",
    );
    const output = String(
      redactValue("https://example.com/?password=db-secret&token=token-secret"),
    );
    expect(output).not.toContain("db-secret");
    expect(output).not.toContain("token-secret");
  });

  it("redacts secrets in Error messages and causes", () => {
    const error = new Error(
      "failed postgresql://user:db-secret@db.internal/app",
      { cause: { privateKey: "pk-cause" } },
    );
    const output = JSON.stringify(redactValue(error));
    expect(output).not.toContain("db-secret");
    expect(output).not.toContain("pk-cause");
  });

  it("handles circular Error causes", () => {
    const error = new Error("failed");
    Object.defineProperty(error, "cause", { value: error, enumerable: true });
    expect(redactValue(error)).toMatchObject({ cause: "[CIRCULAR]" });
  });

  it("produces body summary without exposing student content", () => {
    const body = {
      studentAnswer: "完整书面回答",
      audioContent: "base64data",
      metadata: { score: 85 },
    };
    const summary = redactBodySummary(body);
    expect(summary.present).toBe(true);
    expect(summary.sizeHint).toBeGreaterThan(0);
    expect(summary.redacted).toEqual({
      studentAnswer: "[REDACTED]",
      audioContent: "[REDACTED]",
      metadata: { score: 85 },
    });
  });
});
