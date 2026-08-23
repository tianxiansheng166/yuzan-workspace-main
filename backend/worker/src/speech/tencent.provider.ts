import { createHmac } from "node:crypto";
import {
  SpeechProviderConfigurationError,
  SpeechProviderResponseError,
  type SpeechProviderResult,
  type SpeechReadingInput,
  type SpeechReadingProvider,
} from "./speech-provider.js";
import {
  defaultSpeechWebSocketFactory,
  messageText,
  sendAudioFrames,
  withTimeout,
  type SpeechWebSocket,
  type SpeechWebSocketFactory,
} from "./websocket-transport.js";

export interface TencentCredentials {
  appId: string;
  secretId: string;
  secretKey: string;
}

export interface TencentSigningOptions {
  timestamp: number;
  expired: number;
  nonce: number;
  voiceId: string;
  refText: string;
  appId: string;
  secretId: string;
}

export class TencentProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly reasonCode: string,
  ) {
    super(message);
    this.name = "TencentProviderError";
  }
}

function envCredentials(): TencentCredentials {
  return {
    appId: process.env.TENCENT_SOE_APP_ID?.trim() ?? "",
    secretId: process.env.TENCENT_SOE_SECRET_ID?.trim() ?? "",
    secretKey: process.env.TENCENT_SOE_SECRET_KEY?.trim() ?? "",
  };
}

export function hasTencentCredentials(credentials = envCredentials()): boolean {
  return Boolean(credentials.appId && credentials.secretId && credentials.secretKey);
}

function sortedParams(options: TencentSigningOptions): Record<string, string> {
  return {
    eval_mode: "1",
    expired: String(options.expired),
    nonce: String(options.nonce),
    ref_text: options.refText,
    score_coeff: "1.0",
    secretid: options.secretId,
    sentence_info_enabled: "1",
    server_engine_type: "16k_zh",
    text_mode: "0",
    timestamp: String(options.timestamp),
    voice_format: "0",
    voice_id: options.voiceId,
  };
}

/** Pure implementation of the official SOE-new HMAC-SHA1 URL signature. */
export function buildTencentSoeAuthUrl(
  credentials: TencentCredentials,
  options: TencentSigningOptions,
  endpoint = "wss://soe.cloud.tencent.com/soe/api",
): string {
  if (options.expired <= options.timestamp || options.expired - options.timestamp >= 90 * 24 * 60 * 60) {
    throw new Error("Tencent SOE signature expiration must be within 90 days");
  }
  const host = new URL(endpoint).host;
  const path = `/soe/api/${options.appId}`;
  const params = sortedParams(options);
  const query = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join("&");
  const signText = `${host}${path}?${query}`;
  const signature = createHmac("sha1", credentials.secretKey).update(signText, "utf8").digest("base64");
  const finalParams = new URLSearchParams({ ...params, signature });
  return `wss://${host}${path}?${finalParams.toString()}`;
}

function metric(value: number | null, unit: "fraction" | "percent" = "percent"): number | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  const normalized = unit === "fraction" || value <= 1 ? value * 100 : value;
  return normalized >= 0 && normalized <= 100 ? normalized : null;
}

