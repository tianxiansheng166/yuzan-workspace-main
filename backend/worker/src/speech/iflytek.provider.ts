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

export interface IflytekCredentials {
  appId: string;
  apiKey: string;
  apiSecret: string;
}

export interface IflytekAuthOptions {
  endpoint?: string;
  now?: () => Date;
}

export class IflytekProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly reasonCode: string,
  ) {
    super(message);
    this.name = "IflytekProviderError";
  }
}

function envCredentials(): IflytekCredentials {
  return {
    appId: process.env.IFLYTEK_ISE_APP_ID?.trim() ?? "",
    apiKey: process.env.IFLYTEK_ISE_API_KEY?.trim() ?? "",
    apiSecret: process.env.IFLYTEK_ISE_API_SECRET?.trim() ?? "",
  };
}

export function hasIflytekCredentials(credentials = envCredentials()): boolean {
  return Boolean(credentials.appId && credentials.apiKey && credentials.apiSecret);
}

/** Pure, deterministic implementation of the official streaming auth URL. */
export function buildIflytekAuthUrl(
  credentials: IflytekCredentials,
  options: IflytekAuthOptions = {},
): string {
  const endpoint = options.endpoint ?? "wss://ise-api.xfyun.cn/v2/open-ise";
  const parsed = new URL(endpoint);
  const date = (options.now ?? (() => new Date()))().toUTCString();
  const requestLine = `GET ${parsed.pathname || "/"} HTTP/1.1`;
  const signatureOrigin = `host: ${parsed.host}\ndate: ${date}\n${requestLine}`;
  const signature = createHmac("sha256", credentials.apiSecret)
    .update(signatureOrigin, "utf8")
    .digest("base64");
  const authorizationOrigin =
    `api_key="${credentials.apiKey}", algorithm="hmac-sha256", ` +
    `headers="host date request-line", signature="${signature}"`;
  const auth = Buffer.from(authorizationOrigin, "utf8").toString("base64");
  const query = new URLSearchParams({
    authorization: auth,
    host: parsed.host,
    date,
  });
  return `${parsed.origin}${parsed.pathname}?${query.toString()}`;
}

