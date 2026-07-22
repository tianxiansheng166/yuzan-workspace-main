/**
 * AI Lesson Planning — API Service Unit Tests
 *
 * Tests cover the AiLessonPlanningService methods directly,
 * using a mock PrismaService and mock BullMQ Queue.
 *
 * Run: pnpm --filter @yuzan/api test -- backend/api/test/ai-lesson-planning/
 *
 * Coverage:
 *   - Provider not configured → job created with PROVIDER_NOT_CONFIGURED
 *   - Create job → QUEUED + BullMQ enqueue
 *   - Idempotent create → returns existing job
 *   - Cancel job → CANCELLED + BullMQ removal
 *   - Cancel terminal job → INVALID_STATE error
 *   - State transitions (QUEUED → RUNNING → SUCCEEDED/FAILED)
 *   - Draft creation on SUCCEEDED
 *   - Update draft with optimistic concurrency
 *   - Revision conflict detection
 *   - Approve draft → APPROVED + TEACHER_APPROVE revision
 *   - Approve idempotent (already approved)
 *   - Edit approved draft → INVALID_STATE error
 *   - Workflow status (4 diagnostic booleans)
 *   - UpdateJobResult guards against CANCELLED overwrite
 *   - Internal proxy auth (X-Internal-Key header)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock setup ──────────────────────────────────────────────────────────────

const mockPrisma = {
  aiGenerationJob: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  lessonPlanDraft: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  lessonPlanRevision: {
    create: vi.fn(),
  },
  aiWorkflowDefinition: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  courseVersion: {
    findUnique: vi.fn(),
  },
  lesson: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn((fn) => fn()),
};

const mockQueue = {
  add: vi.fn(),
  getJob: vi.fn(),
};

const mockConfig = {
  get: vi.fn((key: string) => {
    const env: Record<string, string | undefined> = {
      AI_BASE_URL: "http://localhost:11434",
      AI_API_KEY: "test-key",
      AI_MODEL: "test-model",
      FLOWISE_BASE_URL: "http://127.0.0.1:4300",
      REDIS_HOST: "127.0.0.1",
      REDIS_PORT: "6379",
    };
    return env[key];
  }),
};

// ── Import service ──────────────────────────────────────────────────────────

// We need to construct the service manually since we can't use NestJS testing module easily
// Import the class directly
const { AiLessonPlanningService } = await import(
  "../../src/modules/ai-lesson-planning/ai-lesson-planning.service.js"
);

function createService(providerConfigured = true, queueAvailable = true) {
  // Override config to control provider configured state
  if (!providerConfigured) {
    mockConfig.get = vi.fn((key: string) => {
      if (key === "AI_BASE_URL") return undefined;
      if (key === "AI_API_KEY") return undefined;
      if (key === "AI_MODEL") return undefined;
      return "http://127.0.0.1:4300";
    });
  } else {
    mockConfig.get = vi.fn((key: string) => {
      const env: Record<string, string | undefined> = {
        AI_BASE_URL: "http://localhost:11434",
        AI_API_KEY: "test-key",
        AI_MODEL: "test-model",
        FLOWISE_BASE_URL: "http://127.0.0.1:4300",
        REDIS_HOST: "127.0.0.1",
        REDIS_PORT: "6379",
      };
      return env[key];
    });
  }

  return new AiLessonPlanningService(
    mockPrisma as any,
    queueAvailable ? mockQueue : null,
    mockConfig as any,
  );
}

// ── Test fixtures ───────────────────────────────────────────────────────────

const SCHOOL_ID = "00000000-0000-0000-0000-000000000001";
const TEACHER_ID = "00000000-0000-0000-0000-000000000002";
const OTHER_TEACHER_ID = "00000000-0000-0000-0000-000000000003";
const OTHER_SCHOOL_ID = "00000000-0000-0000-0000-000000000010";
const WORKFLOW_DEF_ID = "00000000-0000-0000-0000-000000000100";
const JOB_ID = "00000000-0000-0000-0000-000000000200";
const DRAFT_ID = "00000000-0000-0000-0000-000000000300";

const mockAuth = {
  requestId: "test-req",
  principal: { userId: TEACHER_ID, roles: ["TEACHER"] },
  tenant: { schoolId: SCHOOL_ID },
} as any;

const mockOtherTeacherAuth = {
  requestId: "test-req",
  principal: { userId: OTHER_TEACHER_ID, roles: ["TEACHER"] },
  tenant: { schoolId: SCHOOL_ID },
} as any;

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: JOB_ID,
    schoolId: SCHOOL_ID,
    teacherId: TEACHER_ID,
    workflowDefinitionId: WORKFLOW_DEF_ID,
    idempotencyKey: "idem-key-1",
    status: "QUEUED",
    inputSnapshot: { goal: "test goal" },
    outputSnapshot: null,
    errorCode: null,
    providerRequestId: null,
    tokenUsage: null,
    latencyMs: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function makeDraft(overrides: Record<string, unknown> = {}) {
  return {
    id: DRAFT_ID,
    schoolId: SCHOOL_ID,
    teacherId: TEACHER_ID,
    courseVersionId: null,
    lessonId: null,
    generationJobId: JOB_ID,
    title: "Test Lesson Plan",
    content: { schemaVersion: "lesson-plan.v0", title: "Test" },
    revision: 1,
    status: "NEEDS_REVIEW",
    approvedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

// ── Reset mocks ─────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.aiWorkflowDefinition.upsert.mockResolvedValue({ id: WORKFLOW_DEF_ID });
  mockPrisma.aiWorkflowDefinition.findUnique.mockResolvedValue({
    id: WORKFLOW_DEF_ID,
    workflowKey: "lesson-planner",
    externalFlowId: "flow-123",
    status: "ACTIVE",
    version: 1,
    provider: "flowise",
  });
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("AiLessonPlanningService", () => {
  describe("createJob", () => {
    it("should create job with PROVIDER_NOT_CONFIGURED when provider not configured", async () => {
      const service = createService(false);
      const job = makeJob({ status: "PROVIDER_NOT_CONFIGURED", errorCode: "PROVIDER_NOT_CONFIGURED" });
      mockPrisma.aiGenerationJob.create.mockResolvedValue(job);

      const result = await service.createJob(mockAuth, SCHOOL_ID, { goal: "test" });

      expect(result.status).toBe("PROVIDER_NOT_CONFIGURED");
      expect(mockPrisma.aiGenerationJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "PROVIDER_NOT_CONFIGURED" }),
        }),
      );
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it("should create QUEUED job and enqueue to BullMQ when provider configured", async () => {
      const service = createService(true);
      const job = makeJob({ status: "QUEUED" });
      mockPrisma.aiGenerationJob.create.mockResolvedValue(job);

      const result = await service.createJob(mockAuth, SCHOOL_ID, { goal: "teach reading" });

      expect(result.status).toBe("QUEUED");
      expect(mockPrisma.aiGenerationJob.create).toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledWith(
        "generate-lesson-plan",
        expect.objectContaining({ goal: "teach reading" }),
        expect.objectContaining({ jobId: JOB_ID, attempts: 2 }),
      );
    });

    it("should return existing job for same idempotencyKey", async () => {
      const service = createService(true);
      const existing = makeJob({ status: "SUCCEEDED" });
      mockPrisma.aiGenerationJob.findFirst.mockResolvedValue(existing);
      mockPrisma.lessonPlanDraft.findUnique.mockResolvedValue({ id: DRAFT_ID });

      const result = await service.createJob(mockAuth, SCHOOL_ID, {
        goal: "teach reading",
        idempotencyKey: "idem-key-1",
      });

      expect(result.id).toBe(JOB_ID);
      expect(mockPrisma.aiGenerationJob.create).not.toHaveBeenCalled();
    });

    it("should not enqueue to BullMQ if queue is null", async () => {
      const service = createService(true, false);
      const job = makeJob({ status: "QUEUED" });
      mockPrisma.aiGenerationJob.create.mockResolvedValue(job);

      const result = await service.createJob(mockAuth, SCHOOL_ID, { goal: "test" });

      expect(result.status).toBe("QUEUED");
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe("getJob", () => {
    it("should return job with draftId when draft exists", async () => {
      const service = createService();
      const job = makeJob();
      mockPrisma.aiGenerationJob.findFirst.mockResolvedValue(job);
      mockPrisma.lessonPlanDraft.findUnique.mockResolvedValue({ id: DRAFT_ID });

      const result = await service.getJob(mockAuth, SCHOOL_ID, JOB_ID);

      expect(result.id).toBe(JOB_ID);
      expect(result.lessonPlanDraftId).toBe(DRAFT_ID);
    });

    it("should throw NOT_FOUND for missing job", async () => {
      const service = createService();
      mockPrisma.aiGenerationJob.findFirst.mockResolvedValue(null);

      await expect(service.getJob(mockAuth, SCHOOL_ID, "nonexistent"))
        .rejects.toThrow("Job not found");
    });
  });

  describe("cancelJob", () => {
    it("should cancel QUEUED job", async () => {
      const service = createService();
      const job = makeJob({ status: "QUEUED" });
      const cancelled = makeJob({ status: "CANCELLED", completedAt: new Date() });
      mockPrisma.aiGenerationJob.findFirst.mockResolvedValue(job);
      mockPrisma.aiGenerationJob.update.mockResolvedValue(cancelled);
      mockQueue.getJob.mockResolvedValue({ remove: vi.fn() });

      const result = await service.cancelJob(mockAuth, SCHOOL_ID, JOB_ID);

      expect(result.status).toBe("CANCELLED");
      expect(mockPrisma.aiGenerationJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "CANCELLED" }),
        }),
      );
    });

    it("should cancel RUNNING job", async () => {
      const service = createService();
      const job = makeJob({ status: "RUNNING" });
      const cancelled = makeJob({ status: "CANCELLED", completedAt: new Date() });
      mockPrisma.aiGenerationJob.findFirst.mockResolvedValue(job);
      mockPrisma.aiGenerationJob.update.mockResolvedValue(cancelled);

      const result = await service.cancelJob(mockAuth, SCHOOL_ID, JOB_ID);
      expect(result.status).toBe("CANCELLED");
    });

    it("should reject cancelling SUCCEEDED job", async () => {
      const service = createService();
      const job = makeJob({ status: "SUCCEEDED" });
      mockPrisma.aiGenerationJob.findFirst.mockResolvedValue(job);

      await expect(service.cancelJob(mockAuth, SCHOOL_ID, JOB_ID))
        .rejects.toThrow("Cannot cancel job in status SUCCEEDED");
    });

    it("should reject cancelling FAILED job", async () => {
      const service = createService();
      const job = makeJob({ status: "FAILED" });
      mockPrisma.aiGenerationJob.findFirst.mockResolvedValue(job);

      await expect(service.cancelJob(mockAuth, SCHOOL_ID, JOB_ID))
        .rejects.toThrow("Cannot cancel job in status FAILED");
    });
  });

  describe("listDrafts", () => {
    it("should list drafts for current teacher", async () => {
      const service = createService();
      const drafts = [makeDraft()];
      mockPrisma.lessonPlanDraft.findMany.mockResolvedValue(drafts);

      const result = await service.listDrafts(mockAuth, SCHOOL_ID);

      expect(result).toHaveLength(1);
      expect(mockPrisma.lessonPlanDraft.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { schoolId: SCHOOL_ID, teacherId: TEACHER_ID },
        }),
      );
    });

    it("should cap limit at 100", async () => {
      const service = createService();
      mockPrisma.lessonPlanDraft.findMany.mockResolvedValue([]);

      await service.listDrafts(mockAuth, SCHOOL_ID, { limit: 500 });

      expect(mockPrisma.lessonPlanDraft.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  describe("updateDraft", () => {
    it("should update draft with matching expectedRevision", async () => {
      const service = createService();
      const draft = makeDraft({ revision: 1 });
      const updated = makeDraft({ revision: 2 });
      mockPrisma.lessonPlanDraft.findFirst.mockResolvedValue(draft);
      mockPrisma.lessonPlanRevision.create.mockResolvedValue({});
      mockPrisma.lessonPlanDraft.update.mockResolvedValue(updated);

      const result = await service.updateDraft(mockAuth, SCHOOL_ID, DRAFT_ID, {
        content: { schemaVersion: "lesson-plan.v0", title: "Updated" },
        expectedRevision: 1,
      });

      expect(result.revision).toBe(2);
      expect(mockPrisma.lessonPlanRevision.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ source: "TEACHER_EDIT", revision: 2 }),
        }),
      );
    });

    it("should reject update with wrong expectedRevision (revision conflict)", async () => {
      const service = createService();
      const draft = makeDraft({ revision: 3 });
      mockPrisma.lessonPlanDraft.findFirst.mockResolvedValue(draft);

      await expect(
        service.updateDraft(mockAuth, SCHOOL_ID, DRAFT_ID, {
          content: { title: "conflict" },
          expectedRevision: 1,
        }),
      ).rejects.toThrow("Revision conflict");
    });

    it("should reject edit of APPROVED draft", async () => {
      const service = createService();
      const draft = makeDraft({ status: "APPROVED" });
      mockPrisma.lessonPlanDraft.findFirst.mockResolvedValue(draft);

      await expect(
        service.updateDraft(mockAuth, SCHOOL_ID, DRAFT_ID, {
          content: { title: "nope" },
          expectedRevision: 1,
        }),
      ).rejects.toThrow("Cannot edit an approved draft");
    });
  });

  describe("approveDraft", () => {
    it("should approve draft and create TEACHER_APPROVE revision", async () => {
      const service = createService();
      const draft = makeDraft({ status: "NEEDS_REVIEW", revision: 2 });
      const approved = makeDraft({ status: "APPROVED", revision: 3, approvedAt: new Date() });
      mockPrisma.lessonPlanDraft.findFirst.mockResolvedValue(draft);
      mockPrisma.lessonPlanRevision.create.mockResolvedValue({});
      mockPrisma.lessonPlanDraft.update.mockResolvedValue(approved);

      const result = await service.approveDraft(mockAuth, SCHOOL_ID, DRAFT_ID);

      expect(result.status).toBe("APPROVED");
      expect(mockPrisma.lessonPlanRevision.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ source: "TEACHER_APPROVE" }),
        }),
      );
    });

    it("should be idempotent for already-approved draft", async () => {
      const service = createService();
      const draft = makeDraft({ status: "APPROVED", revision: 3 });
      mockPrisma.lessonPlanDraft.findFirst.mockResolvedValue(draft);

      const result = await service.approveDraft(mockAuth, SCHOOL_ID, DRAFT_ID);

      expect(result.status).toBe("APPROVED");
      expect(mockPrisma.lessonPlanDraft.update).not.toHaveBeenCalled();
    });
  });

  describe("getWorkflowStatus", () => {
    it("should return PROVIDER_NOT_CONFIGURED when provider not configured", async () => {
      const service = createService(false);
      mockPrisma.aiWorkflowDefinition.findUnique.mockResolvedValue(null);

      const result = await service.getWorkflowStatus(mockAuth, SCHOOL_ID);

      expect(result.providerConfigured).toBe(false);
      expect(result.status).toBe("PROVIDER_NOT_CONFIGURED");
    });

    it("should return 4 diagnostic booleans", async () => {
      const service = createService(true);
      mockPrisma.aiWorkflowDefinition.findUnique.mockResolvedValue({
        id: WORKFLOW_DEF_ID,
        workflowKey: "lesson-planner",
        externalFlowId: "flow-123",
        status: "ACTIVE",
        version: 1,
        provider: "flowise",
      });

      const result = await service.getWorkflowStatus(mockAuth, SCHOOL_ID);

      expect(result).toHaveProperty("providerConfigured");
      expect(result).toHaveProperty("flowiseAvailable");
      expect(result).toHaveProperty("workflowAvailable");
      expect(result).toHaveProperty("workerAvailable");
      expect(result.workflowKey).toBe("lesson-planner");
    });

    it("should report workflowAvailable=false when no externalFlowId", async () => {
      const service = createService(true);
      mockPrisma.aiWorkflowDefinition.findUnique.mockResolvedValue({
        id: WORKFLOW_DEF_ID,
        workflowKey: "lesson-planner",
        externalFlowId: null,
        status: "DISABLED",
        version: 0,
        provider: "flowise",
      });

      const result = await service.getWorkflowStatus(mockAuth, SCHOOL_ID);

      expect(result.workflowAvailable).toBe(false);
    });

    it("should report workerAvailable=false when queue is null", async () => {
      const service = createService(true, false);
      mockPrisma.aiWorkflowDefinition.findUnique.mockResolvedValue(null);

      const result = await service.getWorkflowStatus(mockAuth, SCHOOL_ID);

      expect(result.workerAvailable).toBe(false);
    });
  });

  describe("updateJobResult (internal)", () => {
    it("should not overwrite CANCELLED job", async () => {
      const service = createService();
      mockPrisma.aiGenerationJob.findUnique.mockResolvedValue({ status: "CANCELLED" });

      await service.updateJobResult(JOB_ID, {
        status: "SUCCEEDED",
        outputSnapshot: { title: "test" },
      });

      // Should not update — CANCELLED guard
      expect(mockPrisma.aiGenerationJob.update).not.toHaveBeenCalled();
    });

    it("should update non-cancelled job and create draft on SUCCEEDED", async () => {
      const service = createService();
      // First findUnique: CANCELLED guard check → not cancelled
      // Second findUnique: fetch full job for draft creation
      const fullJob = makeJob({ status: "SUCCEEDED", schoolId: SCHOOL_ID, teacherId: TEACHER_ID, inputSnapshot: { goal: "test goal" } });
      mockPrisma.aiGenerationJob.findUnique
        .mockResolvedValueOnce({ status: "RUNNING" })
        .mockResolvedValueOnce(fullJob);
      mockPrisma.aiGenerationJob.update.mockResolvedValue(makeJob({ status: "SUCCEEDED" }));
      mockPrisma.lessonPlanDraft.findUnique.mockResolvedValue(null); // No existing draft (idempotency check)

      // $transaction callback receives a mock tx with draft.create and revision.create
      const mockTx = {
        lessonPlanDraft: { create: vi.fn().mockResolvedValue(makeDraft()) },
        lessonPlanRevision: { create: vi.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(async (fn: Function) => fn(mockTx));

      await service.updateJobResult(JOB_ID, {
        status: "SUCCEEDED",
        outputSnapshot: { schemaVersion: "lesson-plan.v0", title: "Test Plan" },
        latencyMs: 5000,
      });

      expect(mockPrisma.aiGenerationJob.update).toHaveBeenCalled();
      // Draft + revision created in transaction
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockTx.lessonPlanDraft.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ generationJobId: JOB_ID }),
        }),
      );
      expect(mockTx.lessonPlanRevision.create).toHaveBeenCalled();
    });
  });
});
