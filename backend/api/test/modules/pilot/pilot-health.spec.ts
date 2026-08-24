import { beforeEach, describe, expect, it, vi } from "vitest";

const redisState = vi.hoisted(() => ({ ping: vi.fn() }));
vi.mock("ioredis", () => ({
  default: class FakeRedis {
    async ping() { return redisState.ping(); }
    disconnect() {}
  },
}));

import { HealthController } from "../../../src/modules/health/health.controller.js";
import { HealthService } from "../../../src/modules/health/health.service.js";

function config() {
  return {
    get: (key: string, fallback?: unknown) => ({ REDIS_HOST: "127.0.0.1", REDIS_PORT: 6379 }[key] ?? fallback),
  };
}

function dependencies() {
  return {
    prisma: { $queryRawUnsafe: vi.fn().mockResolvedValue([{ result: 1 }]) },
    storage: { checkBucket: vi.fn().mockResolvedValue(undefined) },
  };
}

describe("pilot health semantics", () => {
  beforeEach(() => {
    redisState.ping.mockReset();
    redisState.ping.mockResolvedValue("PONG");
  });

  it("reports all three core dependencies UP when checks succeed", async () => {
    const deps = dependencies();
    const service = new HealthService(deps.prisma as never, config() as never, deps.storage);

    await expect(service.coreReadiness()).resolves.toEqual({ database: "UP", redis: "UP", objectStorage: "UP" });
  });

  it.each([
    ["database", "database"],
    ["redis", "redis"],
    ["storage", "objectStorage"],
  ])("marks %s DOWN without changing the other checks", async (_label, stateKey) => {
    const deps = dependencies();
    if (stateKey === "database") deps.prisma.$queryRawUnsafe.mockRejectedValue(new Error("db down"));
    if (stateKey === "redis") redisState.ping.mockRejectedValue(new Error("redis down"));
    if (stateKey === "objectStorage") deps.storage.checkBucket.mockRejectedValue(new Error("bucket missing"));
    const service = new HealthService(deps.prisma as never, config() as never, deps.storage);

    const result = await service.coreReadiness();

    expect(result[stateKey as keyof typeof result]).toBe("DOWN");
    expect(Object.values(result).filter((value) => value === "UP")).toHaveLength(2);
  });

  it("keeps liveness 200 and returns 503 only for failed readiness", async () => {
    const health = { coreReadiness: vi.fn().mockResolvedValue({ database: "DOWN", redis: "UP", objectStorage: "UP" }) };
    const controller = new HealthController(health as never);
    const response = { status: vi.fn() };

    expect(controller.live().status).toBe("ok");
    const ready = await controller.ready(response as never);

    expect(ready.status).toBe("unavailable");
    expect(response.status).toHaveBeenCalledWith(503);
    expect(ready).not.toHaveProperty("database");
    expect(ready).not.toHaveProperty("redis");
  });
});
