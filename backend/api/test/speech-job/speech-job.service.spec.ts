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
import type { SpeechJobStatus } from "@yuzan/database";
import {
  createFakePrismaService,
  createFakeDatabaseModule,
  type FakePrismaServiceOverrides,
} from "../helpers/fake-prisma.service.js";

// ─── Fixtures ───────────────────────────────────────────

const JOB_ID = "job-00000-0000-0000-000000000001";
const RECORDING_ID = "rec-00000-0000-0000-000000000001";
const ASSESSMENT_ITEM_ID = "item-0000-0000-0000-000000000001";
const SCHOOL_ID = "school-a-0000-0000-000000000000";

const now = new Date("2026-01-01T00:00:00Z");

interface FakeSpeechJob {
  id: string;
  recordingId: string;
  assessmentItemId: string;
  schoolId: string;
  targetText: string | null;
  scorerVersion: string;
  status: SpeechJobStatus;
  provider: string | null;
  providerModel: string | null;
  result: unknown;
  confidence: number | null;
  processingMs: number | null;
  retryCount: number;
  errorCode: string | null;
  recording: { id: string };
  createdAt: Date;
  updatedAt: Date;
}

function makeJob(overrides: Partial<FakeSpeechJob> = {}): FakeSpeechJob {
  const defaultJob: FakeSpeechJob = {
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
    recording: { id: RECORDING_ID },
    createdAt: now,
    updatedAt: now,
  };
  return { ...defaultJob, ...overrides };
}

// ─── Module builder ─────────────────────────────────────

interface BuildOptions {
  prismaOverrides?: FakePrismaServiceOverrides;
  existingSpeechJob?: ReturnType<typeof makeJob> | null;
  speechProvider?: string;
}

