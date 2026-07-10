import { describe, expect, it } from "vitest";
import {
  needsExitConfirmation,
  transitionPlayer,
} from "../../app/features/learning-player/state/player-machine";
import type { PlayerSnapshot } from "../../app/features/learning-player/types";
import { learningProgressStates } from "../../app/features/today/types";

const ready = (): PlayerSnapshot => ({
  stepIndex: 0,
  status: "ready",
  dirty: false,
  busy: false,
});

describe("learning player state machine", () => {
  it("retains all eleven progress states", () => {
    expect(learningProgressStates).toEqual([
      "not-started",
      "ready",
      "in-progress",
      "paused",
      "local-only",
      "pending-sync",
      "submitted",
      "needs-revision",
      "retest-recommended",
      "completed",
      "unavailable",
    ]);
  });
  it("moves through steps", () =>
    expect(transitionPlayer(ready(), "NEXT").stepIndex).toBe(1));
  it("pauses and resumes", () =>
    expect(
      transitionPlayer(transitionPlayer(ready(), "PAUSE"), "RESUME").status,
    ).toBe("in-progress"));
  it("marks local-only distinctly from synced", () =>
    expect(transitionPlayer(ready(), "SAVE_LOCAL").status).toBe("local-only"));
  it("requests exit confirmation for unsynced work", () =>
    expect(needsExitConfirmation({ ...ready(), dirty: true })).toBe(true));
  it("supports needs-revision", () =>
    expect(transitionPlayer(ready(), "REQUEST_REVISION").status).toBe(
      "needs-revision",
    ));
  it("keeps completed activities read-only", () => {
    const done = { ...ready(), status: "completed" as const };
    expect(transitionPlayer(done, "NEXT")).toEqual(done);
  });
  it("guards repeated operations while busy", () => {
    const busy = { ...ready(), busy: true };
    expect(transitionPlayer(busy, "NEXT")).toEqual(busy);
  });
});
