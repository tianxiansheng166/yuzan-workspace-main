import { describe, expect, it } from "vitest";
import { inspectLocalQuality } from "../../app/features/speech/quality/local-quality-inspector";

const audio = (overrides = {}) => ({
  blob: new Blob(["audio"], { type: "audio/webm" }),
  mimeType: "audio/webm",
  durationMs: 3000,
  size: 5,
  averageLevel: 0.2,
  peakLevel: 0.5,
  capturedSamples: 20,
  ...overrides,
});

describe("local quality inspector", () => {
  it("detects empty audio", () => {
    const result = inspectLocalQuality(audio({ size: 0, capturedSamples: 0 }));
    expect(result.status).toBe("empty");
    expect(result.checks.some((check) => check.code === "empty")).toBe(true);
  });

  it("warns for extremely short audio", () => {
    expect(
      inspectLocalQuality(audio({ durationMs: 200 })).checks.some(
        (check) => check.code === "too-short",
      ),
    ).toBe(true);
  });

  it("uses tentative wording for silence", () => {
    const check = inspectLocalQuality(
      audio({ averageLevel: 0.001 }),
    ).checks.find((item) => item.code === "silence");
    expect(check?.message).toContain("可能");
    expect(check?.message).toContain("建议检查");
  });

  it("detects possible clipping", () => {
    const check = inspectLocalQuality(audio({ peakLevel: 0.99 })).checks.find(
      (item) => item.code === "clipping",
    );
    expect(check?.message).toContain("可能");
  });

  it("provides a low-input notice", () => {
    expect(
      inspectLocalQuality(audio({ averageLevel: 0.02 })).checks.some(
        (check) => check.code === "low-input",
      ),
    ).toBe(true);
  });

  it("reports captured format without scoring speech", () => {
    const result = inspectLocalQuality(audio());
    expect(result.status).toBe("pass");
    expect(
      result.checks.find((check) => check.code === "format")?.message,
    ).toContain("audio/webm");
    expect(JSON.stringify(result)).not.toMatch(
      /准确率|音素|流利度|CEFR|口音|疾病|障碍/,
    );
  });
});