function field(result: string, name: string): number | null {
  const match = new RegExp(`\\b${name}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`, "i").exec(result);
  if (!match?.[1]) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Parse only fields documented by Tencent's new SOE SentenceInfo result. */
export function parseTencentSoeResult(
  result: string,
  options: { requestId?: string; responseCount?: number } = {},
): SpeechProviderResult {
  if (typeof result !== "string" || result.trim().length === 0) {
    throw new SpeechProviderResponseError("腾讯 SOE result 为空");
  }
  const rawAccuracy = field(result, "PronAccuracy");
  const rawFluency = field(result, "PronFluency");
  const rawCompleteness = field(result, "PronCompletion");
  const rawOverall = field(result, "SuggestedScore");
  const accuracy = metric(rawAccuracy);
  const fluency = metric(rawFluency, "fraction");
  const completeness = metric(rawCompleteness, "fraction");
  const overall = metric(rawOverall);
  if (accuracy === null && fluency === null && completeness === null && overall === null) {
    throw new SpeechProviderResponseError("腾讯 SOE result 缺少可用 Pron/SuggestedScore 字段");
  }
  const reasonCodes = ["TENCENT_UNCALIBRATED", "PROVIDER_REQUIRES_REVIEW"];
  reasonCodes.push("TONE_NOT_PROVIDED");
  if (overall === null) reasonCodes.push("OVERALL_NOT_PROVIDED");
  if (accuracy === null) reasonCodes.push("PRONUNCIATION_NOT_PROVIDED");
  if (fluency === null) reasonCodes.push("FLUENCY_NOT_PROVIDED");
  if (completeness === null) reasonCodes.push("COMPLETENESS_NOT_PROVIDED");
  return {
    provider: "tencent",
    strategy: "SPEECH_READING",
    providerModel: "tencent-soe-new-16k_zh",
    scorerVersion: "tencent-soe-new-16k_zh",
    confidence: overall === null ? 0 : overall / 100,
    scores: { accuracy, completeness, fluency, tone: null, overall },
    requiresReview: true,
    experimental: true,
    productionCapable: true,
    calibrationStatus: "UNCALIBRATED",
    finalizable: false,
    reasonCodes,
    errors: [],
    providerRawScale: {
      scale: "PronAccuracy/PronCompletion/SuggestedScore provider values; PronFluency fraction",
      sourceFields: {
        accuracy: "PronAccuracy",
        completeness: "PronCompletion",
        fluency: "PronFluency",
        tone: null,
        overall: "SuggestedScore",
      },
    },
    ...(options.requestId
      ? {
          providerAudit: {
            requestId: options.requestId,
            responseCount: options.responseCount ?? 1,
            rawResponse: result,
          },
        }
      : {}),
  };
}

function parseFrame(value: string): { code: number; message?: string; final?: number; result?: string } {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new SpeechProviderResponseError("腾讯 SOE 响应 JSON 格式错误"); }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new SpeechProviderResponseError("腾讯 SOE 响应对象格式错误");
  }
  const frame = parsed as Record<string, unknown>;
  if (typeof frame.code !== "number") throw new SpeechProviderResponseError("腾讯 SOE 响应缺少 code");
  return {
    code: frame.code,
    ...(typeof frame.message === "string" ? { message: frame.message } : {}),
    ...(typeof frame.final === "number" ? { final: frame.final } : {}),
    ...(typeof frame.result === "string" ? { result: frame.result } : {}),
  };
}

export class TencentSoeSpeechReadingProvider implements SpeechReadingProvider {
  readonly name = "tencent" as const;
  readonly productionCapable = true as const;
  private readonly credentials: TencentCredentials;
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly frameIntervalMs: number;
  private readonly maxRetries: number;
  private readonly webSocketFactory: SpeechWebSocketFactory;
  private readonly now: () => number;
  private readonly nonce: () => number;

  constructor(options: {
    credentials?: TencentCredentials;
    endpoint?: string;
    timeoutMs?: number;
    frameIntervalMs?: number;
    maxRetries?: number;
    webSocketFactory?: SpeechWebSocketFactory;
    now?: () => number;
    nonce?: () => number;
  } = {}) {
    this.credentials = options.credentials ?? envCredentials();
    this.endpoint = options.endpoint ?? "wss://soe.cloud.tencent.com/soe/api";
    this.timeoutMs = options.timeoutMs ?? Number(process.env.TENCENT_SOE_TIMEOUT_MS ?? 30_000);
    this.frameIntervalMs = options.frameIntervalMs ?? Number(process.env.TENCENT_SOE_FRAME_INTERVAL_MS ?? 40);
    this.maxRetries = options.maxRetries ?? Number(process.env.TENCENT_SOE_MAX_RETRIES ?? 1);
    this.webSocketFactory = options.webSocketFactory ?? defaultSpeechWebSocketFactory;
    this.now = options.now ?? (() => Math.floor(Date.now() / 1000));
    this.nonce = options.nonce ?? (() => Math.floor(Math.random() * 900_000_000) + 1);
  }

  configured(): boolean { return hasTencentCredentials(this.credentials); }

