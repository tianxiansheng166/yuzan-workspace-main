import { describe, expect, it } from "vitest";
import { DependencyCheck } from "./dependency-check.js";
import { ReadinessService } from "./readiness.service.js";

describe("ReadinessService", () => {
  it("reports ok when all dependencies are healthy", async () => {
    const service = new ReadinessService([
      new DependencyCheck({
        name: "database",
        category: "database",
        checker: () => ({ status: "healthy" as const }),
      }),
    ]);
    const report = await service.check();
    expect(report.ready).toBe(true);
    expect(report.data.status).toBe("ok");
  });

  it("reports not ready when a required dependency fails", async () => {
    const service = new ReadinessService([
      new DependencyCheck({
        name: "database",
        category: "database",
        checker: () => ({ status: "unavailable" as const }),
      }),
    ]);
    const report = await service.check();
    expect(report.ready).toBe(false);
    expect(report.data.status).toBe("degraded");
  });

  it("reports degraded when an optional dependency fails", async () => {
    const service = new ReadinessService([
      new DependencyCheck({
        name: "ai-service",
        category: "ai-service",
        optional: true,
        checker: () => ({ status: "unavailable" as const }),
      }),
    ]);
    const report = await service.check();
    expect(report.ready).toBe(true);
    expect(report.data.status).toBe("degraded");
  });

  it("reports not ready when multiple required dependencies fail", async () => {
    const service = new ReadinessService([
      new DependencyCheck({
        name: "database",
        category: "database",
        checker: () => ({ status: "unavailable" as const }),
      }),
      new DependencyCheck({
        name: "object-storage",
        category: "object-storage",
        checker: () => ({ status: "unavailable" as const }),
      }),
    ]);
    const report = await service.check();
    expect(report.ready).toBe(false);
    expect(report.data.dependencies).toHaveLength(2);
  });

  it("does not leak checker exception details", async () => {
    const service = new ReadinessService([
      new DependencyCheck({
        name: "database",
        category: "database",
        checker: () => {
          throw new Error("host=db.internal port=5432");
        },
      }),
    ]);
    const report = await service.check();
    expect(report.data.dependencies).toBeDefined();
    const dep = report.data.dependencies![0]!;
    expect(dep.status).toBe("unavailable");
    expect(dep.errorCode).toBe("CHECK_EXCEPTION");
    expect(dep).not.toHaveProperty("stack");
    expect(dep).not.toHaveProperty("message");
  });

  it("reports degraded when dependency times out", async () => {
    const service = new ReadinessService([
      new DependencyCheck({
        name: "database",
        category: "database",
        timeoutMs: 5,
        checker: async () => {
          await new Promise((r) => setTimeout(r, 1000));
          return { status: "healthy" as const };
        },
      }),
    ]);
    const report = await service.check();
    expect(report.ready).toBe(false);
    expect(report.data.dependencies).toBeDefined();
    expect(report.data.dependencies![0]!.status).toBe("timeout");
  });

  it("does not fake healthy when no checker is configured", async () => {
    const service = new ReadinessService([
      new DependencyCheck({ name: "database", category: "database" }),
    ]);
    const report = await service.check();
    expect(report.ready).toBe(false);
    expect(report.data.dependencies).toBeDefined();
    expect(report.data.dependencies![0]!.status).toBe("not-configured");
  });
});
