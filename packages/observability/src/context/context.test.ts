import { describe, expect, it } from "vitest";
import { getContext, runWithContext, setContextDefaults } from "./context.js";

describe("context", () => {
  it("returns defaults when no context is set", () => {
    const ctx = getContext();
    expect(ctx.requestId).toBe("unknown");
    expect(ctx.service).toBe("unknown");
    expect(ctx.environment).toBe(process.env.NODE_ENV ?? "development");
  });

  it("propagates requestId and service through runWithContext", () => {
    runWithContext(
      { requestId: "req-1", service: "api", correlationId: "corr-1" },
      () => {
        const ctx = getContext();
        expect(ctx.requestId).toBe("req-1");
        expect(ctx.service).toBe("api");
        expect(ctx.correlationId).toBe("corr-1");
      },
    );
  });

  it("restores outer context after nested runWithContext", () => {
    runWithContext({ requestId: "outer", service: "api" }, () => {
      expect(getContext().requestId).toBe("outer");
      runWithContext({ requestId: "inner" }, () => {
        expect(getContext().requestId).toBe("inner");
      });
      expect(getContext().requestId).toBe("outer");
    });
  });

  it("uses safe references instead of raw identifiers", () => {
    runWithContext(
      { safeTenantRef: "tenant-sha256-abc", safeUserRef: "user-sha256-xyz" },
      () => {
        const ctx = getContext();
        expect(ctx.safeTenantRef).toBe("tenant-sha256-abc");
        expect(ctx.safeUserRef).toBe("user-sha256-xyz");
      },
    );
  });

  it("allows setting context defaults", () => {
    setContextDefaults({ service: "default-service" });
    const ctx = getContext();
    expect(ctx.service).toBe("default-service");
  });

  it.each(["abc", "request-123", "trace_123", "trace.123", "a".repeat(128)])(
    "preserves valid correlation id %s",
    (correlationId) => {
      runWithContext({ correlationId }, () => {
        expect(getContext().correlationId).toBe(correlationId);
      });
    },
  );

  it.each([
    "",
    "a".repeat(129),
    "has space",
    "has\ttab",
    "has\nnewline",
    "has\r\nheaders",
    "has\0nul",
    "has/slash",
    "has\\backslash",
    "has:colon",
    "has,comma",
    "control\u0085",
    "bidi\u202evalue",
    "emoji😀",
  ])("replaces invalid correlation id safely", (correlationId) => {
    runWithContext({ correlationId }, () => {
      const actual = getContext().correlationId;
      expect(actual).toMatch(/^[A-Za-z0-9._-]{1,128}$/);
      expect(actual).not.toBe(correlationId);
    });
  });

  it("rejects a non-string correlation id at runtime", () => {
    runWithContext({ correlationId: 123 } as never, () => {
      expect(getContext().correlationId).toMatch(/^[A-Za-z0-9._-]{1,128}$/);
    });
  });

  it("uses a validated request id as invalid correlation fallback", () => {
    runWithContext(
      { requestId: "safe-request", correlationId: "bad value" },
      () => {
        expect(getContext().correlationId).toBe("safe-request");
      },
    );
  });

  it("restores an outer correlation id after a nested context", () => {
    runWithContext({ correlationId: "outer-correlation" }, () => {
      runWithContext({ correlationId: "inner-correlation" }, () => {
        expect(getContext().correlationId).toBe("inner-correlation");
      });
      expect(getContext().correlationId).toBe("outer-correlation");
    });
  });

  it("isolates concurrent contexts and clears them when complete", async () => {
    const observed = await Promise.all(
      ["correlation-a", "correlation-b"].map((correlationId) =>
        runWithContext({ correlationId }, async () => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return getContext().correlationId;
        }),
      ),
    );
    expect(observed).toEqual(["correlation-a", "correlation-b"]);
    expect(getContext().correlationId).toBeUndefined();
  });
});
