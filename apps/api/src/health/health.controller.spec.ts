import { describe, expect, it } from "vitest";
import { HealthController } from "./health.controller.js";
import { LivenessService } from "./liveness.service.js";
import { ReadinessService } from "./readiness.service.js";
import { StartupService } from "./startup.service.js";

describe("HealthController", () => {
  const makeController = () =>
    new HealthController(
      new LivenessService(),
      new ReadinessService(),
      new StartupService(),
    );

  it("live returns ok envelope", () => {
    const controller = makeController();
    const response = {
      getHeader: () => "req-1",
      status: () => response,
    } as unknown as Parameters<HealthController["live"]>[0];
    const result = controller.live(response);
    expect(result.data.status).toBe("ok");
    expect(result.meta.requestId).toBe("req-1");
  });

  it("ready returns ok when no dependencies are registered", async () => {
    const controller = makeController();
    const response = {
      getHeader: () => "req-2",
      status: () => response,
    } as unknown as Parameters<HealthController["ready"]>[0];
    const result = await controller.ready(response);
    if ("error" in result) {
      throw new Error("expected success envelope");
    }
    expect(result.data.status).toBe("ok");
  });
});
