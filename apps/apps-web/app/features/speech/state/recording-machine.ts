import type { RecordingEvent, RecordingSnapshot } from "../types";

export const initialRecordingSnapshot = (): RecordingSnapshot => ({
  state: "idle",
  elapsedMs: 0,
  hasLocalRecording: false,
  syncState: "unavailable",
  message: "麦克风尚未启动。录音不会自动上传或提交。",
});

const transitions: Partial<
  Record<
    RecordingSnapshot["state"],
    Partial<Record<RecordingEvent, RecordingSnapshot["state"]>>
  >
> = {
  idle: { REQUEST_PERMISSION: "requesting-permission", CHECK_SUPPORT: "ready" },
  "requesting-permission": {
    PERMISSION_GRANTED: "ready",
    PERMISSION_DENIED: "permission-denied",
    PERMISSION_DISMISSED: "permission-dismissed",
    DEVICE_MISSING: "device-unavailable",
    FAIL: "error",
  },
  "permission-denied": { REQUEST_PERMISSION: "requesting-permission" },
  "permission-dismissed": { REQUEST_PERMISSION: "requesting-permission" },
  "device-unavailable": {
    REQUEST_PERMISSION: "requesting-permission",
    FAIL: "error",
  },
  ready: {
    CHECK_INPUT: "checking-input",
    START: "recording",
    DEVICE_MISSING: "device-unavailable",
  },
  "checking-input": {
    INPUT_READY: "ready",
    START: "recording",
    DEVICE_MISSING: "device-unavailable",
  },
  recording: {
    PAUSE: "paused",
    STOP: "stopping",
    DEVICE_MISSING: "error",
    FAIL: "error",
  },
  paused: {
    RESUME: "recording",
    STOP: "stopping",
    DEVICE_MISSING: "error",
    FAIL: "error",
  },
  stopping: { RECORDED: "reviewing", FAIL: "error" },
  reviewing: { SAVE_LOCAL: "local-only", RETAKE: "ready", DELETE: "ready" },
  "local-only": {
    QUEUE_SYNC: "pending-sync",
    UPLOAD_UNAVAILABLE: "upload-unavailable",
    RETAKE: "ready",
    DELETE: "ready",
  },
  "pending-sync": {
    UPLOAD_UNAVAILABLE: "upload-unavailable",
    RETAKE: "ready",
    DELETE: "ready",
  },
  "upload-unavailable": {
    QUEUE_SYNC: "pending-sync",
    RETAKE: "ready",
    DELETE: "ready",
  },
  error: {
    RETAKE: "ready",
    REQUEST_PERMISSION: "requesting-permission",
    DELETE: "idle",
  },
};

export function transitionRecording(
  snapshot: RecordingSnapshot,
  event: RecordingEvent,
  message = snapshot.message,
): RecordingSnapshot {
  if (event === "FAIL") return { ...snapshot, state: "error", message };
  const nextState = transitions[snapshot.state]?.[event];
  if (!nextState) return snapshot;
  return {
    ...snapshot,
    state: nextState,
    message,
    hasLocalRecording:
      event === "SAVE_LOCAL"
        ? true
        : event === "DELETE" || event === "RETAKE"
          ? false
          : snapshot.hasLocalRecording,
    syncState:
      event === "SAVE_LOCAL"
        ? "local-only"
        : event === "QUEUE_SYNC"
          ? "pending-sync"
          : event === "UPLOAD_UNAVAILABLE"
            ? "unavailable"
            : event === "DELETE" || event === "RETAKE"
              ? "unavailable"
              : snapshot.syncState,
  };
}
