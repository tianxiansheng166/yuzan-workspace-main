import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildIflytekAudioFrame,
  buildIflytekAuthUrl,
  buildIflytekInitialFrame,
  IflytekSpeechReadingProvider,
  parseIflytekXml,
} from "../src/speech/iflytek.provider.js";
import {
  buildTencentSoeAuthUrl,
  parseTencentSoeResult,
  TencentSoeSpeechReadingProvider,
} from "../src/speech/tencent.provider.js";
import type { SpeechWebSocket, SpeechWebSocketMessageEvent } from "../src/speech/websocket-transport.js";

class FakeSocket implements SpeechWebSocket {
  readonly sent: Array<string | Uint8Array> = [];
  readonly listeners = new Map<string, Array<(event: SpeechWebSocketMessageEvent) => void>>();
  closed = false;

  addEventListener(type: "open" | "message" | "error" | "close", listener: (event: SpeechWebSocketMessageEvent) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  send(data: string | Uint8Array): void {
    this.sent.push(data);
  }

  close(): void { this.closed = true; }

  emit(type: "open" | "message" | "error" | "close", data?: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener({ data });
  }
}

const credentials = { appId: "app-test", apiKey: "key-test", apiSecret: "secret-test" };
const tencentCredentials = { appId: "1250000000", secretId: "secret-id-test", secretKey: "secret-key-test" };

describe("production speech provider contracts", () => {
  it("builds deterministic iFlytek HMAC-SHA256 auth without exposing credentials", () => {
    const first = buildIflytekAuthUrl(credentials, {
      endpoint: "wss://ise-api.xfyun.cn/v2/open-ise",
      now: () => new Date("2020-07-10T07:35:43.000Z"),
    });
    const second = buildIflytekAuthUrl(credentials, {
      endpoint: "wss://ise-api.xfyun.cn/v2/open-ise",
      now: () => new Date("2020-07-10T07:35:43.000Z"),
    });
    expect(first).toBe(second);
    expect(first).toMatch(/^wss:\/\/ise-api\.xfyun\.cn\/v2\/open-ise\?/);
    expect(first).not.toContain(credentials.apiSecret);
    expect(new URL(first).searchParams.get("authorization")).toBeTruthy();
  });

  it("uses the official iFlytek ssb/auw frame contract", () => {
    const initial = JSON.parse(buildIflytekInitialFrame("app-test", "春眠不觉晓"));
    const audio = JSON.parse(buildIflytekAudioFrame("春眠不觉晓", new Uint8Array([1, 2]), 0, 1));
    expect(initial).toMatchObject({ common: { app_id: "app-test" }, business: { sub: "ise", ent: "cn_vip", category: "read_sentence", cmd: "ssb", text: "\uFEFF春眠不觉晓" }, data: { status: 0 } });
    expect(audio).toMatchObject({ business: { cmd: "auw", aus: 4 }, data: { status: 2, data: "AQI=" } });
  });

  it("normalizes iFlytek XML fields and preserves missing dimensions as null", () => {
    const result = parseIflytekXml(
      '<xml><read_sentence phone_score="88" fluency_score="91" total_score="87"><word content="春" /></read_sentence></xml>',
      { requestId: "req-1", responseCount: 2 },
    );
    expect(result.provider).toBe("iflytek");
    expect(result.scores).toMatchObject({ accuracy: 88, completeness: null, fluency: 91, tone: null, overall: 87 });
    expect(result.calibrationStatus).toBe("UNCALIBRATED");
    expect(result.finalizable).toBe(false);
    expect(result.providerAudit?.rawResponse).toContain("read_sentence");
    expect(() => parseIflytekXml('<xml><read_sentence phone_score="120" /></xml>')).toThrow(/0-100/);
    expect(() => parseIflytekXml("not xml")).toThrow();
  });

  it("runs the iFlytek WebSocket flow using a fixture server and never marks it finalizable", async () => {
    const socket = new FakeSocket();
    const xml = '<xml><read_sentence phone_score="80" fluency_score="82" total_score="81" /></xml>';
    const provider = new IflytekSpeechReadingProvider({
      credentials,
      frameIntervalMs: 0,
      timeoutMs: 500,
      now: () => new Date("2020-07-10T07:35:43.000Z"),
      webSocketFactory: () => {
        queueMicrotask(() => socket.emit("open"));
        return socket;
      },
    });
    const resultPromise = provider.scoreReading({
      audio: new Uint8Array([1, 2, 3]),
      targetText: "春眠不觉晓",
      language: "zh-CN",
      requestId: "req-iflytek",
    });
    const initial = await new Promise<ReturnType<typeof JSON.parse>>((resolve) => {
      const timer = setInterval(() => {
        const first = socket.sent[0];
        if (typeof first === "string") {
          clearInterval(timer);
          resolve(JSON.parse(first));
        }
      }, 0);
    });
    expect(initial.common.app_id).toBe("app-test");
    socket.emit("message", JSON.stringify({ code: 0, message: "success", data: { status: 2, data: Buffer.from(xml).toString("base64") } }));
    const result = await resultPromise;
    expect(result.provider).toBe("iflytek");
    expect(result.finalizable).toBe(false);
  });

  it("builds the official Tencent SOE-new sorted HMAC-SHA1 signature", () => {
    const options = {
      timestamp: 1722321759,
      expired: 1722408159,
      nonce: 42261112,
      voiceId: "4943511b-192c-40f8-b6c9-c3df2a827b75",
      refText: "hello",
      appId: tencentCredentials.appId,
      secretId: tencentCredentials.secretId,
    };
    const url = buildTencentSoeAuthUrl(tencentCredentials, options);
    const parsed = new URL(url);
    const signature = parsed.searchParams.get("signature");
    expect(parsed.pathname).toBe(`/soe/api/${tencentCredentials.appId}`);
    expect(signature).toBeTruthy();
    expect(url).toBe(buildTencentSoeAuthUrl(tencentCredentials, options));
    expect(signature).not.toContain(tencentCredentials.secretKey);
    const signText = "soe.cloud.tencent.com/soe/api/1250000000?eval_mode=1&expired=1722408159&nonce=42261112&ref_text=hello&score_coeff=1.0&secretid=secret-id-test&sentence_info_enabled=1&server_engine_type=16k_zh&text_mode=0&timestamp=1722321759&voice_format=0&voice_id=4943511b-192c-40f8-b6c9-c3df2a827b75";
    expect(decodeURIComponent(signature!)).toBe(createHmac("sha1", tencentCredentials.secretKey).update(signText).digest("base64"));
  });

  it("normalizes Tencent new SOE result fields and keeps unavailable tone null", () => {
    const result = parseTencentSoeResult(
      "{SuggestedScore:86.5 PronAccuracy:88 PronFluency:0.82 PronCompletion:0.95 Words:[]}",
      { requestId: "req-tencent", responseCount: 3 },
    );
    expect(result.scores).toEqual({ accuracy: 88, completeness: 95, fluency: 82, tone: null, overall: 86.5 });
    expect(result.reasonCodes).toContain("TONE_NOT_PROVIDED");
    expect(result.finalizable).toBe(false);
    expect(() => parseTencentSoeResult("{PronAccuracy:-1 PronFluency:-1 PronCompletion:-1 SuggestedScore:-1}")).toThrow();
    expect(() => parseTencentSoeResult("{PronAccuracy:120}")).toThrow();
  });

  it("runs Tencent handshake, binary audio, and end message against a fixture server", async () => {
    const socket = new FakeSocket();
    const provider = new TencentSoeSpeechReadingProvider({
      credentials: tencentCredentials,
      frameIntervalMs: 0,
      timeoutMs: 500,
      now: () => 1722321759,
      nonce: () => 42261112,
      webSocketFactory: () => {
        queueMicrotask(() => socket.emit("open"));
        return socket;
      },
    });
    const resultPromise = provider.scoreReading({
      audio: new Uint8Array([1, 2, 3]),
      targetText: "春眠不觉晓",
      language: "zh-CN",
      requestId: "req-tencent",
    });
    socket.emit("message", JSON.stringify({ code: 0, message: "success", voice_id: "req-tencent" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(socket.sent.some((data) => data instanceof Uint8Array)).toBe(true);
    expect(socket.sent.at(-1)).toBe(JSON.stringify({ type: "end" }));
    socket.emit("message", JSON.stringify({ code: 0, message: "success", result: "{SuggestedScore:80 PronAccuracy:81 PronFluency:0.8 PronCompletion:0.9}", final: 1 }));
    const result = await resultPromise;
    expect(result.provider).toBe("tencent");
    expect(result.calibrationStatus).toBe("UNCALIBRATED");
  });
});
