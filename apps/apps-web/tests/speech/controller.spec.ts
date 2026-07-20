import { describe, expect, it, vi } from "vitest";
import { createRecordingController } from "../../app/features/speech/composables/create-recording-controller";
import { createMemoryRecordingStore } from "../../app/features/speech/storage/offline-recording-store";
import type {
  RecorderAdapter,
  SpeechCapability,
} from "../../app/features/speech/types";

function fixture(options?: {
  permissionError?: Error;
  empty?: boolean;
  noAudioTrack?: boolean;
  maximumDurationMs?: number;
}) {
  let currentTime = 1000;
  const stopTrack = vi.fn();
  const stream = {
    getAudioTracks: () => (options?.noAudioTrack ? [] : [{ stop: stopTrack }]),
    getTracks: () => [{ stop: stopTrack }],
  } as unknown as MediaStream;
  const capability: SpeechCapability = {
    inspect: () => ({
      supported: true,
      secureContext: true,
      mediaRecorder: true,
      getUserMedia: true,
    }),
    requestPermission: async () => {
      if (options?.permissionError) throw options.permissionError;
      return stream;
    },
    listInputDevices: async () => [{ deviceId: "mic", label: "麦克风" }],
  };
  const recorder: RecorderAdapter = {
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(async () => ({
      blob: new Blob(options?.empty ? [] : ["sound"], { type: "audio/webm" }),
      mimeType: "audio/webm",
      durationMs: options?.empty ? 0 : 2200,
      size: options?.empty ? 0 : 5,
    })),
    cleanup: vi.fn(),
  };
  const revoke = vi.fn();
  const controller = createRecordingController({
    capability,
    recorder,
    store: createMemoryRecordingStore(),
    now: () => currentTime,
    maximumDurationMs: options?.maximumDurationMs,
    createObjectUrl: () => "blob:local-preview",
    revokeObjectUrl: revoke,
  });
  return {
    controller,
    recorder,
    stopTrack,
    revoke,
    setTime: (value: number) => (currentTime = value),
  };
}

describe("recording controller", () => {
  it("handles permission granted and available device", async () => {
    const { controller } = fixture();
    await controller.requestPermission();
    expect(controller.snapshot.state).toBe("ready");
    expect(await controller.listDevices()).toHaveLength(1);
  });

  it.each([
    ["NotAllowedError", "permission-denied"],
    ["AbortError", "permission-dismissed"],
    ["NotFoundError", "device-unavailable"],
  ])("handles permission error %s", async (name, expected) => {
    const error = new Error(name);
    error.name = name;
    const { controller } = fixture({ permissionError: error });
    await controller.requestPermission();
    expect(controller.snapshot.state).toBe(expected);
  });

  it("reports unavailable when permission returns no audio track", async () => {
    const { controller } = fixture({ noAudioTrack: true });
    await controller.requestPermission();
    expect(controller.snapshot.state).toBe("device-unavailable");
  });

  it("protects duplicate start and stop", async () => {
    const { controller, recorder } = fixture();
    await controller.requestPermission();
    controller.start();
    controller.start();
    const first = controller.stop();
    const second = controller.stop();
    await Promise.all([first, second]);
    expect(recorder.start).toHaveBeenCalledTimes(1);
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(controller.snapshot.state).toBe("reviewing");
  });

  it("supports pause and resume", async () => {
    const { controller, recorder } = fixture();
    await controller.requestPermission();
    controller.start();
    controller.pause();
    expect(controller.snapshot.state).toBe("paused");
    controller.resume();
    expect(controller.snapshot.state).toBe("recording");
    expect(recorder.pause).toHaveBeenCalledOnce();
    expect(recorder.resume).toHaveBeenCalledOnce();
    controller.cleanup();
  });

  it("does not save empty audio", async () => {
    const { controller } = fixture({ empty: true });
    await controller.requestPermission();
    controller.start();
    await controller.stop();
    await controller.saveLocal();
    expect(controller.snapshot.hasLocalRecording).toBe(false);
  });

  it("saves local-only without claiming upload", async () => {
    const { controller } = fixture();
    await controller.requestPermission();
    controller.start();
    await controller.stop();
    await controller.saveLocal();
    expect(controller.snapshot.state).toBe("local-only");
    expect(controller.localReference?.id).toMatch(/^local-/);
    expect(controller.snapshot.message).toContain("没有上传");
  });

  it("deletes the local recording and revokes preview URL", async () => {
    const { controller, revoke } = fixture();
    await controller.requestPermission();
    controller.start();
    await controller.stop();
    await controller.saveLocal();
    await controller.deleteLocal();
    expect(controller.snapshot.hasLocalRecording).toBe(false);
    expect(controller.localReference).toBeNull();
    expect(revoke).toHaveBeenCalledWith("blob:local-preview");
  });

  it("stops tracks and recorder during cleanup", async () => {
    const { controller, recorder, stopTrack } = fixture();
    await controller.requestPermission();
    controller.cleanup();
    expect(recorder.cleanup).toHaveBeenCalledOnce();
    expect(stopTrack).toHaveBeenCalled();
  });

  it("moves to error if a device disconnects while recording", async () => {
    const { controller } = fixture();
    await controller.requestPermission();
    controller.start();
    controller.handleDeviceInterrupted();
    expect(controller.snapshot.state).toBe("error");
  });

  it("pauses when the page becomes hidden", async () => {
    const { controller } = fixture();
    await controller.requestPermission();
    controller.start();
    controller.handlePageHidden();
    expect(controller.snapshot.state).toBe("paused");
    controller.cleanup();
  });

  it("stops automatically at the maximum duration", async () => {
    vi.useFakeTimers();
    const { controller, recorder, setTime } = fixture({
      maximumDurationMs: 500,
    });
    await controller.requestPermission();
    controller.start();
    setTime(1600);
    await vi.advanceTimersByTimeAsync(500);
    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(controller.snapshot.state).toBe("reviewing");
    vi.useRealTimers();
  });
});
