import type { RecordedAudio, RecorderAdapter } from "../types";

interface RecorderEnvironment {
  createRecorder(stream: MediaStream): MediaRecorder;
  now(): number;
}

function defaultEnvironment(): RecorderEnvironment {
  return {
    createRecorder: (stream) => new MediaRecorder(stream),
    now: () => Date.now(),
  };
}

export function createBrowserRecorderAdapter(
  environment: RecorderEnvironment = defaultEnvironment(),
): RecorderAdapter {
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let chunks: Blob[] = [];
  let startedAt = 0;
  let pausedAt = 0;
  let pausedDuration = 0;

  return {
    start(nextStream) {
      if (recorder?.state === "recording" || recorder?.state === "paused")
        return;
      stream = nextStream;
      recorder = environment.createRecorder(nextStream);
      chunks = [];
      pausedDuration = 0;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      startedAt = environment.now();
      recorder.start();
    },
    pause() {
      if (recorder?.state !== "recording") return;
      pausedAt = environment.now();
      recorder.pause();
    },
    resume() {
      if (recorder?.state !== "paused") return;
      pausedDuration += environment.now() - pausedAt;
      recorder.resume();
    },
    async stop() {
      if (!recorder || recorder.state === "inactive")
        throw new Error("empty-recording");
      const activeRecorder = recorder;
      return new Promise<RecordedAudio>((resolve, reject) => {
        activeRecorder.onerror = () => reject(new Error("recording-failed"));
        activeRecorder.onstop = () => {
          const mimeType = activeRecorder.mimeType || "audio/webm";
          const blob = new Blob(chunks, { type: mimeType });
          resolve({
            blob,
            mimeType,
            size: blob.size,
            durationMs: Math.max(
              0,
              environment.now() - startedAt - pausedDuration,
            ),
          });
        };
        activeRecorder.stop();
      });
    },
    cleanup() {
      if (recorder && recorder.state !== "inactive") recorder.stop();
      stream?.getTracks().forEach((track) => track.stop());
      recorder = null;
      stream = null;
      chunks = [];
    },
  };
}
