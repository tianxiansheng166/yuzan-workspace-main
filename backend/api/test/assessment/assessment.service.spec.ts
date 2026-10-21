/**
 * Unit tests for AssessmentService.
 *
 * Covers the "golden closed loop" scenarios required by P0-TEST-FOUNDATION-001:
 *   - Normal assessment creation (teacher initiates)
 *   - Student/teacher access control (policy + ownership verification)
 *   - Cross-school access denial
 *   - State machine enforcement (valid and invalid transitions)
 *   - Idempotent complete (session lifecycle)
 *   - Recording ownership binding
 *
 * No database required — all repository ports and PrismaService are faked.
 */

import { describe, it, expect } from "vitest";
import { Test } from "@nestjs/testing";
import { AssessmentService } from "../../src/modules/assessment/assessment.service.js";
import { ASSESSMENT_SESSION_REPOSITORY } from "../../src/modules/assessment/ports/assessment-session-repository.port.js";
import { ASSESSMENT_ITEM_REPOSITORY } from "../../src/modules/assessment/ports/assessment-item-repository.port.js";
import { WRITTEN_ANSWER_REPOSITORY } from "../../src/modules/assessment/ports/written-answer-repository.port.js";
import { ASSESSMENT_REPORT_REPOSITORY } from "../../src/modules/assessment/ports/assessment-report-repository.port.js";
import { AssessmentModule } from "../../src/modules/assessment/assessment.module.js";
import { AssessmentNotFoundException } from "../../src/modules/assessment/domain/assessment.errors.js";
import { AssessmentForbiddenException } from "../../src/modules/assessment/domain/assessment.errors.js";
import { AssessmentConflictException } from "../../src/modules/assessment/domain/assessment.errors.js";
import type { AssessmentSession, AssessmentItem, AssessmentItemStatus, AssessmentSessionStatus, AssessmentReport } from "../../src/modules/assessment/domain/assessment.types.js";
import type { AssessmentSessionRepositoryPort, CreateAssessmentSessionData } from "../../src/modules/assessment/ports/assessment-session-repository.port.js";
import type { AssessmentItemRepositoryPort, CreateAssessmentItemData } from "../../src/modules/assessment/ports/assessment-item-repository.port.js";
import type { WrittenAnswerRepositoryPort, SaveWrittenAnswerData } from "../../src/modules/assessment/ports/written-answer-repository.port.js";
import type { AssessmentReportRepositoryPort, CreateAssessmentReportData } from "../../src/modules/assessment/ports/assessment-report-repository.port.js";
import { createFakePrismaService, createFakeDatabaseModule, type FakePrismaServiceOverrides } from "../helpers/fake-prisma.service.js";
import type { AuthContext, Principal, TenantContext } from "../../src/common/security/auth.types.js";
import { MembershipStatus } from "../../src/common/security/auth.types.js";
import { MembershipRole } from "../../src/common/security/membership-role.js";

// ─── Test fixtures ───────────────────────────────────────

const SCHOOL_A = "school-a-0000-0000-000000000000";
const SCHOOL_B = "school-b-0000-0000-000000000000";
const CLASS_ID = "class-0000-0000-0000-000000000001";
const TEACHER_ID = "teacher-000-0000-0000-000000000001";
const STUDENT_ID = "student-000-0000-0000-000000000001";
const ENROLLMENT_ID = "enroll-000-0000-0000-000000000001";
const SESSION_ID = "session-000-0000-0000-000000000001";
const ITEM_ID = "item-0000-0000-0000-000000000001";
const RECORDING_ID = "rec-00000-0000-0000-000000000001";

function makeAuth(userId: string, roles: MembershipRole[], schoolId: string): AuthContext {
  const principal: Principal = {
    userId,
    roles,
    membershipStatus: MembershipStatus.ACTIVE,
    source: "session",
  };
  const tenant: TenantContext = { schoolId };
  return { requestId: "test-req", principal, tenant };
}

const teacherAuthA = makeAuth(TEACHER_ID, [MembershipRole.TEACHER], SCHOOL_A);
const studentAuthA = makeAuth(STUDENT_ID, [MembershipRole.STUDENT], SCHOOL_A);
const teacherAuthB = makeAuth(TEACHER_ID, [MembershipRole.TEACHER], SCHOOL_B);
const adminAuthA = makeAuth("admin-0000-0000-0000-000000000001", [MembershipRole.SCHOOL_ADMIN], SCHOOL_A);

const now = new Date("2026-01-01T00:00:00Z");

