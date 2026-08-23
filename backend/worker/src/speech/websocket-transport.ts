export interface SpeechWebSocketMessageEvent {
  data: unknown;
}

export interface SpeechWebSocket {
  addEventListener(
    type: "open" | "message" | "error" | "close",
    listener: (event: SpeechWebSocketMessageEvent) => void,
  ): void;
  send(data: string | Uint8Array): void;
  close(code?: number): void;
}

export type SpeechWebSocketFactory = (url: string) => SpeechWebSocket;

/** Uses Node 24's built-in WebSocket without putting a browser client in the app. */
export const defaultSpeechWebSocketFactory: SpeechWebSocketFactory = (url) => {
  const WebSocketConstructor = (globalThis as unknown as {
    WebSocket?: new (url: string) => SpeechWebSocket;
  }).WebSocket;
  if (!WebSocketConstructor) {
    throw new Error("WebSocket is unavailable in the Worker runtime");
  }
  return new WebSocketConstructor(url);
};

export function messageText(data: unknown): string | null {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (ArrayBuffer.isView(data)) return new TextDecoder().decode(data);
  return null;
}

export function messageBytes(data: unknown): Uint8Array | null {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return null;
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => void,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onTimeout();
      reject(new Error(`speech provider timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

export async function sendAudioFrames(
  socket: SpeechWebSocket,
  audio: Uint8Array,
  onFrame: (frame: Uint8Array, index: number, total: number) => string | Uint8Array,
  frameSize = 1280,
  intervalMs = 0,
): Promise<void> {
  if (audio.byteLength === 0) throw new Error("audio is empty");
  const total = Math.ceil(audio.byteLength / frameSize);
  for (let index = 0; index < total; index += 1) {
    const start = index * frameSize;
    const frame = audio.slice(start, Math.min(start + frameSize, audio.byteLength));
    socket.send(onFrame(frame, index, total));
    if (intervalMs > 0 && index < total - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}
