import { describe, expect, it } from "vitest";
import { DependencyCheck } from "./dependency-check.js";

describe("DependencyCheck", () => {
  it("returns not-configured when no checker is provided", async () => {
    const check = new DependencyCheck({
      name: "database",
      category: "database",
    });
    const result = await check.check();
    expect(result.status).toBe("not-configured");
    expect(result.name).toBe("database");
    expect(result.category).toBe("database");
  });

  it("returns checker result when healthy", async () => {
    const check = new DependencyCheck({
      name: "db",
      category: "database",
      checker: () => ({ status: "healthy" as const }),
    });
    const result = await check.check();
    expect(result.status).toBe("healthy");
  });

  it("returns unavailable on checker exception", async () => {
    const check = new DependencyCheck({
      name: "db",
      category: "database",
      checker: () => {
        throw new Error("connection refused");
      },
    });
    const result = await check.check();
    expect(result.status).toBe("unavailable");
    expect(result.errorCode).toBe("CHECK_EXCEPTION");
    expect(result).not.toHaveProperty("stack");
  });

  it("returns timeout when checker is too slow", async () => {
    const check = new DependencyCheck({
      name: "db",
      category: "database",
      timeoutMs: 10,
      checker: async () => {
        await new Promise((r) => setTimeout(r, 1000));
        return { status: "healthy" as const };
      },
    });
    const result = await check.check();
    expect(result.status).toBe("timeout");
    expect(result.errorCode).toBe("CHECK_TIMEOUT");
  });
});
