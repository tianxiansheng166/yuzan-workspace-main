import { describe, expect, it } from "vitest";
import {
  cloneDemoActivity,
  unavailableActivity,
} from "../../app/features/learning-player/adapters/demo.adapter";
import { demoProgressGateway } from "../../app/features/learning-player/gateway/player.gateway";
import { validateResponse } from "../../app/features/learning-player/validation/response";

describe("learning boundaries", () => {
  it("returns null for an unknown activity", () =>
    expect(cloneDemoActivity("unknown")).toBeNull());
  it("provides an unavailable adapter", () =>
    expect(unavailableActivity("x").state).toBe("unavailable"));
  it("keeps speech unavailable without fake AI scores", () => {
    const item = cloneDemoActivity("retest-greeting-rhythm")!;
    expect(item.speechCapability).toBe("unavailable");
    expect(item.aiResult).toBe("pending");
    expect(validateResponse(item, "练习").valid).toBe(false);
  });
  it("does not call a local save synced", async () =>
    expect(
      await demoProgressGateway.saveLocal("x", {
        stepIndex: 0,
        status: "ready",
        dirty: true,
        busy: false,
      }),
    ).toBe("local-only"));
  it("reports submit unavailable", async () =>
    expect(
      await demoProgressGateway.submit("x", {
        stepIndex: 0,
        status: "ready",
        dirty: true,
        busy: false,
      }),
    ).toBe("unavailable"));
  it("guides short writing without shaming language", () => {
    const item = cloneDemoActivity("write-morning-sentence")!;
    const result = validateResponse(item, "太短");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("再补充一点");
  });
});