  async scoreReading(input: SpeechReadingInput): Promise<SpeechProviderResult> {
    if (!this.configured()) throw new SpeechProviderConfigurationError("TENCENT_SOE credentials are not configured");
    if (input.language !== "zh-CN") throw new TencentProviderError("腾讯 SOE adapter only supports zh-CN in QB-009A", false, "LANGUAGE_UNSUPPORTED");
    if (!input.targetText.trim()) throw new TencentProviderError("腾讯评测缺少服务端 reference text", false, "INVALID_REFERENCE");
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try { return await this.scoreOnce(input); } catch (error) {
        lastError = error;
        if (!(error instanceof TencentProviderError) || !error.retryable || attempt >= this.maxRetries) throw error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("腾讯 SOE 评测失败");
  }

  private async scoreOnce(input: SpeechReadingInput): Promise<SpeechProviderResult> {
    const timestamp = this.now();
    const url = buildTencentSoeAuthUrl(this.credentials, {
      timestamp,
      expired: timestamp + 300,
      nonce: this.nonce(),
      voiceId: input.requestId,
      refText: input.targetText,
      appId: this.credentials.appId,
      secretId: this.credentials.secretId,
    }, this.endpoint);
    let socket: SpeechWebSocket | undefined;
    const responseResults: string[] = [];
    let responseCount = 0;
    const result = withTimeout(
      new Promise<SpeechProviderResult>((resolve, reject) => {
        try { socket = this.webSocketFactory(url); } catch (error) {
          reject(new TencentProviderError(`腾讯 WebSocket 创建失败: ${error instanceof Error ? error.message : String(error)}`, true, "PROVIDER_TRANSPORT_ERROR"));
          return;
        }
        const ws = socket;
        let handshakeComplete = false;
        let sentAudio = false;
        const sendAudio = async () => {
          if (sentAudio) return;
          sentAudio = true;
          await sendAudioFrames(ws, input.audio, (frame) => frame, 1280, this.frameIntervalMs);
          ws.send(JSON.stringify({ type: "end" }));
        };
        ws.addEventListener("open", () => { /* handshake is URL-authenticated */ });
        ws.addEventListener("message", (event) => {
          const text = messageText(event.data);
          if (!text) { reject(new SpeechProviderResponseError("腾讯 SOE 响应必须是 TextMessage")); return; }
          responseCount += 1;
          try {
            const frame = parseFrame(text);
            if (frame.code !== 0) {
              const retryable = frame.code === 4009 || frame.code === 4008;
              const auth = frame.code === 4002;
              reject(new TencentProviderError(`腾讯 SOE provider error ${frame.code}`, retryable, auth ? "PROVIDER_AUTH_FAILED" : "PROVIDER_ERROR"));
              return;
            }
            if (!handshakeComplete) {
              handshakeComplete = true;
              void sendAudio().catch((error) => reject(new TencentProviderError(`腾讯音频发送失败: ${error instanceof Error ? error.message : String(error)}`, true, "PROVIDER_TRANSPORT_ERROR")));
            }
            if (frame.result) responseResults.push(frame.result);
            if (frame.final === 1) {
              if (responseResults.length === 0) reject(new SpeechProviderResponseError("腾讯 SOE final response has no result"));
              else resolve(parseTencentSoeResult(responseResults[responseResults.length - 1]!, { requestId: input.requestId, responseCount }));
              try { ws.close(1000); } catch { /* best effort */ }
            }
          } catch (error) { reject(error); }
        });
        ws.addEventListener("error", () => reject(new TencentProviderError("腾讯 WebSocket error", true, "PROVIDER_TRANSPORT_ERROR")));
        ws.addEventListener("close", () => {
          if (!responseResults.length) reject(new TencentProviderError("腾讯 WebSocket closed before final result", true, "PROVIDER_TRANSPORT_ERROR"));
        });
      }),
      this.timeoutMs,
      () => { try { socket?.close(1000); } catch { /* best effort */ } },
    );
    try { return await result; } catch (error) {
      if (error instanceof TencentProviderError || error instanceof SpeechProviderResponseError) throw error;
      throw new TencentProviderError(error instanceof Error ? error.message : String(error), true, "PROVIDER_TRANSPORT_ERROR");
    }
  }
}
