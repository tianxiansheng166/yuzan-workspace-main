import { describe, expect, it } from "vitest";
import { StartupService } from "./startup.service.js";

describe("StartupService", () => {
  it("starts in starting state", () => {
    const service = new StartupService();
    expect(service.getState()).toBe("starting");
    expect(service.isReady()).toBe(false);
  });

  it("transitions to ready", () => {
    const service = new StartupService();
    service.ready();
    expect(service.getState()).toBe("ready");
    expect(service.isReady()).toBe(true);
  });

  it("transitions to failed", () => {
    const service = new StartupService();
    service.failed();
    expect(service.getState()).toBe("failed");
    expect(service.isReady()).toBe(false);
  });

  it("does not represent failed as ready", () => {
    const service = new StartupService();
    service.failed();
    expect(service.isReady()).toBe(false);
    service.ready();
    expect(service.isReady()).toBe(true);
  });
});
