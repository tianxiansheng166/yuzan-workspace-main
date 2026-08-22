import { describe, expect, it } from "vitest";
import {
  buildReadAloudPolicyResult,
  validateSpeechProviderResult,
} from "../../src/modules/speech-job/speech-result.policy.js";

const validResult = {
  provider: "local",
  scorerVersion: "mandarin-reading-v0.1.0",
  confidence: 0.92,
  scores: {
    accuracy: 80,
    completeness: 80,
    fluency: 80,
    tone: null,
    overall: 80,
  },
  requiresReview: false,
  experimental: true,
  toneMeta: {
    experimental: true,
    method: null,
    reason: "TONE_SCORING_UNAVAILABLE",
  },
  transcript: "学习诊断内部转写",
  errors: [],
};

function policy(overrides: Record<string, unknown> = {}) {
  return buildReadAloudPolicyResult({
    providerResult: { ...validResult, ...overrides },
    strategy: "SPEECH_READING",
    itemMaxScore: 4,
    specMaxScore: 4,
  });
}

describe("read-aloud speech result policy", () => {
  it("normalizes 0–100 overall into bounded candidate points and keeps formal score absent", () => {
    const result = policy();
    expect(result.diagnostic.candidatePoints).toBe(3.2);
    expect(result.diagnostic.maxScore).toBe(4);
    expect(result.diagnostic.state).toBe("NEEDS_REVIEW");
    expect(result.diagnostic.finalizable).toBe(false);
    expect(JSON.stringify(result.diagnostic)).not.toContain("transcript");
  });

  it("caps a perfect provider result at the item max score", () => {
    const result = policy({
      scores: {
        accuracy: 100,
        completeness: 100,
        fluency: 100,
        tone: 100,
        overall: 100,
      },
    });
    expect(result.diagnostic.candidatePoints).toBe(4);
    expect(result.diagnostic.candidatePoints).toBeLessThanOrEqual(
      result.diagnostic.maxScore,
    );
  });

  it("rejects provider scores outside the provider scale instead of writing 4.8", () => {
    expect(() =>
      policy({ scores: { ...validResult.scores, overall: 120 } }),
    ).toThrow();
    expect(() =>
      policy({ scores: { ...validResult.scores, overall: 120 } }),
    ).toThrow(/outside|range/i);
  });

  it("keeps low-confidence local diagnostics reviewable", () => {
    const result = policy({ confidence: 0.4, requiresReview: true });
    expect(result.status).toBe("NEEDS_REVIEW");
    expect(result.diagnostic.reasonCodes).toEqual(
      expect.arrayContaining([
        "LOCAL_BASELINE_UNCALIBRATED",
        "PROVIDER_REQUIRES_REVIEW",
        "LOW_CONFIDENCE",
      ]),
    );
  });

  it("fails closed for non-read-aloud strategies", () => {
    expect(() =>
      buildReadAloudPolicyResult({
        providerResult: validResult,
        strategy: "SPEECH_OPEN_RESPONSE",
        itemMaxScore: 4,
        specMaxScore: 4,
      }),
    ).toThrow(/read-aloud/i);
  });

  it("rejects mismatched item and scoring-spec max scores", () => {
    expect(() =>
      buildReadAloudPolicyResult({
        providerResult: validResult,
        strategy: "SPEECH_READING",
        itemMaxScore: 4,
        specMaxScore: 5,
      }),
    ).toThrow(/max scores differ/i);
  });

  it("validates required overall and keeps the stored provider shape bounded", () => {
    expect(() =>
      validateSpeechProviderResult({
        ...validResult,
        scores: { ...validResult.scores, overall: undefined },
      }),
    ).toThrow();
    expect(() =>
      validateSpeechProviderResult({
        ...validResult,
        scores: { ...validResult.scores, accuracy: -1 },
      }),
    ).toThrow();
    const normalized = validateSpeechProviderResult(validResult);
    expect(normalized.provider).toBe("local");
    expect(normalized.experimental).toBe(true);
  });

  it("is deterministic and does not put raw provider details in the student diagnostic", () => {
    const first = policy({
      scores: {
        accuracy: 86,
        completeness: 79,
        fluency: 91,
        tone: null,
        overall: 84.7,
      },
    });
    const second = policy({
      scores: {
        accuracy: 86,
        completeness: 79,
        fluency: 91,
        tone: null,
        overall: 84.7,
      },
    });
    expect(first.diagnostic).toEqual(second.diagnostic);
    const serialized = JSON.stringify(first.diagnostic);
    expect(serialized).not.toContain("transcript");
    expect(serialized).not.toContain("errors");
    expect(serialized).not.toContain("rubric");
    expect(serialized).not.toContain("deductionRules");
  });
});