function numberField(xml: string, field: string): number | null {
  const patterns = [
    new RegExp(`(?:${field}|${field.replace("_", " ")})\\s*(?:=|value=)\\s*["']?(-?\\d+(?:\\.\\d+)?)["']?`, "i"),
    new RegExp(`<${field}[^>]*value=["'](-?\\d+(?:\\.\\d+)?)["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(xml);
    if (match?.[1] !== undefined) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function boundedOrNull(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new SpeechProviderResponseError("讯飞评分字段超出 0-100 范围");
  }
  return value;
}

function firstNode(xml: string): string {
  const match = /<(read_sentence|read_chapter)\b[^>]*>[\s\S]*?<\/\1>/i.exec(xml);
  return match?.[0] ?? xml;
}

/** Parse the official XML fields returned by the streaming ISE API. */
export function parseIflytekXml(
  xml: string,
  options: { requestId?: string; responseCount?: number } = {},
): SpeechProviderResult {
  if (typeof xml !== "string" || xml.trim().length === 0) {
    throw new SpeechProviderResponseError("讯飞响应 XML 为空");
  }
  const node = firstNode(xml);
  const overall = boundedOrNull(numberField(node, "total_score"));
  const phone = boundedOrNull(numberField(node, "phone_score"));
  // For read_sentence responses, phone_score is the pronunciation-accuracy
  // metric. Some otherwise valid ISE payloads carry accuracy_score=0 while
  // supplying a non-zero phone_score and strong overall/fluency scores.
  // Prefer the dedicated phoneme score rather than presenting that sentinel
  // zero as the learner's pronunciation accuracy.
  const accuracy = phone ?? boundedOrNull(numberField(node, "accuracy_score"));
  const completeness = boundedOrNull(numberField(node, "integrity_score"));
  const fluency = boundedOrNull(numberField(node, "fluency_score"));
  const tone = boundedOrNull(numberField(node, "tone_score"));
  if (overall === null && accuracy === null && fluency === null && phone === null) {
    throw new SpeechProviderResponseError("讯飞响应缺少 read_sentence 可用评分字段");
  }

  const reasonCodes = ["IFLYTEK_UNCALIBRATED", "PROVIDER_REQUIRES_REVIEW"];
  if (tone === null) reasonCodes.push("TONE_NOT_PROVIDED");
  if (completeness === null) reasonCodes.push("COMPLETENESS_NOT_PROVIDED");
  return {
    provider: "iflytek",
    strategy: "SPEECH_READING",
    providerModel: "iflytek-ise-streaming-v2",
    scorerVersion: "iflytek-ise-streaming-v2",
    confidence: overall === null ? 0 : overall / 100,
    scores: { accuracy, completeness, fluency, tone, overall },
    requiresReview: true,
    experimental: true,
    productionCapable: true,
    calibrationStatus: "UNCALIBRATED",
    finalizable: false,
    reasonCodes,
    errors: [],
    providerRawScale: {
      scale: "0-100",
      sourceFields: {
        accuracy: "phone_score or accuracy_score",
        completeness: "integrity_score",
        fluency: "fluency_score",
        tone: "tone_score",
        overall: "total_score",
      },
    },
    ...(options.requestId
      ? {
          providerAudit: {
            requestId: options.requestId,
            responseCount: options.responseCount ?? 1,
            rawResponse: xml,
          },
        }
      : {}),
  };
}

function parseIflytekFrame(value: unknown): { code: number; message?: string; data?: { status?: number; data?: string } } {
  if (typeof value !== "string") throw new SpeechProviderResponseError("讯飞响应不是 JSON 文本");
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new SpeechProviderResponseError("讯飞响应 JSON 格式错误");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new SpeechProviderResponseError("讯飞响应对象格式错误");
  }
  const frame = parsed as Record<string, unknown>;
  if (typeof frame.code !== "number") throw new SpeechProviderResponseError("讯飞响应缺少 code");
  const data = typeof frame.data === "object" && frame.data !== null && !Array.isArray(frame.data)
    ? frame.data as Record<string, unknown>
    : undefined;
  return {
    code: frame.code,
    ...(typeof frame.message === "string" ? { message: frame.message } : {}),
    ...(data
      ? {
          data: {
            ...(typeof data.status === "number" ? { status: data.status } : {}),
            ...(typeof data.data === "string" ? { data: data.data } : {}),
          },
        }
      : {}),
  };
}

function businessFrame(targetText: string, command: "ssb" | "auw", aus?: number) {
  return {
    business: {
      sub: "ise",
      ent: "cn_vip",
      category: "read_sentence",
      cmd: command,
      text: `\uFEFF${targetText}`,
      tte: "utf-8",
      ttp_skip: true,
      aue: "raw",
      auf: "audio/L16;rate=16000",
      rst: "entirety",
      ise_unite: "1",
      extra_ability: "multi_dimension",
      group: "adult",
      check_type: "common",
      ...(aus !== undefined ? { aus } : {}),
    },
  };
}

export function buildIflytekInitialFrame(appId: string, targetText: string): string {
  return JSON.stringify({
    ...businessFrame(targetText, "ssb"),
    common: { app_id: appId },
    data: { status: 0 },
  });
}

export function buildIflytekAudioFrame(
  targetText: string,
  frame: Uint8Array,
  index: number,
  total: number,
): string {
  const aus = total === 1 || index === total - 1 ? 4 : index === 0 ? 1 : 2;
  const status = aus === 4 ? 2 : 1;
  return JSON.stringify({
    ...businessFrame(targetText, "auw", aus),
    data: { status, data: Buffer.from(frame).toString("base64") },
  });
}

export class IflytekSpeechReadingProvider implements SpeechReadingProvider {
  readonly name = "iflytek" as const;
  readonly productionCapable = true as const;
  private readonly credentials: IflytekCredentials;
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly frameIntervalMs: number;
  private readonly maxRetries: number;
  private readonly webSocketFactory: SpeechWebSocketFactory;
  private readonly now: () => Date;

  constructor(options: {
    credentials?: IflytekCredentials;
    endpoint?: string;
    timeoutMs?: number;
    frameIntervalMs?: number;
    maxRetries?: number;
    webSocketFactory?: SpeechWebSocketFactory;
    now?: () => Date;
  } = {}) {
    this.credentials = options.credentials ?? envCredentials();
    this.endpoint = options.endpoint ?? "wss://ise-api.xfyun.cn/v2/open-ise";
    // The ISE endpoint receives real-time 40 ms frames. A 30-second recording
    // cannot complete under a 30-second end-to-end deadline once connection
    // and final-result time are included.
    this.timeoutMs = options.timeoutMs ?? Number(process.env.IFLYTEK_ISE_TIMEOUT_MS ?? 60_000);
    this.frameIntervalMs = options.frameIntervalMs ?? Number(process.env.IFLYTEK_ISE_FRAME_INTERVAL_MS ?? 40);
    this.maxRetries = options.maxRetries ?? Number(process.env.IFLYTEK_ISE_MAX_RETRIES ?? 1);
    this.webSocketFactory = options.webSocketFactory ?? defaultSpeechWebSocketFactory;
    this.now = options.now ?? (() => new Date());
  }

  configured(): boolean { return hasIflytekCredentials(this.credentials); }

  async scoreReading(input: SpeechReadingInput): Promise<SpeechProviderResult> {
    if (!this.configured()) throw new SpeechProviderConfigurationError("IFLYTEK_ISE credentials are not configured");
    if (input.language !== "zh-CN") throw new IflytekProviderError("讯飞 adapter only supports zh-CN in QB-009A", false, "LANGUAGE_UNSUPPORTED");
    if (!input.targetText.trim()) throw new IflytekProviderError("讯飞评测缺少服务端 reference text", false, "INVALID_REFERENCE");
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        return await this.scoreOnce(input);
      } catch (error) {
        lastError = error;
        if (!(error instanceof IflytekProviderError) || !error.retryable || attempt >= this.maxRetries) throw error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("讯飞评测失败");
  }

  private async scoreOnce(input: SpeechReadingInput): Promise<SpeechProviderResult> {
    const requestId = input.requestId;
    const url = buildIflytekAuthUrl(this.credentials, { endpoint: this.endpoint, now: this.now });
    let socket: SpeechWebSocket | undefined;
    const responseXml: string[] = [];
    let responseCount = 0;
    const result = withTimeout(
      new Promise<SpeechProviderResult>((resolve, reject) => {
        try { socket = this.webSocketFactory(url); } catch (error) {
          reject(new IflytekProviderError(`讯飞 WebSocket 创建失败: ${error instanceof Error ? error.message : String(error)}`, true, "PROVIDER_TRANSPORT_ERROR"));
          return;
        }
        const ws = socket;
        const finish = () => {
          try {
            const parsed = parseIflytekXml(responseXml.join("\n"), { requestId, responseCount });
            resolve(parsed);
          } catch (error) { reject(error); }
          try { ws.close(1000); } catch { /* best effort */ }
        };
        ws.addEventListener("open", () => {
          void (async () => {
            try {
              ws.send(buildIflytekInitialFrame(this.credentials.appId, input.targetText));
              await sendAudioFrames(
                ws,
                input.audio,
                (frame, index, total) => buildIflytekAudioFrame(input.targetText, frame, index, total),
                1280,
                this.frameIntervalMs,
              );
            } catch (error) {
              reject(new IflytekProviderError(`讯飞音频发送失败: ${error instanceof Error ? error.message : String(error)}`, true, "PROVIDER_TRANSPORT_ERROR"));
            }
          })();
        });
        ws.addEventListener("message", (event) => {
          const text = messageText(event.data);
          if (!text) { reject(new SpeechProviderResponseError("讯飞响应必须是 TextMessage")); return; }
          responseCount += 1;
          try {
            const frame = parseIflytekFrame(text);
            if (frame.code !== 0) {
              const authFailure = frame.code === 10101 || frame.code === 10102 || frame.code === 10106;
              reject(new IflytekProviderError(`讯飞 provider error ${frame.code}`, !authFailure && frame.code !== 10163, authFailure ? "PROVIDER_AUTH_FAILED" : "PROVIDER_ERROR"));
              return;
            }
            if (frame.data?.data) responseXml.push(Buffer.from(frame.data.data, "base64").toString("utf8"));
            if (frame.data?.status === 2) finish();
          } catch (error) { reject(error); }
        });
        ws.addEventListener("error", () => reject(new IflytekProviderError("讯飞 WebSocket error", true, "PROVIDER_TRANSPORT_ERROR")));
        ws.addEventListener("close", () => {
          if (responseXml.length > 0) finish();
          else reject(new IflytekProviderError("讯飞 WebSocket closed before final result", true, "PROVIDER_TRANSPORT_ERROR"));
        });
      }),
      this.timeoutMs,
      () => { try { socket?.close(1000); } catch { /* best effort */ } },
    );
    try { return await result; } catch (error) {
      if (error instanceof IflytekProviderError) throw error;
      if (error instanceof SpeechProviderResponseError) throw error;
      throw new IflytekProviderError(error instanceof Error ? error.message : String(error), true, "PROVIDER_TRANSPORT_ERROR");
    }
  }
}
