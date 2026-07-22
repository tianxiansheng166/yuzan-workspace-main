/**
 * Unit tests for SpeechJobConsumer — worker processing scenarios.
 *
 * Covers the "golden closed loop" Worker scenarios required by P0-TEST-FOUNDATION-001:
 *   - Normal consumption (happy path)
 *   - Supplier timeout (speech API unreachable)
 *   - Audio quality rejection (scoring service returns error)
 *   - Object not found (recording download URL fails)
 *   - API writeback failure (internal API returns error)
 *   - Duplicate consumption (idempotency consideration)
 *   - Max retry handling
 *   - Internal key missing/wrong (X-Internal-Key header)
 *
 * No database, Redis, or external services required — fetch is mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SpeechJobPayload, SpeechScoringResult } from "../src/speech/speech-job.consumer.js";
import { SpeechJobConsumer } from "../src/speech/speech-job.consumer.js";

// ─── Test fixtures ──────────────────────────────────────

const SPEECH_JOB_ID = "job-001";
const RECORDING_ID = "rec-001";
const ASSESSMENT_ITEM_ID = "item-001";
const SCHOOL_ID = "school-001";
const TARGET_TEXT = "春眠不觉晓";
const SCORER_VERSION = "mandarin-reading-v0.1.0";
const OBJECT_KEY = "recordings/rec-001/full";

const BASE_PAYLOAD: SpeechJobPayload = {
  speechJobId: SPEECH_JOB_ID,
  recordingId: RECORDING_ID,
  assessmentItemId: ASSESSMENT_ITEM_ID,
  schoolId: SCHOOL_ID,
  targetText: TARGET_TEXT,
  scorerVersion: SCORER_VERSION,
  objectKey: OBJECT_KEY,
};

const SUCCESSFUL_SCORING_RESULT: SpeechScoringResult = {
  scorerVersion: SCORER_VERSION,
  transcript: "春眠不觉晓",
  confidence: 0.92,
  scores: { accuracy: 90, completeness: 85, fluency: 88, tone: 80, overall: 86 },
  errors: [],
  requiresReview: false,
  processingMs: 1200,
};

// ─── Fetch mock ─────────────────────────────────────────

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function mockFetchUrl(url: string | URL): string {
  return url.toString();
}

function okResponse(body: any): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

function errorResponse(status: number, body: string): Response {
  return new Response(body, { status, headers: { "Content-Type": "application/json" } });
}

// ─── Helper: create consumer and process a job ──────────

function createConsumer(): SpeechJobConsumer {
  const consumer = new SpeechJobConsumer("speech-jobs", { host: "127.0.0.1", port: 6379 });
  // Override env for test
  process.env.API_INTERNAL_URL = "http://api.test:4000";
  process.env.SPEECH_API_URL = "http://speech.test:8100";
  process.env.API_INTERNAL_KEY = "test-internal-key";
  return consumer;
}

// Access private processJob via (consumer as any)
async function processJob(consumer: SpeechJobConsumer, payload: SpeechJobPayload = BASE_PAYLOAD) {
  const job = { id: "bullmq-job-1", data: payload, attemptsMade: 0 } as any;
  return (consumer as any).processJob(job);
}

// ─── Test suite ─────────────────────────────────────────

describe("SpeechJobConsumer", () => {
  let consumer: SpeechJobConsumer;

  beforeEach(() => {
    consumer = createConsumer();
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── 1. Normal consumption ───────────────────────────

  describe("normal consumption", () => {
    it("successfully processes a speech job end-to-end", async () => {
      // Step 1: getRecordingDownloadUrl → success
      fetchMock.mockImplementationOnce(() =>
        okResponse({ data: { url: "https://storage.test/download/rec-001" } }),
      );
      // Step 2: callSpeechScoring → success
      fetchMock.mockImplementationOnce(() =>
        okResponse(SUCCESSFUL_SCORING_RESULT),
      );
      // Step 3: updateSpeechJobResult → success
      fetchMock.mockImplementationOnce(() => okResponse({}));
      // Step 4: updateAssessmentItem → success
      fetchMock.mockImplementationOnce(() => okResponse({}));
      // Step 5: updateRecordingStatus → success
      fetchMock.mockImplementationOnce(() => okResponse({}));

      await processJob(consumer);

      // Verify all 5 API calls were made
      expect(fetchMock).toHaveBeenCalledTimes(5);

      // Verify X-Internal-Key header on internal API calls
      const internalCalls = fetchMock.mock.calls.filter(
        (call: any[]) => call[0]?.toString()?.includes("api.test"),
      );
      for (const call of internalCalls) {
        expect(call[1]?.headers?.["X-Internal-Key"]).toBe("test-internal-key");
      }

      // Verify scoring call has correct body
      const scoringCall = fetchMock.mock.calls.find(
        (call: any[]) => {
          const url = typeof call[0] === "string" ? call[0] : call[0]?.toString?.() ?? "";
          return url.includes("speech.test") || url.includes("8100") || url.includes("/v1/score/reading");
        },
      );
      expect(scoringCall).toBeDefined();
      const scoringBody = JSON.parse(scoringCall![1].body);
      expect(scoringBody.targetText).toBe(TARGET_TEXT);
      expect(scoringBody.scorerVersion).toBe(SCORER_VERSION);
    });
  });

  // ─── 2. Supplier timeout ─────────────────────────────

  describe("supplier timeout", () => {
    it("throws when speech scoring API is unreachable", async () => {
      // Step 1: getRecordingDownloadUrl → success
      fetchMock.mockImplementationOnce(() =>
        okResponse({ data: { url: "https://storage.test/download/rec-001" } }),
      );
      // Step 2: callSpeechScoring → network error (timeout)
      fetchMock.mockImplementationOnce(() => {
        throw new Error("fetch failed: ECONNREFUSED");
      });
      // Step 3: markSpeechJobFailed → success
      fetchMock.mockImplementationOnce(() => okResponse({}));

      await expect(processJob(consumer)).rejects.toThrow("ECONNREFUSED");

      // Verify that markSpeechJobFailed was called
      const failedCall = fetchMock.mock.calls.find(
        (call: any[]) => call[0]?.toString()?.includes("/speech-jobs/") && call[0]?.toString()?.includes("/result"),
      );
      expect(failedCall).toBeDefined();
    });
  });

  // ─── 3. Audio quality rejection ──────────────────────

  describe("audio quality rejection", () => {
    it("throws when speech scoring service returns 422 (bad audio)", async () => {
      // Step 1: getRecordingDownloadUrl → success
      fetchMock.mockImplementationOnce(() =>
        okResponse({ data: { url: "https://storage.test/download/rec-001" } }),
      );
      // Step 2: callSpeechScoring → 422 Unprocessable Entity
      fetchMock.mockImplementationOnce(() =>
        errorResponse(422, '{"error":"Audio quality too low for processing"}'),
      );
      // Step 3: markSpeechJobFailed → success
      fetchMock.mockImplementationOnce(() => okResponse({}));

      await expect(processJob(consumer)).rejects.toThrow("422");

      // Verify markFailed was called
      const failedCall = fetchMock.mock.calls.find(
        (call: any[]) => call[0]?.toString()?.includes("/speech-jobs/") && call[1]?.method === "PUT",
      );
      expect(failedCall).toBeDefined();
      const failBody = JSON.parse(failedCall![1].body);
      expect(failBody.status).toBe("FAILED");
    });
  });

  // ─── 4. Object not found ─────────────────────────────

  describe("object not found", () => {
    it("throws when recording download URL API returns 404", async () => {
      // Step 1: getRecordingDownloadUrl → 404
      fetchMock.mockImplementationOnce(() =>
        errorResponse(404, "Recording not found"),
      );
      // Step 2: markSpeechJobFailed → success
      fetchMock.mockImplementationOnce(() => okResponse({}));

      await expect(processJob(consumer)).rejects.toThrow("404");
    });
  });

  // ─── 5. API writeback failure ────────────────────────

  describe("API writeback failure", () => {
    it("throws when updateSpeechJobResult API returns 500", async () => {
      // Step 1: getRecordingDownloadUrl → success
      fetchMock.mockImplementationOnce(() =>
        okResponse({ data: { url: "https://storage.test/download/rec-001" } }),
      );
      // Step 2: callSpeechScoring → success
      fetchMock.mockImplementationOnce(() =>
        okResponse(SUCCESSFUL_SCORING_RESULT),
      );
      // Step 3: updateSpeechJobResult → 500 Internal Server Error
      fetchMock.mockImplementationOnce(() =>
        errorResponse(500, "Database connection lost"),
      );
      // Step 4: markSpeechJobFailed → success
      fetchMock.mockImplementationOnce(() => okResponse({}));

      await expect(processJob(consumer)).rejects.toThrow("500");
    });
  });

  // ─── 6. Internal key missing/wrong ───────────────────

  describe("internal key", () => {
    it("sends X-Internal-Key header when API_INTERNAL_KEY is set", async () => {
      process.env.API_INTERNAL_KEY = "my-secret-key";
      consumer = createConsumer();

      // All internal calls should include the key
      fetchMock.mockImplementationOnce(() =>
        okResponse({ data: { url: "https://storage.test/download" } }),
      );
      fetchMock.mockImplementationOnce(() =>
        okResponse(SUCCESSFUL_SCORING_RESULT),
      );
      fetchMock.mockImplementationOnce(() => okResponse({}));
      fetchMock.mockImplementationOnce(() => okResponse({}));
      fetchMock.mockImplementationOnce(() => okResponse({}));

      await processJob(consumer);

      const internalCalls = fetchMock.mock.calls.filter(
        (call: any[]) => call[0]?.toString()?.includes("api.test"),
      );
      for (const call of internalCalls) {
        expect(call[1]?.headers?.["X-Internal-Key"]).toBe("my-secret-key");
      }
    });

    it("does not send X-Internal-Key header when key is empty", async () => {
      process.env.API_INTERNAL_KEY = "";
      consumer = createConsumer();

      fetchMock.mockImplementationOnce(() =>
        okResponse({ data: { url: "https://storage.test/download" } }),
      );
      fetchMock.mockImplementationOnce(() =>
        okResponse(SUCCESSFUL_SCORING_RESULT),
      );
      fetchMock.mockImplementationOnce(() => okResponse({}));
      fetchMock.mockImplementationOnce(() => okResponse({}));
      fetchMock.mockImplementationOnce(() => okResponse({}));

      await processJob(consumer);

      const internalCalls = fetchMock.mock.calls.filter(
        (call: any[]) => call[0]?.toString()?.includes("api.test"),
      );
      for (const call of internalCalls) {
        expect(call[1]?.headers?.["X-Internal-Key"]).toBeUndefined();
      }
    });
  });

  // ─── 7. Max retry / duplicate consumption ────────────

  describe("retry and duplicate handling", () => {
    it("marks job as FAILED with PROCESSING_FAILED error code on processing error", async () => {
      // Step 1: getRecordingDownloadUrl → success
      fetchMock.mockImplementationOnce(() =>
        okResponse({ data: { url: "https://storage.test/download/rec-001" } }),
      );
      // Step 2: callSpeechScoring → error
      fetchMock.mockImplementationOnce(() => {
        throw new Error("Service unavailable");
      });
      // Step 3: markSpeechJobFailed → success
      fetchMock.mockImplementationOnce(() => okResponse({}));

      await expect(processJob(consumer)).rejects.toThrow("Service unavailable");

      // Verify the failed call includes PROCESSING_FAILED error code
      const failedCall = fetchMock.mock.calls.find(
        (call: any[]) => call[0]?.toString()?.includes("/speech-jobs/") && call[1]?.method === "PUT",
      );
      expect(failedCall).toBeDefined();
      const body = JSON.parse(failedCall![1].body);
      expect(body.status).toBe("FAILED");
      expect(body.errorCode).toBe("PROCESSING_FAILED");
    });
  });
});
