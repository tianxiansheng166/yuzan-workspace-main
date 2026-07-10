import { describe, expect, it } from "vitest";
import { createShutdownCoordinator } from "./shutdown.js";

describe("shutdown", () => {
  it("runs multiple cleaners sequentially by default", async () => {
    const order: string[] = [];
    const coordinator = createShutdownCoordinator();
    coordinator.register({
      name: "first",
      fn: () => {
        order.push("first");
      },
    });
    coordinator.register({
      name: "second",
      fn: () => {
        order.push("second");
      },
    });

    await coordinator.shutdown();
    expect(order).toEqual(["first", "second"]);
  });

  it("runs cleaners in parallel when configured", async () => {
    const order: string[] = [];
    const coordinator = createShutdownCoordinator({
      strategy: "parallel",
      timeoutMs: 1000,
    });
    coordinator.register({
      name: "a",
      fn: async () => {
        await new Promise((r) => setTimeout(r, 10));
        order.push("a");
      },
    });
    coordinator.register({
      name: "b",
      fn: () => {
        order.push("b");
      },
    });

    await coordinator.shutdown();
    expect(order).toContain("a");
    expect(order).toContain("b");
  });

  it("times out slow cleaners", async () => {
    const coordinator = createShutdownCoordinator({ timeoutMs: 50 });
    coordinator.register({
      name: "slow",
      fn: async () => {
        await new Promise((r) => setTimeout(r, 1000));
      },
    });

    const results = await coordinator.shutdown();
    expect(results[0]).toEqual({
      name: "slow",
      success: false,
      error: "timeout",
    });
  });

  it("aggregates cleanup exceptions", async () => {
    const coordinator = createShutdownCoordinator();
    coordinator.register({
      name: "failing",
      fn: () => {
        throw new Error("cleanup failed");
      },
    });

    const results = await coordinator.shutdown();
    expect(results[0]!.success).toBe(false);
    expect(results[0]!.error).toContain("cleanup failed");
  });

  it("prevents duplicate shutdown", async () => {
    const coordinator = createShutdownCoordinator();
    let calls = 0;
    coordinator.register({
      name: "once",
      fn: () => {
        calls += 1;
      },
    });

    await coordinator.shutdown();
    const second = await coordinator.shutdown();
    expect(calls).toBe(1);
    expect(second).toEqual([]);
  });

  it("succeeds with no cleaners", async () => {
    const coordinator = createShutdownCoordinator();
    const results = await coordinator.shutdown();
    expect(results).toEqual([]);
  });
});
