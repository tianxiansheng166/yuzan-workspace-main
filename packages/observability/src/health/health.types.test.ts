import { describe, expect, it } from "vitest";
import type {
  DependencyCategory,
  DependencyCheckResult,
  DependencyStatus,
  LivenessResult,
  ReadinessResult,
  StartupState,
} from "./health.types.js";

describe("health types", () => {
  it("supports all dependency categories", () => {
    const categories: DependencyCategory[] = [
      "database",
      "object-storage",
      "message-queue",
      "ai-service",
      "cache",
      "external-api",
    ];
    expect(categories.length).toBeGreaterThan(0);
  });

  it("supports all dependency statuses", () => {
    const statuses: DependencyStatus[] = [
      "healthy",
      "degraded",
      "unavailable",
      "timeout",
      "unknown",
      "not-configured",
    ];
    expect(statuses.length).toBeGreaterThan(0);
  });

  it("supports startup states", () => {
    const states: StartupState[] = ["starting", "ready", "failed"];
    expect(states).toContain("starting");
    expect(states).toContain("ready");
    expect(states).toContain("failed");
  });

  it("readiness result contains dependencies", () => {
    const dep: DependencyCheckResult = {
      name: "database",
      category: "database",
      status: "healthy",
      optional: false,
    };
    const result: ReadinessResult = {
      status: "ok",
      timestamp: new Date().toISOString(),
      dependencies: [dep],
    };
    expect(result.dependencies[0]!.name).toBe("database");
  });

  it("liveness result does not include sensitive details", () => {
    const result: LivenessResult = {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "api",
      uptimeMs: 1000,
    };
    expect(result.service).toBe("api");
    expect(result.uptimeMs).toBeGreaterThanOrEqual(0);
  });
});
