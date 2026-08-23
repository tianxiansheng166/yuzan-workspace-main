import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildBenchmarkReport, parseBenchmarkManifest } from "../../../tools/speech-benchmark/index.js";

describe("speech benchmark harness", () => {
  const original = { app: process.env.IFLYTEK_ISE_APP_ID, key: process.env.IFLYTEK_ISE_API_KEY, secret: process.env.IFLYTEK_ISE_API_SECRET, tApp: process.env.TENCENT_SOE_APP_ID, tId: process.env.TENCENT_SOE_SECRET_ID, tKey: process.env.TENCENT_SOE_SECRET_KEY };
  beforeEach(() => {
    delete process.env.IFLYTEK_ISE_APP_ID;
    delete process.env.IFLYTEK_ISE_API_KEY;
    delete process.env.IFLYTEK_ISE_API_SECRET;
    delete process.env.TENCENT_SOE_APP_ID;
    delete process.env.TENCENT_SOE_SECRET_ID;
    delete process.env.TENCENT_SOE_SECRET_KEY;
  });
  afterEach(() => {
    for (const [key, value] of Object.entries({ IFLYTEK_ISE_APP_ID: original.app, IFLYTEK_ISE_API_KEY: original.key, IFLYTEK_ISE_API_SECRET: original.secret, TENCENT_SOE_APP_ID: original.tApp, TENCENT_SOE_SECRET_ID: original.tId, TENCENT_SOE_SECRET_KEY: original.tKey })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });

  it("parses synthetic manifest and rejects PII fields without requiring them", () => {
    const parsed = parseBenchmarkManifest({ samples: [{ sampleId: "s-1", audioPath: "synthetic://s-1", targetText: "你好", maxScore: 4, teacherScore: 3 }] });
    expect(parsed.errors).toEqual([]);
    expect(parsed.samples[0]?.sampleId).toBe("s-1");
    const pii = parseBenchmarkManifest({ samples: [{ sampleId: "s-2", audioPath: "synthetic://s-2", targetText: "你好", maxScore: 4, teacherScore: 3, studentName: "not allowed" }] });
    expect(pii.errors.join(" ")).toMatch(/PII|studentName/);
  });

  it("reports metrics, missing labels, provider skips, and insufficient calibration", async () => {
    const parsed = parseBenchmarkManifest({ samples: [
      { sampleId: "s-1", audioPath: "synthetic://s-1", targetText: "你好", maxScore: 4, teacherScore: 3 },
      { sampleId: "s-2", audioPath: "synthetic://s-2", targetText: "再见", maxScore: 4 },
    ] });
    const report = await buildBenchmarkReport(parsed.samples, ["local", "iflytek", "tencent"]);
    expect(report.providers[0]).toMatchObject({ provider: "local", sampleCount: 2, validResultCount: 1, failureRate: 0.5 });
    expect(report.skippedProviders).toEqual({ iflytek: "SKIPPED_NOT_CONFIGURED", tencent: "SKIPPED_NOT_CONFIGURED" });
    expect(report.calibration).toMatchObject({ status: "INSUFFICIENT_CALIBRATION_DATA", realSampleCount: 0 });
    expect(report.formalScoring).toMatchObject({ calibrated: false, finalizable: false, authority: "teacher_review" });
  });
});