function makeSession(overrides: Partial<AssessmentSession> = {}): AssessmentSession {
  return {
    id: SESSION_ID,
    schoolId: SCHOOL_A,
    enrollmentId: ENROLLMENT_ID,
    classId: CLASS_ID,
    initiatorUserId: TEACHER_ID,
    type: "READING",
    purpose: "STANDARD",
    status: "CREATED",
    startedAt: null,
    submittedAt: null,
    completedAt: null,
    retestOfSessionId: null,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeItem(overrides: Partial<AssessmentItem> = {}): AssessmentItem {
  return {
    id: ITEM_ID,
    sessionId: SESSION_ID,
    questionId: null,
    questionVersionId: null,
    recordingId: null,
    prompt: { text: "Read the passage" },
    itemType: "READING",
    status: "PENDING",
    sortOrder: 1,
    maxScore: 100,
    scoredScore: null,
    autoResult: null,
    reviewerUserId: null,
    reviewerComment: null,
    reviewedAt: null,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ─── Fake repositories ───────────────────────────────────

function createFakeSessionRepo(initialSession: AssessmentSession | null = null): AssessmentSessionRepositoryPort & { _setSession(session: AssessmentSession | null): void } {
  let session = initialSession;

  return {
    _setSession(s: AssessmentSession | null) { session = s; },
    findById: () => Promise.resolve(session),
    findByIdAndSchool: (id: string, schoolId: string) => {
      return Promise.resolve(session && session.id === id && session.schoolId === schoolId ? session : null);
    },
    list: () => Promise.resolve({ items: session ? [session] : [], nextCursor: null, hasMore: false }),
    create: (data: CreateAssessmentSessionData) => {
      session = makeSession({
        id: SESSION_ID,
        schoolId: data.schoolId,
        enrollmentId: data.enrollmentId,
        classId: data.classId,
        initiatorUserId: data.initiatorUserId,
        type: data.type,
        retestOfSessionId: data.retestOfSessionId ?? null,
      });
      return Promise.resolve(session);
    },
    updateStatus: (id: string, status: AssessmentSessionStatus, extra?: Partial<AssessmentSession>) => {
      if (!session) return Promise.reject(new Error("cannot update a missing fake session"));
      session = { ...session, ...extra, id, status, updatedAt: new Date() };
      return Promise.resolve(session);
    },
  };
}

function createFakeItemRepo(initialItems: AssessmentItem[] | null = null): AssessmentItemRepositoryPort & { _setItems(items: AssessmentItem[]): void } {
  let items = initialItems ?? [makeItem()];

  return {
    _setItems(i: AssessmentItem[]) { items = i; },
    findBySessionId: () => Promise.resolve(items),
    findById: (id: string) => Promise.resolve(items.find((i) => i.id === id) ?? null),
    findByIdAndSession: (id: string, sessionId: string) =>
      Promise.resolve(items.find((i) => i.id === id && i.sessionId === sessionId) ?? null),
    createMany: (data: CreateAssessmentItemData[]) => {
      items = data.map((d, idx) => makeItem({ id: `item-${idx}`, ...d }));
      return Promise.resolve(items);
    },
    updateRecordingId: (itemId: string, recordingId: string) => {
      const item = items.find((i) => i.id === itemId);
      return Promise.resolve(item ? { ...item, recordingId } : makeItem({ recordingId }));
    },
    updateStatus: (itemId: string, status: AssessmentItemStatus) => {
      const item = items.find((i) => i.id === itemId);
      return Promise.resolve(item ? { ...item, status } : makeItem({ status }));
    },
    updateScore: () => Promise.resolve(makeItem()),
  };
}

function createFakeAnswerRepo(): WrittenAnswerRepositoryPort {
  return {
    findByItemId: () => Promise.resolve(null),
    findBySessionId: () => Promise.resolve([]),
    upsert: (data: SaveWrittenAnswerData) => Promise.resolve({
      id: "answer-001",
      itemId: data.itemId,
      content: data.content,
      wordCount: data.wordCount,
      charCount: data.charCount,
      autoSavedAt: null,
      finalSubmittedAt: null,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    }),
    finalize: (itemId: string) => Promise.resolve({
      id: "answer-001",
      itemId,
      content: { text: "answer" },
      wordCount: 10,
      charCount: 50,
      autoSavedAt: now,
      finalSubmittedAt: now,
      revision: 2,
      createdAt: now,
      updatedAt: now,
    }),
  };
}

function createFakeReportRepo(): AssessmentReportRepositoryPort {
  return {
    findBySessionId: () => Promise.resolve(null),
    create: (data: CreateAssessmentReportData): Promise<AssessmentReport> => Promise.resolve({
      id: "report-001",
      sessionId: data.sessionId,
      schoolId: data.schoolId,
      overallScore: data.overallScore ?? null,
      readingScore: data.readingScore ?? null,
      writtenScore: data.writtenScore ?? null,
      summary: data.summary ?? null,
      recommendations: data.recommendations ?? null,
      dataCompleteness: data.dataCompleteness ?? 1.0,
      generatedAt: now,
      generatedByUserId: data.generatedByUserId ?? null,
      createdAt: now,
      updatedAt: now,
    }),
  };
}

// ─── Module builder ──────────────────────────────────────
// Each test scenario creates its own module with the exact
// fake overrides it needs — no shared mutable state.

interface BuildOptions {
  prismaOverrides?: FakePrismaServiceOverrides;
  sessionRepo?: ReturnType<typeof createFakeSessionRepo>;
  itemRepo?: ReturnType<typeof createFakeItemRepo>;
  reportRepo?: AssessmentReportRepositoryPort;
  answerRepo?: WrittenAnswerRepositoryPort;
}

async function buildService(opts: BuildOptions = {}): Promise<{
  service: AssessmentService;
  sessionRepo: ReturnType<typeof createFakeSessionRepo>;
  itemRepo: ReturnType<typeof createFakeItemRepo>;
}> {
  const sessionRepo = opts.sessionRepo ?? createFakeSessionRepo();
  const itemRepo = opts.itemRepo ?? createFakeItemRepo();
  const answerRepo = opts.answerRepo ?? createFakeAnswerRepo();
  const reportRepo = opts.reportRepo ?? createFakeReportRepo();

  const fakePrisma = createFakePrismaService({
    enrollment: {
      findFirst: () => ({ id: ENROLLMENT_ID }),
      findMany: () => [{ id: ENROLLMENT_ID }],
    },
    recording: {
      findFirst: () => ({ id: RECORDING_ID }),
    },
    question: {
      findUnique: () => ({ prompt: { text: "question" } }),
    },
    auditLog: { create: () => ({}) },
    deviceCheckLog: { create: () => ({}) },
    assessmentItem: { update: () => ({}) },
    ...opts.prismaOverrides,
  });

  const moduleRef = await Test.createTestingModule({
    imports: [
      createFakeDatabaseModule(fakePrisma),
      AssessmentModule,
    ],
  })
    .overrideProvider(ASSESSMENT_SESSION_REPOSITORY)
    .useValue(sessionRepo)
    .overrideProvider(ASSESSMENT_ITEM_REPOSITORY)
    .useValue(itemRepo)
    .overrideProvider(WRITTEN_ANSWER_REPOSITORY)
    .useValue(answerRepo)
    .overrideProvider(ASSESSMENT_REPORT_REPOSITORY)
    .useValue(reportRepo)
    .compile();

  const service = moduleRef.get(AssessmentService);
  return { service, sessionRepo, itemRepo };
}

// ─── Test suite ──────────────────────────────────────────

describe("AssessmentService", () => {
  // ─── 1. Normal assessment creation ────────────────────

  describe("createSession", () => {
    it("creates a session when a teacher initiates for their class", async () => {
      const { service } = await buildService();
      const result = await service.createSession(teacherAuthA, SCHOOL_A, {
        enrollmentId: ENROLLMENT_ID,
        classId: CLASS_ID,
        type: "READING",
      });

      expect(result).toBeDefined();
      expect(result.type).toBe("READING");
      expect(result.status).toBe("CREATED");
      expect(result.schoolId).toBe(SCHOOL_A);
    });

    it("allows school admin to create session for any class", async () => {
      const { service } = await buildService({
        // Admin has no teacher enrollment but should still pass
        prismaOverrides: {
          enrollment: { findFirst: () => null, findMany: () => [] },
        },
      });
      const result = await service.createSession(adminAuthA, SCHOOL_A, {
        enrollmentId: ENROLLMENT_ID,
        classId: CLASS_ID,
        type: "WRITTEN",
      });

      expect(result).toBeDefined();
      expect(result.type).toBe("WRITTEN");
    });

    it("rejects student creating a session", async () => {
      const { service } = await buildService();
      await expect(
        service.createSession(studentAuthA, SCHOOL_A, {
          enrollmentId: ENROLLMENT_ID,
          classId: CLASS_ID,
          type: "READING",
        }),
      ).rejects.toThrow(AssessmentForbiddenException);
    });

    it("rejects teacher not assigned to the class", async () => {
      const { service } = await buildService({
        // No enrollment found for this teacher, and user is not admin
        prismaOverrides: {
          enrollment: { findFirst: () => null, findMany: () => [] },
        },
      });
      const unassignedTeacher = makeAuth("unassigned-teacher", [MembershipRole.TEACHER], SCHOOL_A);

      await expect(
        service.createSession(unassignedTeacher, SCHOOL_A, {
          enrollmentId: ENROLLMENT_ID,
          classId: CLASS_ID,
          type: "READING",
        }),
      ).rejects.toThrow(AssessmentForbiddenException);
    });

    it("creates session with retest reference", async () => {
      const { service } = await buildService();
      const result = await service.createSession(teacherAuthA, SCHOOL_A, {
        enrollmentId: ENROLLMENT_ID,
        classId: CLASS_ID,
        type: "READING",
        retestOfSessionId: "original-session-id",
      });

      expect(result).toBeDefined();
    });
  });

  // ─── 2. Student/teacher access control ────────────────

  describe("getSession — access control", () => {
    it("allows teacher from same school to read", async () => {
      const { service, sessionRepo } = await buildService();
      sessionRepo._setSession(makeSession());
      const result = await service.getSession(teacherAuthA, SCHOOL_A, SESSION_ID);
      expect(result.id).toBe(SESSION_ID);
    });

    it("allows student from same school to read", async () => {
      const { service, sessionRepo } = await buildService();
      sessionRepo._setSession(makeSession());
      const result = await service.getSession(studentAuthA, SCHOOL_A, SESSION_ID);
      expect(result.id).toBe(SESSION_ID);
    });

    it("rejects teacher from different school (cross-school: policy denies, then not found)", async () => {
      const { service, sessionRepo } = await buildService();
      sessionRepo._setSession(makeSession());
      // teacherAuthB has tenant.schoolId = SCHOOL_B, but we pass SCHOOL_A as arg
      // Policy: canReadSession checks auth.tenant.schoolId === schoolId → SCHOOL_B !== SCHOOL_A → false → Forbidden
      await expect(
        service.getSession(teacherAuthB, SCHOOL_A, SESSION_ID),
      ).rejects.toThrow(AssessmentForbiddenException);
    });
  });

  // ─── 3. Cross-school access denial ────────────────────

  describe("cross-school denial", () => {
    it("createSession rejects when auth tenant schoolId differs", async () => {
      const { service } = await buildService();
      const wrongSchoolAuth = makeAuth(TEACHER_ID, [MembershipRole.TEACHER], SCHOOL_B);
      await expect(
        service.createSession(wrongSchoolAuth, SCHOOL_A, {
          enrollmentId: ENROLLMENT_ID,
          classId: CLASS_ID,
          type: "READING",
        }),
      ).rejects.toThrow(AssessmentForbiddenException);
    });

    it("listSessions rejects when auth tenant schoolId differs", async () => {
      const { service } = await buildService();
      const wrongSchoolAuth = makeAuth(TEACHER_ID, [MembershipRole.TEACHER], SCHOOL_B);
      await expect(
        service.listSessions(wrongSchoolAuth, SCHOOL_A, { limit: 10 }),
      ).rejects.toThrow(AssessmentForbiddenException);
    });

    it("startSession rejects cross-school access via policy", async () => {
      const { service, sessionRepo } = await buildService();
      sessionRepo._setSession(makeSession());
      const wrongSchoolAuth = makeAuth(STUDENT_ID, [MembershipRole.STUDENT], SCHOOL_B);
      await expect(
        service.startSession(wrongSchoolAuth, SCHOOL_A, SESSION_ID),
      ).rejects.toThrow(AssessmentForbiddenException);
    });
  });

  // ─── 4. State machine enforcement ────────────────────

  describe("startSession — state transitions", () => {
    it("transitions CREATED → IN_PROGRESS for owning student", async () => {
      const { service, sessionRepo } = await buildService();
      sessionRepo._setSession(makeSession({ status: "CREATED" }));
      const result = await service.startSession(studentAuthA, SCHOOL_A, SESSION_ID);
      expect(result.status).toBe("IN_PROGRESS");
      expect(result.startedAt).toBeTruthy();
    });

    it("rejects transition from COMPLETED → IN_PROGRESS", async () => {
      const { service, sessionRepo } = await buildService();
      sessionRepo._setSession(makeSession({ status: "COMPLETED" }));
      await expect(
        service.startSession(studentAuthA, SCHOOL_A, SESSION_ID),
      ).rejects.toThrow(AssessmentConflictException);
    });

    it("rejects transition from SUBMITTED → IN_PROGRESS", async () => {
      const { service, sessionRepo } = await buildService();
      sessionRepo._setSession(makeSession({ status: "SUBMITTED" }));
      await expect(
        service.startSession(studentAuthA, SCHOOL_A, SESSION_ID),
      ).rejects.toThrow(AssessmentConflictException);
    });

    it("rejects teacher from starting a session (policy: students only)", async () => {
      const { service, sessionRepo } = await buildService();
      sessionRepo._setSession(makeSession({ status: "CREATED" }));
      await expect(
        service.startSession(teacherAuthA, SCHOOL_A, SESSION_ID),
      ).rejects.toThrow(AssessmentForbiddenException);
    });
  });

  describe("submitSession — state transitions", () => {
    it("transitions IN_PROGRESS → SUBMITTED for owning student", async () => {
      const { service, sessionRepo } = await buildService({ itemRepo: createFakeItemRepo([makeItem({ recordingId: RECORDING_ID })]) });
      sessionRepo._setSession(makeSession({ status: "IN_PROGRESS" }));
      const result = await service.submitSession(studentAuthA, SCHOOL_A, SESSION_ID);
      expect(result.status).toBe("SUBMITTED");
      expect(result.submittedAt).toBeTruthy();
    });

    it("allows submit when uploaded evidence is not blocked by unsupported analysis", async () => {
      const { service, sessionRepo } = await buildService({
        itemRepo: createFakeItemRepo([makeItem({ recordingId: RECORDING_ID })]),
        prismaOverrides: { recording: { count: () => 0 } },
      });
      sessionRepo._setSession(makeSession({ status: "IN_PROGRESS" }));

      await expect(
        service.submitSession(studentAuthA, SCHOOL_A, SESSION_ID),
      ).resolves.toMatchObject({ status: "SUBMITTED" });
    });

    it("still blocks submit when a recording has a genuine upload failure", async () => {
      const { service, sessionRepo } = await buildService({
        itemRepo: createFakeItemRepo([makeItem({ recordingId: RECORDING_ID })]),
        prismaOverrides: { recording: { count: () => 1 } },
      });
      sessionRepo._setSession(makeSession({ status: "IN_PROGRESS" }));

      await expect(
        service.submitSession(studentAuthA, SCHOOL_A, SESSION_ID),
      ).rejects.toThrow("阻塞性的音频上传错误");
    });

    it("rejects transition from CREATED → SUBMITTED (must start first)", async () => {
      const { service, sessionRepo } = await buildService();
      sessionRepo._setSession(makeSession({ status: "CREATED" }));
      await expect(
        service.submitSession(studentAuthA, SCHOOL_A, SESSION_ID),
      ).rejects.toThrow(AssessmentConflictException);
    });

    it("returns the persisted state for an idempotent double submit", async () => {
      const { service, sessionRepo } = await buildService();
      sessionRepo._setSession(makeSession({ status: "SUBMITTED" }));
      await expect(service.submitSession(studentAuthA, SCHOOL_A, SESSION_ID)).resolves.toMatchObject({ status: "SUBMITTED" });
    });
  });

  // ─── 5. Idempotent complete (full lifecycle) ─────────

  describe("idempotent complete — full session lifecycle", () => {
    it("walks CREATED → IN_PROGRESS → SUBMITTED → PROCESSING → COMPLETED", async () => {
      const { service, sessionRepo } = await buildService({ itemRepo: createFakeItemRepo([makeItem({ recordingId: RECORDING_ID })]) });

      // CREATED → IN_PROGRESS
      sessionRepo._setSession(makeSession({ status: "CREATED" }));
      let result = await service.startSession(studentAuthA, SCHOOL_A, SESSION_ID);
      expect(result.status).toBe("IN_PROGRESS");

      // IN_PROGRESS → SUBMITTED
      sessionRepo._setSession(makeSession({ status: "IN_PROGRESS" }));
      result = await service.submitSession(studentAuthA, SCHOOL_A, SESSION_ID);
      expect(result.status).toBe("SUBMITTED");

      // SUBMITTED → PROCESSING (via repo directly)
      sessionRepo._setSession(makeSession({ status: "SUBMITTED" }));
      const processing = await sessionRepo.updateStatus(SESSION_ID, "PROCESSING");
      expect(processing.status).toBe("PROCESSING");

      // PROCESSING → COMPLETED
      sessionRepo._setSession(makeSession({ status: "PROCESSING" }));
      const completed = await sessionRepo.updateStatus(SESSION_ID, "COMPLETED", {
        completedAt: new Date(),
      });
      expect(completed.status).toBe("COMPLETED");
    });

    it("cannot restart a COMPLETED session", async () => {
      const { service, sessionRepo } = await buildService();
      sessionRepo._setSession(makeSession({ status: "COMPLETED" }));
      await expect(
        service.startSession(studentAuthA, SCHOOL_A, SESSION_ID),
      ).rejects.toThrow(AssessmentConflictException);
    });
  });

  // ─── 6. Recording ownership binding ──────────────────

  describe("attachRecording — ownership binding", () => {
    it("attaches recording that belongs to the student's enrollment", async () => {
      const { service, sessionRepo } = await buildService();
      sessionRepo._setSession(makeSession({ status: "IN_PROGRESS" }));

      const result = await service.attachRecording(
        studentAuthA, SCHOOL_A, SESSION_ID, ITEM_ID, RECORDING_ID,
      );
      expect(result).toBeDefined();
      expect(result.recordingId).toBe(RECORDING_ID);
    });

    it("rejects recording not belonging to the student", async () => {
      const { service, sessionRepo } = await buildService({
        prismaOverrides: {
          recording: { findFirst: () => null },
        },
      });
      sessionRepo._setSession(makeSession({ status: "IN_PROGRESS" }));

      await expect(
        service.attachRecording(studentAuthA, SCHOOL_A, SESSION_ID, ITEM_ID, RECORDING_ID),
      ).rejects.toThrow(AssessmentForbiddenException);
    });

    it("rejects when student does not own the session", async () => {
      const { service, sessionRepo } = await buildService({
        prismaOverrides: {
          enrollment: { findFirst: () => null, findMany: () => [] },
        },
      });
      sessionRepo._setSession(makeSession({ status: "IN_PROGRESS" }));

      await expect(
        service.attachRecording(studentAuthA, SCHOOL_A, SESSION_ID, ITEM_ID, RECORDING_ID),
      ).rejects.toThrow(AssessmentForbiddenException);
    });

    it("rejects when session not found", async () => {
      const { service, sessionRepo } = await buildService();
      sessionRepo._setSession(null);

      await expect(
        service.attachRecording(studentAuthA, SCHOOL_A, "nonexistent-session", ITEM_ID, RECORDING_ID),
      ).rejects.toThrow(AssessmentNotFoundException);
    });

    it("rejects when item not found in session", async () => {
      const { service, sessionRepo } = await buildService({
        itemRepo: createFakeItemRepo([]),
      });
      sessionRepo._setSession(makeSession({ status: "IN_PROGRESS" }));

      await expect(
        service.attachRecording(studentAuthA, SCHOOL_A, SESSION_ID, "nonexistent-item", RECORDING_ID),
      ).rejects.toThrow(); // AssessmentItemNotFoundException
    });
  });

  // ─── 7. Session not found ─────────────────────────────

  describe("getSession — not found", () => {
    it("throws AssessmentNotFoundException for missing session", async () => {
      const { service, sessionRepo } = await buildService();
      sessionRepo._setSession(null);
      await expect(
        service.getSession(teacherAuthA, SCHOOL_A, "nonexistent"),
      ).rejects.toThrow(AssessmentNotFoundException);
    });
  });

  // ─── 8. listSessions — student scoping ────────────────

  describe("listSessions — student scoping", () => {
    it("returns empty list for student with no enrollments", async () => {
      const { service } = await buildService({
        prismaOverrides: {
          enrollment: { findFirst: () => null, findMany: () => [] },
        },
      });
      const result = await service.listSessions(studentAuthA, SCHOOL_A, { limit: 10 });
      expect(result.items).toEqual([]);
      expect(result.hasMore).toBe(false);
    });

    it("scopes results to student's own enrollments", async () => {
      const { service, sessionRepo } = await buildService();
      sessionRepo._setSession(makeSession());
      const result = await service.listSessions(studentAuthA, SCHOOL_A, { limit: 10 });
      expect(result).toBeDefined();
    });
  });
});


describe("T099 optional unanswered submission", () => {
  it("accepts missing oral recordings and absent or unfinalized written rows", async () => {
    const { service, sessionRepo } = await buildService({
      itemRepo: createFakeItemRepo([makeItem(), makeItem({ id: "written", itemType: "WRITTEN" })]),
      prismaOverrides: { writtenAnswer: { findMany: () => [{ itemId: "written", content: { text: "persisted answer" }, finalSubmittedAt: null }] } },
    });
    sessionRepo._setSession(makeSession({ status: "IN_PROGRESS" }));
    const first = await service.submitSession(studentAuthA, SCHOOL_A, SESSION_ID);
    expect(first.status).toBe("SUBMITTED");
    expect(await service.submitSession(studentAuthA, SCHOOL_A, SESSION_ID)).toMatchObject({ status: "SUBMITTED", submittedAt: first.submittedAt });
  });

  it.each(["CREATED", "CANCELLED", "FAILED"] as const)("retains invalid-state denial for %s", async (status) => {
    const { service, sessionRepo } = await buildService();
    sessionRepo._setSession(makeSession({ status }));
    await expect(service.submitSession(studentAuthA, SCHOOL_A, SESSION_ID)).rejects.toThrow(AssessmentConflictException);
  });

  it("retains school, ownership, and empty-attempt denial", async () => {
    const { service, sessionRepo } = await buildService({ itemRepo: createFakeItemRepo([]) });
    sessionRepo._setSession(makeSession({ status: "IN_PROGRESS" }));
    await expect(service.submitSession(studentAuthA, SCHOOL_B, SESSION_ID)).rejects.toThrow(AssessmentForbiddenException);
    await expect(service.submitSession(studentAuthA, SCHOOL_A, SESSION_ID)).rejects.toThrow("没有可提交的题目");
    const other = await buildService({ prismaOverrides: { enrollment: { findFirst: () => null } } });
    other.sessionRepo._setSession(makeSession({ status: "IN_PROGRESS" }));
    await expect(other.service.submitSession(studentAuthA, SCHOOL_A, SESSION_ID)).rejects.toThrow(AssessmentForbiddenException);
  });
});


// Synthetic metadata only; no source corpus, database, or audio provider is read.
function unansweredQuestionBankRows() {
  const blueprint = [
    ["LISTEN_IMAGE_CHOICE", "LISTEN", 3, 3], ["DICTATION", "LISTEN", 3, 5],
    ["READ_ALOUD", "SPEAK", 3, 4], ["PICTURE_SPEAKING", "SPEAK", 1, 14],
    ["WORD_RECOGNITION", "READ", 3, 4], ["SENTENCE_COMPREHENSION", "READ", 3, 4],
    ["PICTURE_WORD", "WRITE", 2, 5], ["SENTENCE_COMPLETION", "WRITE", 2, 8],
  ] as const;
  let index = 0;
  return blueprint.flatMap(([family, domain, count, maxScore]) => Array.from({ length: count }, () => {
    index += 1;
    const oral = domain === "SPEAK";
    return {
      ...makeItem({ id: `qb-${index}`, questionVersionId: `version-${index}`, sortOrder: index, itemType: oral ? "SPEECH" : "WRITTEN", maxScore }),
      questionVersion: {
        status: "PUBLISHED", deliverySpec: { response: { type: oral ? "SPEECH" : "TEXT" } },
        scoringSpec: { strategy: oral ? "SPEECH_READING" : "ACCEPTED_TEXT", maxScore, acceptedAnswers: ["saved answer"] },
        item: { domain, questionType: family, level: "水平一级" },
      },
      writtenAnswer: null as { content: { text: string }; finalSubmittedAt: Date | null } | null,
      speechJobs: [] as Array<{ recordingId: string; status: string }>,
    };
  }));
}

async function buildQuestionBankService(rows: ReturnType<typeof unansweredQuestionBankRows>, purpose: "STANDARD" | "REMEDIATION" = "STANDARD") {
  const reports: CreateAssessmentReportData[] = [];
  const reportRepo = createFakeReportRepo();
  let speechWrites = 0;
  const finalizedAnswers: string[] = [];
  const answerRepo = createFakeAnswerRepo();
  const fixture = await buildService({
    itemRepo: createFakeItemRepo(rows),
    answerRepo: {
      ...answerRepo,
      findBySessionId: () => Promise.resolve(rows.flatMap(row => row.writtenAnswer ? [{
        id: `answer-${row.id}`, itemId: row.id, content: row.writtenAnswer.content,
        wordCount: 0, charCount: 0, autoSavedAt: now, finalSubmittedAt: row.writtenAnswer.finalSubmittedAt,
        revision: 1, createdAt: now, updatedAt: now,
      }] : [])),
      finalize: (itemId) => {
        finalizedAnswers.push(itemId);
        const row = rows.find(item => item.id === itemId);
        if (!row?.writtenAnswer) throw new Error("must not finalize a missing answer");
        row.writtenAnswer.finalSubmittedAt = now;
        return answerRepo.finalize(itemId);
      },
    },
    reportRepo: { ...reportRepo, create: (data) => { reports.push(data); return reportRepo.create(data); } },
    prismaOverrides: {
      assessmentItem: {
        findMany: () => rows,
        update: ({ where, data }: { where: { id: string }; data: { scoredScore: number | null; autoResult: Record<string, unknown> } }) => {
          const row = rows.find(item => item.id === where.id);
          if (!row) throw new Error("unknown fixture item");
          Object.assign(row, data);
          return row;
        },
      },
      speechJob: { create: () => { speechWrites += 1; throw new Error("must not invent speech jobs"); } },
    },
  });
  fixture.sessionRepo._setSession(makeSession({ status: "IN_PROGRESS", purpose, retestOfSessionId: purpose === "REMEDIATION" ? "original" : null }));
  return { ...fixture, reports, finalizedAnswers, speechWrites: () => speechWrites };
}

describe("T099 unanswered report lifecycle", () => {
  it("completes an all-blank valid formal attempt at zero without fake speech jobs", async () => {
    const rows = unansweredQuestionBankRows();
    const fixture = await buildQuestionBankService(rows);
    expect(await fixture.service.submitSession(studentAuthA, SCHOOL_A, SESSION_ID)).toMatchObject({ status: "COMPLETED" });
    expect(rows.every(item => item.scoredScore === 0)).toBe(true);
    expect(rows.every(item => (item.autoResult as Record<string, unknown>).reasonCode === "UNANSWERED")).toBe(true);
    expect(fixture.reports).toHaveLength(1);
    expect(fixture.reports[0]).toMatchObject({ overallScore: 0, dataCompleteness: 100, summary: { totalMaxPoints: 100, answeredItems: 0, unansweredItems: 20 } });
    expect(fixture.speechWrites()).toBe(0);
    await fixture.service.submitSession(studentAuthA, SCHOOL_A, SESSION_ID);
    expect(fixture.reports).toHaveLength(1);
  });

  it("completes all-blank remediation subsets without a formal report", async () => {
    const rows = unansweredQuestionBankRows().slice(5, 8);
    const fixture = await buildQuestionBankService(rows, "REMEDIATION");
    expect(await fixture.service.submitSession(studentAuthA, SCHOOL_A, SESSION_ID)).toMatchObject({ status: "COMPLETED" });
    expect(rows.every(item => item.scoredScore === 0)).toBe(true);
    expect(fixture.reports).toEqual([]);
    expect(fixture.speechWrites()).toBe(0);
  });

  it("scores real persisted unfinalized text and distinguishes an explicit clear", async () => {
    const rows = unansweredQuestionBankRows();
    rows[0]!.writtenAnswer = { content: { text: "saved answer" }, finalSubmittedAt: null };
    rows[1]!.writtenAnswer = { content: { text: " 　" }, finalSubmittedAt: now };
    rows[2]!.writtenAnswer = { content: { text: "wrong nonblank" }, finalSubmittedAt: now };
    const fixture = await buildQuestionBankService(rows);
    await fixture.service.submitSession(studentAuthA, SCHOOL_A, SESSION_ID);
    expect(fixture.finalizedAnswers).toEqual([rows[0]!.id]);
    expect(rows[0]!.scoredScore).toBe(3);
    expect(rows[1]!.autoResult).toMatchObject({ score: 0, reasonCode: "UNANSWERED" });
    expect(rows[2]!.autoResult).toMatchObject({ score: 0, metrics: { matched: false } });
    expect(rows[2]!.autoResult).not.toHaveProperty("reasonCode");
  });

  it.each(["PROCESSING", "NEEDS_REVIEW"])("retains %s for a real recording", async (status) => {
    const rows = unansweredQuestionBankRows();
    const oral = rows.find(item => item.itemType === "SPEECH")!;
    oral.recordingId = RECORDING_ID;
    oral.speechJobs = [{ recordingId: RECORDING_ID, status }];
    oral.autoResult = { state: status };
    const fixture = await buildQuestionBankService(rows);
    expect(await fixture.service.submitSession(studentAuthA, SCHOOL_A, SESSION_ID)).toMatchObject({ status: "PROCESSING" });
    expect(oral.scoredScore).toBeNull();
    expect(oral.autoResult).toEqual({ state: status });
    expect(fixture.reports).toHaveLength(0);
  });

  it("preserves a teacher score even when its real recording job still says review", async () => {
    const rows = unansweredQuestionBankRows();
    const oral = rows.find(item => item.itemType === "SPEECH")!;
    oral.recordingId = RECORDING_ID;
    oral.speechJobs = [{ recordingId: RECORDING_ID, status: "NEEDS_REVIEW" }];
    oral.scoredScore = 3;
    oral.reviewedAt = now;
    oral.reviewerUserId = TEACHER_ID;
    oral.autoResult = { teacherEvidence: true };
    const fixture = await buildQuestionBankService(rows);
    expect(await fixture.service.submitSession(studentAuthA, SCHOOL_A, SESSION_ID)).toMatchObject({ status: "COMPLETED" });
    expect(oral.scoredScore).toBe(3);
    expect(oral.autoResult).toEqual({ teacherEvidence: true });
    expect(fixture.reports[0]?.overallScore).toBe(3);
  });

  it("leaves invalid maximums pending without inventing report completeness", async () => {
    const rows = unansweredQuestionBankRows();
    rows[0]!.maxScore = null;
    const fixture = await buildQuestionBankService(rows);
    expect(await fixture.service.submitSession(studentAuthA, SCHOOL_A, SESSION_ID)).toMatchObject({ status: "PROCESSING" });
    expect(rows[0]!.scoredScore).toBeNull();
    expect(fixture.reports).toHaveLength(0);
  });
});
