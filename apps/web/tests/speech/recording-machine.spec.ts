import { describe, expect, it } from "vitest";
import {
  initialRecordingSnapshot,
  transitionRecording,
} from "../../app/features/speech/state/recording-machine";

describe("recording state machine", () => {
  it("moves idle through permission to ready", () => {
    let state = transitionRecording(
      initialRecordingSnapshot(),
      "REQUEST_PERMISSION",
    );
    expect(state.state).toBe("requesting-permission");
    state = transitionRecording(state, "PERMISSION_GRANTED");
    expect(state.state).toBe("ready");
  });

  it.each([
    ["PERMISSION_DENIED", "permission-denied"],
    ["PERMISSION_DISMISSED", "permission-dismissed"],
    ["DEVICE_MISSING", "device-unavailable"],
  ] as const)("handles %s", (event, expected) => {
    const requesting = transitionRecording(
      initialRecordingSnapshot(),
      "REQUEST_PERMISSION",
    );
    expect(transitionRecording(requesting, event).state).toBe(expected);
  });

  it("moves ready to recording", () => {
    const ready = { ...initialRecordingSnapshot(), state: "ready" as const };
    expect(transitionRecording(ready, "START").state).toBe("recording");
  });

  it("moves recording through pause and resume", () => {
    const recording = {
      ...initialRecordingSnapshot(),
      state: "recording" as const,
    };
    const paused = transitionRecording(recording, "PAUSE");
    expect(paused.state).toBe("paused");
    expect(transitionRecording(paused, "RESUME").state).toBe("recording");
  });

  it("moves recording to reviewing", () => {
    const recording = {
      ...initialRecordingSnapshot(),
      state: "recording" as const,
    };
    const stopping = transitionRecording(recording, "STOP");
    expect(transitionRecording(stopping, "RECORDED").state).toBe("reviewing");
  });

  it("ignores duplicate start and stop events", () => {
    const recording = {
      ...initialRecordingSnapshot(),
      state: "recording" as const,
    };
    expect(transitionRecording(recording, "START")).toBe(recording);
    const stopping = transitionRecording(recording, "STOP");
    expect(transitionRecording(stopping, "STOP")).toBe(stopping);
  });

  it("never equates pending sync with synced", () => {
    const local = transitionRecording(
      { ...initialRecordingSnapshot(), state: "reviewing" },
      "SAVE_LOCAL",
    );
    const pending = transitionRecording(local, "QUEUE_SYNC");
    expect(pending.syncState).toBe("pending-sync");
    expect(pending.syncState).not.toBe("synced");
  });

  it("marks upload as unavailable without deleting local state", () => {
    const local = transitionRecording(
      { ...initialRecordingSnapshot(), state: "reviewing" },
      "SAVE_LOCAL",
    );
    const unavailable = transitionRecording(local, "UPLOAD_UNAVAILABLE");
    expect(unavailable.state).toBe("upload-unavailable");
    expect(unavailable.hasLocalRecording).toBe(true);
  });

  it("deleting clears local saved state", () => {
    const local = transitionRecording(
      { ...initialRecordingSnapshot(), state: "reviewing" },
      "SAVE_LOCAL",
    );
    const deleted = transitionRecording(local, "DELETE");
    expect(deleted.hasLocalRecording).toBe(false);
    expect(deleted.state).toBe("ready");
  });
});
