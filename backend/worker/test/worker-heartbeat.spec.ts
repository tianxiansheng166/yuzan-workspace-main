import { describe, expect, it, vi } from "vitest";
import { WorkerHeartbeat, type WorkerHeartbeatClient } from "../src/worker-heartbeat.js";

function client(overrides: Partial<WorkerHeartbeatClient> = {}) {
  return {
    set: vi.fn<WorkerHeartbeatClient["set"]>().mockResolvedValue("OK"),
    disconnect: vi.fn(),
    ...overrides,
  };
}

describe("WorkerHeartbeat", () => {
  it("writes a timestamp with the configured key and TTL", async () => {
    const redis = client();
    const heartbeat = new WorkerHeartbeat(redis, "test:heartbeat", 60, 15_000, vi.fn());

    await heartbeat.write();

    expect(redis.set).toHaveBeenCalledWith("test:heartbeat", expect.any(String), "EX", 60);
  });

  it("contains Redis failures and leaves the worker job path independent", async () => {
    const error = new Error("redis down");
    const onFailure = vi.fn();
    const redis = client({ set: vi.fn<WorkerHeartbeatClient["set"]>().mockRejectedValue(error) });
    const heartbeat = new WorkerHeartbeat(redis, "test:heartbeat", 60, 15_000, onFailure);

    await expect(heartbeat.write()).resolves.toBeUndefined();
    expect(onFailure).toHaveBeenCalledWith(error);
  });

  it("stops its timer and disconnects cleanly", () => {
    vi.useFakeTimers();
    const redis = client();
    const heartbeat = new WorkerHeartbeat(redis, "test:heartbeat", 60, 15_000, vi.fn());

    heartbeat.start();
    heartbeat.stop();

    expect(redis.disconnect).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
