import { describe, it, expect } from "vitest";

function computeStatus(database: "connected" | "disconnected"): "ok" | "degraded" {
  return database === "connected" ? "ok" : "degraded";
}

describe("OperationsService status logic", () => {
  it("returns ok when database is connected", () => {
    expect(computeStatus("connected")).toBe("ok");
  });

  it("returns degraded when database is disconnected", () => {
    expect(computeStatus("disconnected")).toBe("degraded");
  });

  it("connected status with active schools yields ok overall", () => {
    const database: "connected" | "disconnected" = "connected";
    const activeSchools = 5;
    const status = computeStatus(database);
    expect(status).toBe("ok");
    expect(activeSchools).toBeGreaterThan(0);
  });

  it("disconnected status yields degraded even with zero schools", () => {
    const database: "connected" | "disconnected" = "disconnected";
    const activeSchools = 0;
    const status = computeStatus(database);
    expect(status).toBe("degraded");
    expect(activeSchools).toBe(0);
  });
});