async function buildService(opts: BuildOptions = {}) {
  let createdJob = makeJob();

  const fakePrisma = createFakePrismaService({
    speechJob: {
      findFirst: () => Promise.resolve(opts.existingSpeechJob ?? null),
      create: vi.fn((args: { data: Partial<FakeSpeechJob> }) => {
        createdJob = makeJob({ ...args.data, id: JOB_ID });
        return Promise.resolve(createdJob);
      }),
      findUnique: (args: { where: { id: string } }) => {
        if (args.where.id === JOB_ID) return Promise.resolve(createdJob);
        return Promise.resolve(null);
      },
      findMany: () => Promise.resolve([createdJob]),
      update: (args: { data: Partial<Omit<FakeSpeechJob, "retryCount">> & { retryCount?: number | { increment: number } } }) => {
        // Handle Prisma atomic operations before spreading
        const { retryCount, ...restData } = args.data;
        let nextRetryCount = createdJob.retryCount ?? 0;
        if (typeof retryCount === "object" && retryCount !== null) {
          nextRetryCount += retryCount.increment;
        } else if (typeof retryCount === "number") {
          nextRetryCount = retryCount;
        }
        createdJob = {
          ...createdJob,
          ...restData,
          retryCount: nextRetryCount,
          updatedAt: new Date(),
        };
        return Promise.resolve(createdJob);
      },
    },
    recording: {
      findUnique: () => Promise.resolve({
        id: RECORDING_ID,
        objectKey: "recordings/rec/full",
      }),
      update: () => Promise.resolve({}),
    },
    assessmentItem: {
      findFirst: () => Promise.resolve({
        recordingId: null,
        prompt: {},
        questionVersion: null,
      }),
    },
    ...opts.prismaOverrides,
  });
  Reflect.set(fakePrisma, "$transaction", (callback: (tx: typeof fakePrisma) => unknown) =>
    callback(fakePrisma),
  );

  const fakeConfig = {
    get: (key: string, defaultValue?: unknown) => {
      if (key === "SPEECH_PROVIDER") return opts.speechProvider ?? "disabled";
      return defaultValue;
    },
    getOrThrow: (key: string) => {
      throw new Error(`Config ${key} not set`);
    },
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

      const result = await service.updateSpeechJobStatus(
        JOB_ID,
        "FAILED",
        "TIMEOUT",
      );
      expect(result.status).toBe("FAILED");
      expect(result.retryCount).toBe(1);
    });

    it("keeps uploaded recording READY for unsupported provider task", async () => {
      const recordingUpdate = vi.fn(() => ({
        id: RECORDING_ID,
        status: "READY",
      }));
      const { service } = await buildService({
        prismaOverrides: { recording: { update: recordingUpdate } },
      });
      await service.createSpeechJob({
        recordingId: RECORDING_ID,
        assessmentItemId: ASSESSMENT_ITEM_ID,
        targetText: "春眠不觉晓",
        schoolId: SCHOOL_ID,
      });

      const result = await service.markSpeechJobFailed(
        JOB_ID,
        "PROVIDER_TASK_UNSUPPORTED",
        "iflytek providers only support SPEECH_READING",
      );

      expect(result.status).toBe("FAILED");
      expect(result.errorCode).toBe("PROVIDER_TASK_UNSUPPORTED");
      expect(recordingUpdate).toHaveBeenCalledWith({
        where: { id: RECORDING_ID },
        data: { status: "READY" },
      });
    });

    it("keeps genuine processing failures fail closed on the recording", async () => {
      const recordingUpdate = vi.fn(() => ({
        id: RECORDING_ID,
        status: "FAILED",
      }));
      const { service } = await buildService({
        prismaOverrides: { recording: { update: recordingUpdate } },
      });
      await service.createSpeechJob({
        recordingId: RECORDING_ID,
        assessmentItemId: ASSESSMENT_ITEM_ID,
        targetText: "春眠不觉晓",
        schoolId: SCHOOL_ID,
      });

      const result = await service.markSpeechJobFailed(
        JOB_ID,
        "PROCESSING_FAILED",
        "audio object could not be read",
      );

      expect(result.status).toBe("FAILED");
      expect(result.errorCode).toBe("PROCESSING_FAILED");
      expect(recordingUpdate).toHaveBeenCalledWith({
        where: { id: RECORDING_ID },
        data: { status: "FAILED" },
      });
    });

    it("rejects an arbitrary result when the persisted item policy context is absent", async () => {
      const { service } = await buildService();
      await service.createSpeechJob({
        recordingId: RECORDING_ID,
        assessmentItemId: ASSESSMENT_ITEM_ID,
        targetText: "春眠不觉晓",
        schoolId: SCHOOL_ID,
      });

      await expect(
        service.updateSpeechJobResult(JOB_ID, { overall: 85 }),
      ).rejects.toThrow();
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

    it("fails closed for an unsupported provider", async () => {
      const { service } = await buildService({ speechProvider: "azure" });

      await expect(
        service.triggerSpeechProcessing(
          RECORDING_ID,
          ASSESSMENT_ITEM_ID,
          "春眠不觉晓",
          SCHOOL_ID,
        ),
      ).rejects.toThrow(/不支持的 SPEECH_PROVIDER/);
    });

    it("uses the published Question Bank target and rejects a picture-speaking strategy", async () => {
      const questionBankItem = {
        recordingId: null,
        prompt: { targetText: "浏览器篡改文本" },
        questionVersion: {
          status: "PUBLISHED",
          scoringSpec: {
            strategy: "SPEECH_READING",
            targetText: "服务端朗读文本",
            maxScore: 4,
          },
        },
      };
      const { service } = await buildService({
        speechProvider: "disabled",
        prismaOverrides: {
          assessmentItem: { findFirst: () => questionBankItem },
        },
      });

      const result = await service.triggerSpeechProcessing(
        RECORDING_ID,
        ASSESSMENT_ITEM_ID,
        "浏览器篡改文本",
        SCHOOL_ID,
      );
      expect(result.targetText).toBe("服务端朗读文本");

      const { service: pictureService } = await buildService({
        speechProvider: "local",
        prismaOverrides: {
          assessmentItem: {
            findFirst: () => ({
              ...questionBankItem,
              questionVersion: {
                status: "PUBLISHED",
                scoringSpec: {
                  strategy: "SPEECH_OPEN_RESPONSE",
                  maxScore: 4,
                },
              },
            }),
          },
        },
      });

      await expect(
        pictureService.triggerSpeechProcessing(
          RECORDING_ID,
          ASSESSMENT_ITEM_ID,
          "浏览器篡改文本",
          SCHOOL_ID,
        ),
      ).rejects.toThrow(/不是 READ_ALOUD/);
    });

    it("allows a new recording to replace only a previous FAILED recording", async () => {
      const previousRecordingId =
        "rec-previous-failed-000000000000000000000001";
      const newRecordingId = "rec-new-open-response-00000000000000000000001";
      const questionBankItem = {
        recordingId: previousRecordingId,
        prompt: { stimulus: { type: "IMAGE", promptText: "请看图表达" } },
        questionVersion: {
          status: "PUBLISHED",
          scoringSpec: { strategy: "SPEECH_OPEN_RESPONSE", maxScore: 14 },
        },
      };
      const { service } = await buildService({
        speechProvider: "iflytek",
        prismaOverrides: {
          assessmentItem: { findFirst: () => questionBankItem },
          recording: {
            findUnique: (args: { where: { id: string } }) => ({
              id: args.where.id,
              status:
                args.where.id === previousRecordingId ? "FAILED" : "READY",
              objectKey: "recordings/new-open-response/full",
            }),
          },
        },
      });

      const result = await service.triggerSpeechProcessing(
        newRecordingId,
        ASSESSMENT_ITEM_ID,
        undefined,
        SCHOOL_ID,
      );

      expect(result.recordingId).toBe(newRecordingId);
      expect(result.status).toBe("CREATED");
    });

    it("rejects replacing an active recording binding", async () => {
      const previousRecordingId = "rec-previous-active-00000000000000000000001";
      const questionBankItem = {
        recordingId: previousRecordingId,
        prompt: { stimulus: { type: "IMAGE", promptText: "请看图表达" } },
        questionVersion: {
          status: "PUBLISHED",
          scoringSpec: { strategy: "SPEECH_OPEN_RESPONSE", maxScore: 14 },
        },
      };
      const { service } = await buildService({
        speechProvider: "iflytek",
        prismaOverrides: {
          assessmentItem: { findFirst: () => questionBankItem },
          recording: {
            findUnique: (args: { where: { id: string } }) => ({
              id: args.where.id,
              status: "READY",
              objectKey: "recordings/new-open-response/full",
            }),
          },
        },
      });

      await expect(
        service.triggerSpeechProcessing(
          "rec-new-open-response-00000000000000000000001",
          ASSESSMENT_ITEM_ID,
          undefined,
          SCHOOL_ID,
        ),
      ).rejects.toThrow(/录音与测评题目绑定不一致/);
    });

    it("keeps a local-provider job auditable when the queue is unavailable", async () => {
      const { service } = await buildService({ speechProvider: "local" });

      const result = await service.triggerSpeechProcessing(
        RECORDING_ID,
        ASSESSMENT_ITEM_ID,
        "春眠不觉晓",
        SCHOOL_ID,
      );

      expect(result.provider).toBe("local");
      expect(result.status).toBe("CREATED");
    });

    it.each(["iflytek", "tencent"] as const)(
      "recognizes %s as a provider-neutral queue target",
      async (speechProvider) => {
        const { service } = await buildService({ speechProvider });
        const result = await service.triggerSpeechProcessing(
          RECORDING_ID,
          ASSESSMENT_ITEM_ID,
          "春眠不觉晓",
          SCHOOL_ID,
        );
        expect(result.provider).toBe(speechProvider);
        expect(result.status).toBe("CREATED");
      },
    );

    it("reuses an existing non-failed job without creating a duplicate", async () => {
      const existingJob = makeJob({ status: "PROCESSING" });
      const { service, fakePrisma } = await buildService({
        existingSpeechJob: existingJob,
      });

      const result = await service.triggerSpeechProcessing(
        RECORDING_ID,
        ASSESSMENT_ITEM_ID,
        "春眠不觉晓",
        SCHOOL_ID,
      );

      expect(result.id).toBe(JOB_ID);
      expect(result.status).toBe("PROCESSING");
      const speechJobModel = fakePrisma.speechJob;
      if (!speechJobModel) throw new Error("speech job fake was not configured");
      expect(speechJobModel.create).not.toHaveBeenCalled();
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
