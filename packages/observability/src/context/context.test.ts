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
});
