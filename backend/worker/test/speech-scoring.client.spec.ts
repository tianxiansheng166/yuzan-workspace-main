import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SpeechScoringClient } from "../src/speech/speech-scoring.client.js";
import {
  configuredSpeechProvider,
  SpeechProviderResponseError,
} from "../src/speech/speech-provider.js";

const response = {
  scorerVersion: "mandarin-reading-v0.1.0",
  transcript: "春眠不觉晓",
  confidence: 0.9,
  scores: {
    accuracy: 90,
    completeness: 90,
    fluency: 90,
    tone: null,
    overall: 90,
  },
  errors: [],
  requiresReview: false,
  toneMeta: {
    experimental: true,
    method: null,
    reason: "TONE_SCORING_UNAVAILABLE",
  },
  processingMs: 12,
};

describe("SpeechScoringClient local provider boundary", () => {
  beforeEach(() => {
    process.env.SPEECH_API_URL = "http://speech.test:8100";
    process.env.SPEECH_API_MAX_RETRIES = "0";
    process.env.SPEECH_API_TIMEOUT_MS = "100";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a provider-neutral local result for a valid response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify(response), { status: 200 }),
      ),
    );
    const result = await new SpeechScoringClient().scoreReading(
      "https://storage/audio",
      "春眠不觉晓",
      "v1",
    );
    expect(result.provider).toBe("local");
    expect(result.experimental).toBe(true);
    expect(result.scores.overall).toBe(90);
  });

  it("fails closed for HTTP failures and network timeouts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unavailable", { status: 503 })),
    );
    await expect(
      new SpeechScoringClient().scoreReading("audio", "text", "v1"),
    ).rejects.toThrow("503");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("timed out");
      }),
    );
    await expect(
      new SpeechScoringClient().scoreReading("audio", "text", "v1"),
    ).rejects.toThrow("timed out");
  });

  it("rejects malformed responses, missing overall, and out-of-range scores", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ...response, scores: undefined }), {
        status: 200,
      }),
    );
    await expect(
      new SpeechScoringClient().scoreReading("audio", "text", "v1"),
    ).rejects.toBeInstanceOf(SpeechProviderResponseError);

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...response,
          scores: { ...response.scores, overall: 120 },
        }),
        { status: 200 },
      ),
    );
    await expect(
      new SpeechScoringClient().scoreReading("audio", "text", "v1"),
    ).rejects.toThrow(/overall|between/i);
  });

  it("only accepts disabled and local provider names", () => {
    expect(configuredSpeechProvider("disabled")).toBe("disabled");
    expect(configuredSpeechProvider("LOCAL")).toBe("local");
    expect(() => configuredSpeechProvider("unsupported-provider")).toThrow(
      /disabled or local/i,
    );
  });

  it("uses the separate open-response endpoint without target text", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body.targetText).toBeUndefined();
      expect(body.scorerVersion).toBe("open-v1");
      return new Response(JSON.stringify({
        strategy: "SPEECH_OPEN_RESPONSE",
        scorerVersion: "open-v1",
        transcript: "孩子在公园里玩耍",
        confidence: 0.86,
        diagnostics: {
          durationMs: 5000,
          speechDurationMs: 4200,
          speechRate: 3.3,
          silenceRatio: 0.16,
          fluency: 82,
          audioQuality: { acceptable: true, status: "ACCEPTABLE" },
        },
        requiresReview: true,
        experimental: true,
        reasonCodes: ["SEMANTIC_REVIEW_REQUIRED"],
      }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await new SpeechScoringClient().analyzeOpenResponse(
      "https://storage/audio",
      "open-v1",
    );
    expect(result.strategy).toBe("SPEECH_OPEN_RESPONSE");
    expect(result.scores).toBeUndefined();
    expect(result.diagnostics?.speechRate).toBe(3.3);
  });
});
