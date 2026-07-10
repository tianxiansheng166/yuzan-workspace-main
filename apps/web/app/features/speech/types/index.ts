export type RecordingState =
  | "unsupported"
  | "idle"
  | "requesting-permission"
  | "permission-denied"
  | "permission-dismissed"
  | "device-unavailable"
  | "ready"
  | "checking-input"
  | "recording"
  | "paused"
  | "stopping"
  | "reviewing"
  | "local-only"
  | "pending-sync"
  | "upload-unavailable"
  | "error";

export type RecordingSyncState =
  "local-only" | "pending-sync" | "synced" | "failed" | "unavailable";

export type RecordingEvent =
  | "CHECK_SUPPORT"
  | "REQUEST_PERMISSION"
  | "PERMISSION_GRANTED"
  | "PERMISSION_DENIED"
  | "PERMISSION_DISMISSED"
  | "DEVICE_MISSING"
  | "CHECK_INPUT"
  | "INPUT_READY"
  | "START"
  | "PAUSE"
  | "RESUME"
  | "STOP"
  | "RECORDED"
  | "SAVE_LOCAL"
  | "QUEUE_SYNC"
  | "UPLOAD_UNAVAILABLE"
  | "RETAKE"
  | "DELETE"
  | "FAIL";

export interface RecordingSnapshot {
  state: RecordingState;
  elapsedMs: number;
  hasLocalRecording: boolean;
  syncState: RecordingSyncState;
  message: string;
}

export interface SpeechCapabilityResult {
  supported: boolean;
  secureContext: boolean;
  mediaRecorder: boolean;
  getUserMedia: boolean;
  reason?: string;
}

export interface InputDevice {
  deviceId: string;
  label: string;
}

export interface RecordedAudio {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  size: number;
  sampleRate?: number;
  peakLevel?: number;
  averageLevel?: number;
  capturedSamples?: number;
}

export interface LocalQualityResult {
  status: "pass" | "review" | "empty";
  checks: Array<{
    code:
      "empty" | "too-short" | "silence" | "clipping" | "low-input" | "format";
    level: "ok" | "notice" | "warning";
    message: string;
  }>;
}

export interface LocalRecordingReference {
  id: string;
  createdAt: string;
  durationMs: number;
  size: number;
  mimeType: string;
  syncState: Exclude<RecordingSyncState, "synced">;
  blob: Blob;
}

export interface SpeechCapability {
  inspect(): SpeechCapabilityResult;
  requestPermission(deviceId?: string): Promise<MediaStream>;
  listInputDevices(): Promise<InputDevice[]>;
}

export interface RecorderAdapter {
  start(stream: MediaStream): void;
  pause(): void;
  resume(): void;
  stop(): Promise<RecordedAudio>;
  cleanup(): void;
}

export interface LocalRecordingStore {
  save(recording: LocalRecordingReference): Promise<LocalRecordingReference>;
  get(id: string): Promise<LocalRecordingReference | null>;
  delete(id: string): Promise<void>;
}

export interface RecordingController {
  readonly snapshot: RecordingSnapshot;
  readonly recording: RecordedAudio | null;
  readonly quality: LocalQualityResult | null;
  readonly localReference: LocalRecordingReference | null;
  readonly previewUrl: string | null;
  inspectCapability(): SpeechCapabilityResult;
  requestPermission(deviceId?: string): Promise<void>;
  listDevices(): Promise<InputDevice[]>;
  checkInput(): void;
  start(): void;
  pause(): void;
  resume(): void;
  stop(): Promise<void>;
  saveLocal(): Promise<void>;
  queueSync(): void;
  markUploadUnavailable(): void;
  retake(): void;
  deleteLocal(): Promise<void>;
  handleDeviceInterrupted(): void;
  handlePageHidden(): void;
  cleanup(): void;
}
