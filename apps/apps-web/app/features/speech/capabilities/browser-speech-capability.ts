import type { SpeechCapability } from "../types";

export interface SpeechBrowserEnvironment {
  isSecureContext?: boolean;
  MediaRecorder?: typeof MediaRecorder;
  mediaDevices?: Pick<MediaDevices, "getUserMedia" | "enumerateDevices">;
}

function browserEnvironment(): SpeechBrowserEnvironment {
  if (typeof window === "undefined" || typeof navigator === "undefined")
    return {};
  return {
    isSecureContext: window.isSecureContext,
    MediaRecorder: window.MediaRecorder,
    mediaDevices: navigator.mediaDevices,
  };
}

export function createBrowserSpeechCapability(
  environment?: SpeechBrowserEnvironment,
): SpeechCapability {
  const getEnvironment = () => environment ?? browserEnvironment();
  return {
    inspect() {
      const env = getEnvironment();
      const secureContext = env.isSecureContext === true;
      const mediaRecorder = typeof env.MediaRecorder === "function";
      const getUserMedia = typeof env.mediaDevices?.getUserMedia === "function";
      return {
        supported: secureContext && mediaRecorder && getUserMedia,
        secureContext,
        mediaRecorder,
        getUserMedia,
        reason: !secureContext
          ? "录音需要安全连接。"
          : !mediaRecorder || !getUserMedia
            ? "当前浏览器不支持本地录音。"
            : undefined,
      };
    },
    async requestPermission(deviceId) {
      const mediaDevices = getEnvironment().mediaDevices;
      if (!mediaDevices) throw new Error("device-unavailable");
      return mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        video: false,
      });
    },
    async listInputDevices() {
      const mediaDevices = getEnvironment().mediaDevices;
      if (!mediaDevices) return [];
      const devices = await mediaDevices.enumerateDevices();
      return devices
        .filter((device) => device.kind === "audioinput")
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `麦克风 ${index + 1}`,
        }));
    },
  };
}

export function classifyPermissionError(error: unknown) {
  if (!(error instanceof Error)) return "permission-dismissed" as const;
  if (error.name === "NotAllowedError") return "permission-denied" as const;
  if (error.name === "NotFoundError" || error.name === "OverconstrainedError") {
    return "device-unavailable" as const;
  }
  if (error.name === "AbortError") return "permission-dismissed" as const;
  return "error" as const;
}
