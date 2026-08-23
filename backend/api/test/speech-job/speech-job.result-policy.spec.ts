import { describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { SpeechJobService } from "../../src/modules/speech-job/speech-job.service.js";
import { SPEECH_QUEUE } from "../../src/modules/speech-job/speech-job.tokens.js";
import { PrismaService } from "../../src/shared/database/prisma.service.js";

const JOB_ID = "job-00000-0000-0000-000000000001";
const RECORDING_ID = "rec-00000-0000-0000-000000000001";
const ITEM_ID = "item-0000-0000-0000-000000000001";
const SCHOOL_ID = "school-a-0000-0000-000000000000";
const SESSION_ID = "session-0000-0000-0000-000000000001";

const providerResult = {
  provider: "local",
  scorerVersion: "mandarin-reading-v0.1.0",
  confidence: 0.82,
  scores: {
    accuracy: 84,
    completeness: 78,
    fluency: 80,
    tone: 71,
    overall: 80,
  },
  requiresReview: false,
  experimental: true,
  toneMeta: {
    experimental: true,
    method: "f0_cv_heuristic",
    reason: null,
  },
  transcript: "春眠不觉晓",
  errors: [],
  processingMs: 12,
};

const openProviderResult = {
  provider: "local",
  strategy: "SPEECH_OPEN_RESPONSE",
  scorerVersion: "mandarin-open-response-v0.1.0",
  confidence: 0.86,
  diagnostics: {
    durationMs: 5000,
    speechDurationMs: 4200,
    speechRate: 3.2,
    silenceRatio: 0.16,
    fluency: 82,
    audioQuality: { acceptable: true, status: "ACCEPTABLE" },
  },
  requiresReview: true,
  experimental: true,
  transcript: "孩子在公园里玩耍",
  reasonCodes: ["SEMANTIC_REVIEW_REQUIRED"],
  errors: [],
  processingMs: 15,
};

function buildState(overrides: Record<string, unknown> = {}) {
  const defaultJob = {
    id: JOB_ID,
    recordingId: RECORDING_ID,
    assessmentItemId: ITEM_ID,
    schoolId: SCHOOL_ID,
    targetText: "春眠不觉晓",
    scorerVersion: "mandarin-reading-v0.1.0",
    status: "PROCESSING",
    provider: "local",
    providerModel: null,
    result: null,
    confidence: null,
    processingMs: null,
    retryCount: 0,
    errorCode: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
  const defaultItem = {
    id: ITEM_ID,
    recordingId: RECORDING_ID,
    maxScore: 4,
    scoredScore: null,
    questionVersionId: "version-0000-0000-0000-000000000001",
    session: { id: SESSION_ID, schoolId: SCHOOL_ID },
    questionVersion: {
      status: "PUBLISHED",
      scoringSpec: {
        strategy: "SPEECH_READING",
        targetText: "春眠不觉晓",
        maxScore: 4,
      },
    },
  };
  const state: any = {
    job: {
      ...defaultJob,
      ...((overrides.job as Record<string, unknown> | undefined) ?? {}),
    },
    item: {
      ...defaultItem,
      ...((overrides.item as Record<string, unknown> | undefined) ?? {}),
    },
    recording: {
      id: RECORDING_ID,
      schoolId: SCHOOL_ID,
      ...((overrides.recording as Record<string, unknown> | undefined) ?? {}),
    },
  };
  return state;
}

async function buildService(state: any) {
  const prisma: any = {
    speechJob: {
      findUnique: vi.fn(async () => ({
        ...state.job,
        recording: state.recording,
        assessmentItem: state.item,
      })),
      update: vi.fn(async ({ data }: any) => {
        state.job = {
          ...state.job,
          ...data,
          updatedAt: new Date("2026-01-02T00:00:00Z"),
        };
        return state.job;
      }),
    },
    assessmentItem: {
      update: vi.fn(async ({ data }: any) => {
        state.item = { ...state.item, ...data };
        return state.item;
      }),
    },
    recording: {
      update: vi.fn(async ({ data }: any) => {
        state.recording = { ...state.recording, ...data };
        return state.recording;
      }),
    },
  };
  prisma.$transaction = vi.fn(async (callback: (tx: any) => Promise<unknown>) =>
    callback(prisma),
  );

  const moduleRef = await Test.createTestingModule({
    providers: [
      { provide: PrismaService, useValue: prisma },
      { provide: ConfigService, useValue: { get: () => "local" } },
      { provide: SPEECH_QUEUE, useValue: null },
      SpeechJobService,
    ],
  }).compile();

  return { service: moduleRef.get(SpeechJobService), prisma };
}

describe("SpeechJobService read-aloud result policy", () => {
  it("writes a bounded diagnostic while keeping formal scoredScore null", async () => {
    const state = buildState();
    const { service, prisma } = await buildService(state);

    const result = await service.applySpeechProviderResult(
      JOB_ID,
      providerResult,
    );

    expect(result.status).toBe("NEEDS_REVIEW");
    expect(state.job.result).toMatchObject({
      provider: "local",
      scores: { overall: 80 },
    });
    expect(state.item.autoResult).toMatchObject({
      strategy: "SPEECH_READING",
      provider: "local",
      candidatePoints: 3.2,
      maxScore: 4,
      finalizable: false,
    });
    expect(state.item.scoredScore).toBeNull();
    expect(state.recording.status).toBe("READY");
    expect(state.item.autoResult).not.toHaveProperty("transcript");
    expect(state.item.autoResult).not.toHaveProperty("errors");
    expect(prisma.assessmentItem.update).toHaveBeenCalledTimes(1);
  });

  it("rejects a callback for a picture-speaking strategy before writing", async () => {
    const state = buildState();
    state.item.questionVersion.questionVersion = undefined;
    state.item.questionVersion.scoringSpec = {
      strategy: "SPEECH_OPEN_RESPONSE",
      maxScore: 4,
    };
    const { service, prisma } = await buildService(state);

    await expect(
      service.applySpeechProviderResult(JOB_ID, providerResult),
    ).rejects.toThrow();
    expect(prisma.assessmentItem.update).not.toHaveBeenCalled();
    expect(prisma.recording.update).not.toHaveBeenCalled();
  });

  it("accepts the same provider result idempotently and rejects a changed retry", async () => {
    const state = buildState();
    const { service, prisma } = await buildService(state);

    await service.applySpeechProviderResult(JOB_ID, providerResult);
    const second = await service.applySpeechProviderResult(
      JOB_ID,
      providerResult,
    );

    expect(second.status).toBe("NEEDS_REVIEW");
    expect(prisma.assessmentItem.update).toHaveBeenCalledTimes(1);
    expect(prisma.recording.update).toHaveBeenCalledTimes(1);

    await expect(
      service.applySpeechProviderResult(JOB_ID, {
        ...providerResult,
        scores: { ...providerResult.scores, overall: 81 },
      }),
    ).rejects.toThrow();
  });

  it("rejects a browser-supplied target mismatch against the persisted snapshot", async () => {
    const state = buildState({ job: { targetText: "被篡改的文本" } });
    const { service, prisma } = await buildService(state);

    await expect(
      service.applySpeechProviderResult(JOB_ID, providerResult),
    ).rejects.toThrow();
    expect(prisma.assessmentItem.update).not.toHaveBeenCalled();
  });

  it("stores picture-speaking evidence without candidate points or target text", async () => {
    const state = buildState({ job: { targetText: null }, item: { maxScore: 14 } });
    state.item.questionVersion.scoringSpec = {
      strategy: "SPEECH_OPEN_RESPONSE",
      maxScore: 14,
      rubric: ["内容完整", "语句通顺"],
    };
    const { service, prisma } = await buildService(state);

    const result = await service.applySpeechProviderResult(JOB_ID, openProviderResult);

    expect(result.status).toBe("NEEDS_REVIEW");
    expect(state.item.autoResult).toMatchObject({
      strategy: "SPEECH_OPEN_RESPONSE",
      state: "NEEDS_REVIEW",
      finalizable: false,
      diagnostics: { durationMs: 5000, speechRate: 3.2 },
    });
    expect(state.item.autoResult).not.toHaveProperty("transcript");
    expect(state.item.autoResult).not.toHaveProperty("candidatePoints");
    expect(state.job.result).toMatchObject({ strategy: "SPEECH_OPEN_RESPONSE", transcript: "孩子在公园里玩耍" });
    expect(prisma.assessmentItem.update).toHaveBeenCalledTimes(1);
  });
});
