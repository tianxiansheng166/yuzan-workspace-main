import { describe, expect, it } from "vitest";
import { redact } from "../../backend/api/src/common/security/log-redaction.js";

describe("redact", () => {
  it("leaves primitive values unchanged", () => {
    expect(redact("hello")).toBe("hello");
    expect(redact(42)).toBe(42);
    expect(redact(true)).toBe(true);
    expect(redact(null)).toBe(null);
    expect(redact(undefined)).toBe(undefined);
  });

  it("redacts authentication and secret fields", () => {
    const payload = {
      username: "student-1",
      password: "super-secret",
      passwordHash: "bcrypt$...",
      token: "jwt-token",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      authorization: "Bearer xyz",
      apiKey: "key-123",
      secret: "client-secret",
      credential: "credential-value",
      session: "session-id",
    };
    const result = redact(payload);

    for (const key of Object.keys(payload)) {
      if (key === "username") {
        expect(result[key]).toBe(payload[key]);
      } else {
        expect(result[key]).toBe("[REDACTED]");
      }
    }
  });

  it("redacts student PII fields", () => {
    const payload = {
      userId: "user-1",
      displayName: "小明",
      realName: "大明",
      phone: "13800138000",
      email: "student@example.com",
      idCard: "11010120200101xxxx",
      address: "北京市",
      audioUrl: "https://demo/pending",
      recording: "recording-id",
      avatar: "avatar-url",
      profile: { age: 12 },
    };
    const result = redact(payload);

    expect(result.userId).toBe("user-1");
    expect(result.displayName).toBe("[REDACTED]");
    expect(result.realName).toBe("[REDACTED]");
    expect(result.phone).toBe("[REDACTED]");
    expect(result.email).toBe("[REDACTED]");
    expect(result.idCard).toBe("[REDACTED]");
    expect(result.address).toBe("[REDACTED]");
    expect(result.audioUrl).toBe("[REDACTED]");
    expect(result.recording).toBe("[REDACTED]");
    expect(result.avatar).toBe("[REDACTED]");
    expect(result.profile).toBe("[REDACTED]");
  });

  it("redacts nested objects and arrays recursively", () => {
    const payload = {
      entries: [
        { password: "secret-1", score: 80 },
        { token: "token-2", score: 90 },
      ],
      nested: {
        deeper: {
          apiKey: "deep-key",
          phone: "13800138000",
        },
      },
    };
    const result = redact(payload);

    expect(result.entries).toEqual([
      { password: "[REDACTED]", score: 80 },
      { token: "[REDACTED]", score: 90 },
    ]);
    expect(result.nested).toEqual({
      deeper: {
        apiKey: "[REDACTED]",
        phone: "[REDACTED]",
      },
    });
  });

  it("is case-insensitive and ignores separators", () => {
    const payload = {
      PASSWORD: "upper",
      api_key: "snake",
      "refresh-token": "kebab",
      AuthorizationHeader: "mixed",
    };
    const result = redact(payload);

    expect(result.PASSWORD).toBe("[REDACTED]");
    expect(result.api_key).toBe("[REDACTED]");
    expect(result["refresh-token"]).toBe("[REDACTED]");
    expect(result.AuthorizationHeader).toBe("[REDACTED]");
  });

  it("does not redact non-sensitive fields", () => {
    const payload = {
      schoolId: "school-a",
      assignmentId: "assignment-1",
      attemptNo: 1,
      score: 95,
      status: "completed",
      metadata: { tags: ["demo", "pending"] },
    };
    const result = redact(payload);

    expect(result).toEqual(payload);
  });
});
