import { classifyPermissionError } from "../capabilities/browser-speech-capability";
import { inspectLocalQuality } from "../quality/local-quality-inspector";
import {
  initialRecordingSnapshot,
  transitionRecording,
} from "../state/recording-machine";
import type {
  LocalRecordingStore,
  RecorderAdapter,
  RecordingController,
  RecordingEvent,
  RecordingSnapshot,
  SpeechCapability,
} from "../types";

export interface RecordingControllerOptions {
  capability: SpeechCapability;
  recorder: RecorderAdapter;
  store: LocalRecordingStore;
  maximumDurationMs?: number;
  now?: () => number;
  createObjectUrl?: (blob: Blob) => string;
  revokeObjectUrl?: (url: string) => void;
}

export function createRecordingController({
  capability,
  recorder,
  store,
  maximumDurationMs = 120_000,
  now = () => Date.now(),
  createObjectUrl = (blob) => URL.createObjectURL(blob),
  revokeObjectUrl = (url) => URL.revokeObjectURL(url),
}: RecordingControllerOptions): RecordingController {
  let snapshot = initialRecordingSnapshot();
  let stream: MediaStream | null = null;
  let recording: RecordingController["recording"] = null;
  let quality: RecordingController["quality"] = null;
  let localReference: RecordingController["localReference"] = null;
  let previewUrl: string | null = null;
  let startedAt = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const send = (event: RecordingEvent, message: string) => {
    snapshot = transitionRecording(snapshot, event, message);
  };
  const clearTimer = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
  const revokePreview = () => {
    if (previewUrl) revokeObjectUrl(previewUrl);
    previewUrl = null;
  };
  const releaseStream = () => {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
  };
  const clearRecording = () => {
    revokePreview();
    recording = null;
    quality = null;
    localReference = null;
  };

  const controller: RecordingController = {
    get snapshot() {
      return snapshot;
    },
    get recording() {
      return recording;
    },
    get quality() {
      return quality;
    },
    get localReference() {
      return localReference;
    },
    get previewUrl() {
      return previewUrl;
    },
    inspectCapability() {
      const result = capability.inspect();
      if (!result.supported) {
        snapshot = {
          ...snapshot,
          state: "unsupported",
          message: result.reason ?? "录音不可用。",
        };
      }
      return result;
    },
    async requestPermission(deviceId) {
      if (!capability.inspect().supported) {
        snapshot = {
          ...snapshot,
          state: "unsupported",
          message: "当前环境不支持安全录音。",
        };
        return;
      }
      send("REQUEST_PERMISSION", "正在请求麦克风权限。仅用于本次朗读录音。 ");
      try {
        stream = await capability.requestPermission(deviceId);
        if (stream.getAudioTracks().length === 0) {
          send("DEVICE_MISSING", "没有找到可用的麦克风，请检查设备连接。 ");
          releaseStream();
          return;
        }
        send("PERMISSION_GRANTED", "麦克风已就绪，尚未开始录音。 ");
      } catch (error) {
        const kind = classifyPermissionError(error);
        if (kind === "permission-denied") {
          send(
            "PERMISSION_DENIED",
            "麦克风权限未授权。你可以检查浏览器权限后重试。 ",
          );
        } else if (kind === "permission-dismissed") {
          send("PERMISSION_DISMISSED", "权限请求已关闭，麦克风没有启动。 ");
        } else if (kind === "device-unavailable") {
          send("DEVICE_MISSING", "没有找到可用输入设备，请检查连接。 ");
        } else {
          send("FAIL", "麦克风启动失败，可以检查设备后重试。 ");
        }
      }
    },
    listDevices: () => capability.listInputDevices(),
    checkInput() {
      if (snapshot.state !== "ready") return;
      send("CHECK_INPUT", "正在检查输入设备，不会生成发音评分。 ");
      send("INPUT_READY", "输入设备可用，可以开始录音。 ");
    },
    start() {
      if (snapshot.state !== "ready" || !stream) return;
      recorder.start(stream);
      startedAt = now();
      snapshot = {
        ...transitionRecording(
          snapshot,
          "START",
          "正在录音。录音仅保留在当前设备。 ",
        ),
        elapsedMs: 0,
      };
      timer = setInterval(() => {
        if (snapshot.state !== "recording") return;
        const elapsedMs = now() - startedAt;
        snapshot = {
          ...snapshot,
          elapsedMs: Math.min(elapsedMs, maximumDurationMs),
        };
        if (elapsedMs >= maximumDurationMs) void controller.stop();
      }, 250);
    },
    pause() {
      if (snapshot.state !== "recording") return;
      recorder.pause();
      send("PAUSE", "录音已暂停，尚未保存。 ");
    },
    resume() {
      if (snapshot.state !== "paused") return;
      recorder.resume();
      send("RESUME", "录音已继续。 ");
    },
    async stop() {
      if (snapshot.state !== "recording" && snapshot.state !== "paused") return;
      send("STOP", "正在停止录音。 ");
      clearTimer();
      try {
        recording = await recorder.stop();
        quality = inspectLocalQuality(recording);
        revokePreview();
        previewUrl = createObjectUrl(recording.blob);
        send(
          "RECORDED",
          "录音已停止，可本地试听和检查；尚未保存、上传或提交。 ",
        );
      } catch {
        send("FAIL", "录音为空或停止失败，可以重新录制。 ");
      } finally {
        releaseStream();
      }
    },
    async saveLocal() {
      if (snapshot.state !== "reviewing" || !recording || recording.size === 0)
        return;
      const reference = {
        id: `local-${now()}`,
        createdAt: new Date(now()).toISOString(),
        durationMs: recording.durationMs,
        size: recording.size,
        mimeType: recording.mimeType,
        syncState: "local-only" as const,
        blob: recording.blob,
      };
      localReference = await store.save(reference);
      send("SAVE_LOCAL", "已保存为 local-only。没有上传，也没有提交给教师。 ");
    },
    queueSync() {
      if (snapshot.state !== "local-only") return;
      send("QUEUE_SYNC", "已标记为 pending-sync，但当前没有上传服务。 ");
    },
    markUploadUnavailable() {
      if (snapshot.state !== "local-only" && snapshot.state !== "pending-sync")
        return;
      send("UPLOAD_UNAVAILABLE", "上传 unavailable，本地录音仍保留。 ");
    },
    retake() {
      if (
        ![
          "reviewing",
          "local-only",
          "pending-sync",
          "upload-unavailable",
        ].includes(snapshot.state)
      )
        return;
      clearRecording();
      send("RETAKE", "已清除当前试听内容，可以重新申请麦克风并录制。 ");
    },
    async deleteLocal() {
      if (localReference) await store.delete(localReference.id);
      clearRecording();
      send("DELETE", "本地录音已删除，不再显示为已保存。 ");
    },
    handleDeviceInterrupted() {
      if (snapshot.state === "recording" || snapshot.state === "paused") {
        clearTimer();
        recorder.cleanup();
        releaseStream();
        send("DEVICE_MISSING", "录音设备已断开，本次录音没有标记为已保存。 ");
      }
    },
    handlePageHidden() {
      if (snapshot.state === "recording") controller.pause();
    },
    cleanup() {
      clearTimer();
      recorder.cleanup();
      releaseStream();
      revokePreview();
    },
  };
  return controller;
}
