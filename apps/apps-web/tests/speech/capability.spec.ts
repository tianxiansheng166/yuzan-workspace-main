import { describe, expect, it } from "vitest";
import {
  createBrowserSpeechCapability,
  classifyPermissionError,
} from "../../app/features/speech/capabilities/browser-speech-capability";

describe("speech capability", () => {
  it("is safe to import and inspect during SSR", () => {
    expect(createBrowserSpeechCapability({}).inspect().supported).toBe(false);
  });

  it("rejects an insecure context", () => {
    const result = createBrowserSpeechCapability({
      isSecureContext: false,
      MediaRecorder: class {} as typeof MediaRecorder,
      mediaDevices: {} as MediaDevices,
    }).inspect();
    expect(result.supported).toBe(false);
    expect(result.reason).toContain("安全连接");
  });

  it("reports unsupported without MediaRecorder", () => {
    const result = createBrowserSpeechCapability({
      isSecureContext: true,
      mediaDevices: {
        getUserMedia: async () => ({}) as MediaStream,
      } as MediaDevices,
    }).inspect();
    expect(result.mediaRecorder).toBe(false);
  });

  it("requests audio only after explicit permission action", async () => {
    let constraints: MediaStreamConstraints | undefined;
    const stream = {} as MediaStream;
    const capability = createBrowserSpeechCapability({
      isSecureContext: true,
      MediaRecorder: class {} as typeof MediaRecorder,
      mediaDevices: {
        getUserMedia: async (value) => ((constraints = value), stream),
        enumerateDevices: async () => [],
      },
    });
    expect(await capability.requestPermission()).toBe(stream);
    expect(constraints).toEqual({ audio: true, video: false });
  });

  it("lists only input devices", async () => {
    const capability = createBrowserSpeechCapability({
      mediaDevices: {
        getUserMedia: async () => ({}) as MediaStream,
        enumerateDevices: async () =>
          [
            { kind: "audioinput", deviceId: "mic", label: "内置麦克风" },
            { kind: "audiooutput", deviceId: "speaker", label: "扬声器" },
          ] as MediaDeviceInfo[],
      },
    });
    expect(await capability.listInputDevices()).toEqual([
      { deviceId: "mic", label: "内置麦克风" },
    ]);
  });

  it.each([
    ["NotAllowedError", "permission-denied"],
    ["AbortError", "permission-dismissed"],
    ["NotFoundError", "device-unavailable"],
  ])("classifies %s", (name, expected) => {
    const error = new Error(name);
    error.name = name;
    expect(classifyPermissionError(error)).toBe(expected);
  });
});
