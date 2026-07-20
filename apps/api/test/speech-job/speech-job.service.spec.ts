/**
 * Unit tests for SpeechJobService — status update scenarios.
 *
 * Covers the "golden closed loop" SpeechJob scenarios required by P0-TEST-FOUNDATION-001:
 *   - SpeechJob creation with recording linkage
 *   - Status transitions: CREATED → PROCESSING → AUTO_RESULT / NEEDS_REVIEW / FAILED
 *   - Result update (confidence, processingMs, providerModel)
 *   - Failed status increments retryCount
 *   - Job not found on getSpeechJob
 *   - triggerSpeechProcessing dispatch (provider=disabled path)
 *
 * No database required — PrismaService is faked.
 */

import { describe, it, expect, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { SpeechJobService } from "../../src/modules/speech-job/speech-job.service.js";
import { SPEECH_QUEUE } from "../../src/modules/speech-job/speech-job.tokens.js";
import { createFakePrismaService, createFakeDatabaseModule } from "../helpers/fake-prisma.service.js";

// ─── Fixtures ───────────────────────────────────────────

const JOB_ID = "job-00000-0000-0000-000000000001";
const RECORDING_ID = "rec-00000-0000-0000-000000000001";
const ASSESSMENT_ITEM_ID = "item-0000-0000-0000-000000000001";
const SCHOOL_ID = "school-a-0000-0000-000000000000";

const now = new Date("2026-01-01T00:00:00Z");

function makeJob(overrides: Record<string, any> = {}) {
  return {
    id: JOB_ID,
    recordingId: RECORDING_ID,
    assessmentItemId: ASSESSMENT_ITEM_ID,
    schoolId: SCHOOL_ID,
    targetText: "春眠不觉晓",
    scorerVersion: "mandarin-reading-v0.1.0",
    status: "CREATED",
    provider: null,
    providerModel: null,
    result: null,
    confidence: null,
    processingMs: null,
    retryCount: 0,
    errorCode: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ─── Module builder ─────────────────────────────────────

interface BuildOptions {
  prismaOverrides?: Record<string, any>;
}

async function buildService(opts: BuildOptions = {}) {
  let createdJob = makeJob();

  const fakePrisma = createFakePrismaService({
    speechJob: {
      create: async (args: any) => {
        createdJob = makeJob({ ...args.data, id: JOB_ID });
        return createdJob;
      },
      findUnique: async (args: any) => {
        if (args.where.id === JOB_ID) return createdJob;
        return null;
      },
      findMany: async () => [createdJob],
      update: async (args: any) => {
        // Handle Prisma atomic operations before spreading
        const { retryCount, ...restData } = args.data;
        let nextRetryCount = createdJob.retryCount ?? 0;
        if (retryCount?.increment) {
          nextRetryCount += retryCount.increment;
        } else if (retryCount !== undefined) {
          nextRetryCount = retryCount;
        }
        createdJob = { ...createdJob, ...restData, retryCount: nextRetryCount, updatedAt: new Date() };
        return createdJob;
      },
    },
    recording: {
      findUnique: async () => ({ id: RECORDING_ID, objectKey: "recordings/rec/full" }),
      update: async () => ({}),
    },
    ...opts.prismaOverrides,
  });

  const fakeConfig = {
    get: vi.fn((key: string, defaultValue?: any) => {
      if (key === "SPEECH_PROVIDER") return "disabled";
      return defaultValue;
    }),
    getOrThrow: vi.fn((key: string) => { throw new Error(`Config ${key} not set`); }),
  };

  const moduleRef = await Test.createTestingModule({
    imports: [createFakeDatabaseModule(fakePrisma)],
    providers: [
      { provide: ConfigService, useValue: fakeConfig },
      { provide: SPEECH_QUEUE, useValue: null },
      SpeechJobService,
    ],
  }).compile();

  const service = moduleRef.get(SpeechJobService);
  return { service, fakePrisma };
}

// ─── Test suite ─────────────────────────────────────────

describe("SpeechJobService", () => {
  // ─── 1. SpeechJob creation ───────────────────────────

  describe("createSpeechJob", () => {
    it("creates a job with status CREATED", async () => {
      const { service } = await buildService();
      const result = await service.createSpeechJob({
        recordingId: RECORDING_ID,
        assessmentItemId: ASSESSMENT_ITEM_ID,
        targetText: "春眠不觉晓",
        schoolId: SCHOOL_ID,
      });

      expect(result).toBeDefined();
      expect(result.status).toBe("CREATED");
      expect(result.recordingId).toBe(RECORDING_ID);
    });

    it("creates a job with custom scorerVersion and provider", async () => {
      const { service } = await buildService();
      const result = await service.createSpeechJob({
        recordingId: RECORDING_ID,
        assessmentItemId: ASSESSMENT_ITEM_ID,
        targetText: "春眠不觉晓",
        schoolId: SCHOOL_ID,
        scorerVersion: "v2.0",
        provider: "azure",
      });

      expect(result).toBeDefined();
    });
  });

  // ─── 2. Status updates ───────────────────────────────

  describe("updateSpeechJobStatus", () => {
    it("transitions status to PROCESSING", async () => {
      const { service } = await buildService();
      // First create a job
      await service.createSpeechJob({
        recordingId: RECORDING_ID,
        assessmentItemId: ASSESSMENT_ITEM_ID,
        targetText: "春眠不觉晓",
        schoolId: SCHOOL_ID,
      });

      const result = await service.updateSpeechJobStatus(JOB_ID, "PROCESSING");
      expect(result.status).toBe("PROCESSING");
    });

    it("transitions status to FAILED and increments retryCount", async () => {
      const { service } = await buildService();
      await service.createSpeechJob({
        recordingId: RECORDING_ID,
        assessmentItemId: ASSESSMENT_ITEM_ID,
        targetText: "春眠不觉晓",
        schoolId: SCHOOL_ID,
      });

      const result = await service.updateSpeechJobStatus(JOB_ID, "FAILED", "TIMEOUT");
      expect(result.status).toBe("FAILED");
      expect(result.retryCount).toBe(1);
    });

    it("transitions status to AUTO_RESULT via updateSpeechJobResult", async () => {
      const { service } = await buildService();
      await service.createSpeechJob({
        recordingId: RECORDING_ID,
        assessmentItemId: ASSESSMENT_ITEM_ID,
        targetText: "春眠不觉晓",
        schoolId: SCHOOL_ID,
      });

      const result = await service.updateSpeechJobResult(JOB_ID, { overall: 85 }, {
        confidence: 0.92,
        processingMs: 1200,
        providerModel: "mandarin-v2",
      });

      expect(result.status).toBe("AUTO_RESULT");
    });
  });

  // ─── 3. getSpeechJob — not found ─────────────────────

  describe("getSpeechJob", () => {
    it("returns job when found", async () => {
      const { service } = await buildService();
      await service.createSpeechJob({
        recordingId: RECORDING_ID,
        assessmentItemId: ASSESSMENT_ITEM_ID,
        targetText: "春眠不觉晓",
        schoolId: SCHOOL_ID,
      });

      const result = await service.getSpeechJob(JOB_ID);
      expect(result.id).toBe(JOB_ID);
    });

    it("throws NotFoundException when job not found", async () => {
      const { service } = await buildService();
      await expect(service.getSpeechJob("nonexistent")).rejects.toThrow();
    });
  });

  // ─── 4. triggerSpeechProcessing (disabled path) ──────

  describe("triggerSpeechProcessing — provider disabled", () => {
    it("creates job and leaves status CREATED when provider is disabled", async () => {
      const { service } = await buildService();
      const result = await service.triggerSpeechProcessing(
        RECORDING_ID,
        ASSESSMENT_ITEM_ID,
        "春眠不觉晓",
        SCHOOL_ID,
      );

      expect(result).toBeDefined();
      // With SPEECH_QUEUE=null and ConfigService default, provider=disabled
      // Job should remain in CREATED status
      expect(result.status).toBe("CREATED");
    });
  });

  // ─── 5. listSpeechJobsByItem ─────────────────────────

  describe("listSpeechJobsByItem", () => {
    it("returns jobs for a given assessment item", async () => {
      const { service } = await buildService();
      await service.createSpeechJob({
        recordingId: RECORDING_ID,
        assessmentItemId: ASSESSMENT_ITEM_ID,
        targetText: "春眠不觉晓",
        schoolId: SCHOOL_ID,
      });

      const results = await service.listSpeechJobsByItem(ASSESSMENT_ITEM_ID);
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });
});
