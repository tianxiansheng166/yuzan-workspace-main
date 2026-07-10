import { describe, expect, it } from "vitest";
import { LivenessService } from "./liveness.service.js";

describe("LivenessService", () => {
  it("returns ok without checking dependencies", () => {
    const service = new LivenessService();
    const result = service.check();
    expect(result.status).toBe("ok");
    expect(result.service).toBe("api");
    expect(result.uptimeMs).toBeGreaterThanOrEqual(0);
    expect(new Date(result.timestamp).getTime()).not.toBeNaN();
  });

  it("does not include sensitive fields", () => {
    const service = new LivenessService();
    const result = service.check();
    expect(result).not.toHaveProperty("hostname");
    expect(result).not.toHaveProperty("env");
    expect(result).not.toHaveProperty("databaseUrl");
  });
});
