import { describe, expect, it } from "vitest";
import { createRegistry } from "./metrics.js";

describe("metrics", () => {
  it("counter increases monotonically", () => {
    const registry = createRegistry();
    registry.register({
      name: "http_requests_total",
      help: "Total HTTP requests",
      type: "counter",
      labelNames: ["method", "route"],
    });
    registry.inc("http_requests_total", { method: "GET", route: "/health" });
    registry.inc("http_requests_total", { method: "GET", route: "/health" });
    const snapshot = registry.getSnapshot()["http_requests_total"] as {
      values: Record<string, number>;
    };
    expect(Object.values(snapshot.values)[0]).toBe(2);
  });

  it("gauge can increase and decrease", () => {
    const registry = createRegistry();
    registry.register({
      name: "dependency_status",
      help: "Dependency health status",
      type: "gauge",
      labelNames: ["name"],
    });
    registry.set("dependency_status", { name: "db" }, 1);
    expect(registry.getValue("dependency_status", { name: "db" })).toBe(1);
    registry.set("dependency_status", { name: "db" }, 0);
    expect(registry.getValue("dependency_status", { name: "db" })).toBe(0);
  });

  it("histogram records samples", () => {
    const registry = createRegistry();
    registry.register({
      name: "http_request_duration_ms",
      help: "HTTP request duration",
      type: "histogram",
      labelNames: ["route"],
    });
    registry.observe("http_request_duration_ms", { route: "/api" }, 150);
    const snapshot = registry.getSnapshot()[
      "http_request_duration_ms"
    ] as unknown as {
      values: Record<
        string,
        { sum: number; count: number; buckets: Record<string, number> }
      >;
    };
    const sample = Object.values(snapshot.values)[0]!;
    expect(sample.sum).toBe(150);
    expect(sample.count).toBe(1);
    expect(sample.buckets["250"]).toBe(1);
  });

  it("allows repeat registration with identical definition", () => {
    const registry = createRegistry();
    const definition = {
      name: "http_errors_total",
      help: "Total HTTP errors",
      type: "counter",
    } as const;
    registry.register(definition);
    registry.register(definition);
    expect(() => registry.inc("http_errors_total")).not.toThrow();
  });

  it("rejects conflicting definitions", () => {
    const registry = createRegistry();
    registry.register({
      name: "x",
      help: "first",
      type: "counter",
    });
    expect(() =>
      registry.register({
        name: "x",
        help: "second",
        type: "counter",
      }),
    ).toThrow("conflict");
  });

  it("rejects reserved label names", () => {
    const registry = createRegistry();
    expect(() =>
      registry.register({
        name: "m",
        help: "metric",
        type: "counter",
        labelNames: ["studentId"],
      }),
    ).toThrow("studentId");
  });

  it("rejects undeclared labels", () => {
    const registry = createRegistry();
    registry.register({
      name: "m",
      help: "metric",
      type: "counter",
      labelNames: ["route"],
    });
    expect(() => registry.inc("m", { unknown: "x" })).toThrow("not declared");
  });

  it("rejects full URL as label value", () => {
    const registry = createRegistry();
    registry.register({
      name: "m",
      help: "metric",
      type: "counter",
      labelNames: ["route"],
    });
    expect(() =>
      registry.inc("m", { route: "https://example.com/api/v1/users/123" }),
    ).toThrow("must use template path");
  });

  it("accepts route template as label value", () => {
    const registry = createRegistry();
    registry.register({
      name: "m",
      help: "metric",
      type: "counter",
      labelNames: ["route"],
    });
    expect(() =>
      registry.inc("m", { route: "/api/v1/users/:id" }),
    ).not.toThrow();
  });

  it("enforces label count limit", () => {
    const registry = createRegistry();
    registry.register({
      name: "m",
      help: "metric",
      type: "counter",
      labelNames: Array.from({ length: 16 }, (_, i) => `l${i}`),
    });
    const labels = Object.fromEntries(
      Array.from({ length: 17 }, (_, i) => [`l${i}`, `v${i}`]),
    );
    expect(() => registry.inc("m", labels)).toThrow("Too many labels");
  });

  it("snapshot does not contain secret values", () => {
    const registry = createRegistry();
    registry.register({
      name: "m",
      help: "metric",
      type: "counter",
      labelNames: ["route"],
    });
    registry.inc("m", { route: "/ok" });
    const snapshot = JSON.stringify(registry.getSnapshot());
    expect(snapshot).not.toContain("secret");
  });
});
