/**
 * Unit tests for RecordingsService — ownership binding scenarios.
 *
 * Covers the "golden closed loop" recording scenarios required by P0-TEST-FOUNDATION-001:
 *   - Recording initialization with enrollment ownership verification
 *   - Cross-school denial
 *   - Non-student denial (only students can init/upload/complete)
 *   - Recording ownership binding (verifyEnrollmentOwnership)
 *   - Idempotent init (idempotencyKey)
 *   - Complete recording lifecycle (init → upload → complete)
 *   - Complete with missing file / zero-size file rejection
 *
 * No database required — all repository ports, StoragePort, and PrismaService are faked.
 */

import { describe, it, expect } from "vitest";
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { RecordingsService } from "../../src/modules/recordings/recordings.service.js";
import { RECORDING_REPOSITORY } from "../../src/modules/recordings/ports/recording-repository.port.js";
import { STORAGE_PORT } from "../../src/shared/storage/storage.port.js";
import {
  RecordingForbiddenException,
  RecordingNotFoundException,
  RecordingStatusException,
} from "../../src/modules/recordings/domain/recording.errors.js";
import type { Recording } from "../../src/modules/recordings/domain/recording.types.js";
import { createFakePrismaService, createFakeDatabaseModule } from "../helpers/fake-prisma.service.js";
import type { AuthContext, Principal, TenantContext } from "../../src/common/security/auth.types.js";
import { MembershipStatus } from "../../src/common/security/auth.types.js";
import { MembershipRole } from "../../src/common/security/membership-role.js";

// ─── Fixtures ───────────────────────────────────────────

const SCHOOL_A = "school-a-0000-0000-000000000000";
const SCHOOL_B = "school-b-0000-0000-000000000000";
const STUDENT_ID = "student-000-0000-0000-000000000001";
const ENROLLMENT_ID = "enroll-000-0000-0000-000000000001";
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

const studentAuthA = makeAuth(STUDENT_ID, [MembershipRole.STUDENT], SCHOOL_A);
const teacherAuthA = makeAuth("teacher-001", [MembershipRole.TEACHER], SCHOOL_A);
const studentAuthB = makeAuth(STUDENT_ID, [MembershipRole.STUDENT], SCHOOL_B);

const now = new Date("2026-01-01T00:00:00Z");

function makeRecording(overrides: Partial<Recording> = {}): Recording {
  return {
    id: RECORDING_ID,
    schoolId: SCHOOL_A,
    enrollmentId: ENROLLMENT_ID,
    status: "INITIALIZED",
    partCount: 1,
    uploadedParts: [],
    mimeType: "audio/webm",
    objectKey: `recordings/${RECORDING_ID}/full`,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ─── Fakes ──────────────────────────────────────────────

function createFakeRecordingRepo(initialRecording: Recording | null = null) {
  let recording = initialRecording;

  return {
    _setRecording(r: Recording | null) { recording = r; },
    findById: async (_schoolId: string, id: string) =>
      recording && recording.id === id ? recording : null,
    findByIdempotencyKey: async () => null,
    findBySubmissionId: async () => [],
    listByEnrollment: async () => ({ items: recording ? [recording] : [], nextCursor: null, hasMore: false }),
    save: async (input: any) => {
      recording = makeRecording({
        id: RECORDING_ID,
        schoolId: input.schoolId,
        enrollmentId: input.enrollmentId,
        partCount: input.partCount ?? 1,
        mimeType: input.mimeType,
      });
      return recording;
    },
    updateStatus: async (_schoolId: string, id: string, status: any) => {
      if (recording) recording = { ...recording, status } as Recording;
      return recording!;
    },
    updateUploadedParts: async () => {
      if (recording) recording = { ...recording, uploadedParts: [1] } as Recording;
      return recording!;
    },
    completeRecording: async (_schoolId: string, id: string, input: any, _rev: number) => {
      if (recording) recording = { ...recording, status: "COMPLETE", objectKey: input.objectKey ?? recording.objectKey } as Recording;
      return recording!;
    },
  };
}

function createFakeStorage() {
  return {
    generateUploadUrl: async (objectKey: string, _contentType?: string) => ({
      url: `https://storage.example.com/upload/${objectKey}?sig=fake`,
      objectKey,
      expiresInSeconds: 3600,
    }),
    generateDownloadUrl: async (objectKey: string) => ({
      url: `https://storage.example.com/download/${objectKey}?sig=fake`,
      objectKey,
      expiresInSeconds: 3600,
    }),
    headObject: async (_objectKey: string) => ({ exists: true, contentLength: 1024 }),
    deleteObject: async () => {},
  };
}

// ─── Module builder ─────────────────────────────────────

interface BuildOptions {
  prismaOverrides?: Record<string, any>;
  recordingRepo?: ReturnType<typeof createFakeRecordingRepo>;
  storage?: ReturnType<typeof createFakeStorage>;
  headObjectResult?: { exists: boolean; contentLength?: number };
}

async function buildService(opts: BuildOptions = {}) {
  const recordingRepo = opts.recordingRepo ?? createFakeRecordingRepo();
  const storage = opts.storage ?? createFakeStorage();

  // If headObjectResult is specified, override storage.headObject
  if (opts.headObjectResult) {
    const origStorage = storage;
    origStorage.headObject = async () => opts.headObjectResult!;
  }

  const fakePrisma = createFakePrismaService({
    enrollment: {
      findFirst: async () => ({ id: ENROLLMENT_ID }),
    },
    recording: {
      findUnique: async () => recordingRepo["_setRecording"] ? makeRecording() : null,
      update: async () => ({}),
    },
    speechJob: {
      create: async () => ({ id: "job-001", status: "CREATED" }),
      findUnique: async () => ({ id: "job-001", status: "CREATED" }),
      update: async () => ({ id: "job-001", status: "PROCESSING" }),
    },
    ...opts.prismaOverrides,
  });

  const fakeConfig = {
    get: (_key: string, defaultValue?: any) => defaultValue,
    getOrThrow: (key: string) => { throw new Error(`Config ${key} not set`); },
  };

  const moduleRef = await Test.createTestingModule({
    imports: [createFakeDatabaseModule(fakePrisma)],
    providers: [
      { provide: ConfigService, useValue: fakeConfig },
      { provide: RECORDING_REPOSITORY, useValue: recordingRepo },
      { provide: STORAGE_PORT, useValue: storage },
      // SpeechJobService is @Optional in RecordingsService — omit it
      RecordingsService,
    ],
  }).compile();

  const service = moduleRef.get(RecordingsService);
  return { service, recordingRepo, storage };
}

// ─── Test suite ─────────────────────────────────────────

describe("RecordingsService", () => {
  // ─── 1. Ownership binding: initRecording ──────────────

  describe("initRecording — ownership binding", () => {
    it("initializes recording when student owns the enrollment", async () => {
      const { service } = await buildService();
      const result = await service.initRecording(studentAuthA, SCHOOL_A, {
        enrollmentId: ENROLLMENT_ID,
        partCount: 3,
        mimeType: "audio/webm",
      });

      expect(result).toBeDefined();
      expect(result.partCount).toBe(3);
    });

    it("rejects when enrollment does not belong to the student", async () => {
      const { service } = await buildService({
        prismaOverrides: {
          enrollment: { findFirst: async () => null },
        },
      });

      await expect(
        service.initRecording(studentAuthA, SCHOOL_A, {
          enrollmentId: "other-enrollment",
          partCount: 1,
        }),
      ).rejects.toThrow(RecordingForbiddenException);
    });

    it("rejects teacher from initiating a recording", async () => {
      const { service } = await buildService();
      await expect(
        service.initRecording(teacherAuthA, SCHOOL_A, {
          enrollmentId: ENROLLMENT_ID,
          partCount: 1,
        }),
      ).rejects.toThrow(RecordingForbiddenException);
    });

    it("rejects cross-school student (tenant schoolId mismatch)", async () => {
      const { service } = await buildService();
      // studentAuthB has tenant.schoolId = SCHOOL_B, but we pass SCHOOL_A
      await expect(
        service.initRecording(studentAuthB, SCHOOL_A, {
          enrollmentId: ENROLLMENT_ID,
          partCount: 1,
        }),
      ).rejects.toThrow(RecordingForbiddenException);
    });
  });

  // ─── 2. Idempotent init ──────────────────────────────

  describe("initRecording — idempotency", () => {
    it("returns existing recording when idempotencyKey matches", async () => {
      const existing = makeRecording({ idempotencyKey: "key-123" });
      const fakeRepo = createFakeRecordingRepo(existing);
      // Override findByIdempotencyKey to return the existing recording
      fakeRepo.findByIdempotencyKey = async () => existing;

      const { service } = await buildService({ recordingRepo: fakeRepo });
      const result = await service.initRecording(studentAuthA, SCHOOL_A, {
        enrollmentId: ENROLLMENT_ID,
        partCount: 3,
        idempotencyKey: "key-123",
      });

      expect(result.id).toBe(RECORDING_ID);
    });
  });

  // ─── 3. Simple recording flow ────────────────────────

  describe("initSimpleRecording — ownership binding", () => {
    it("initializes simple recording for owning student", async () => {
      const { service } = await buildService();
      const result = await service.initSimpleRecording(studentAuthA, SCHOOL_A, {
        enrollmentId: ENROLLMENT_ID,
        mimeType: "audio/webm",
      });

      expect(result).toBeDefined();
      expect(result.uploadUrl).toBeDefined();
    });

    it("rejects when enrollment does not belong to the student", async () => {
      const { service } = await buildService({
        prismaOverrides: {
          enrollment: { findFirst: async () => null },
        },
      });

      await expect(
        service.initSimpleRecording(studentAuthA, SCHOOL_A, {
          enrollmentId: "other-enrollment",
        }),
      ).rejects.toThrow(RecordingForbiddenException);
    });
  });

  // ─── 4. completeRecording — ownership & status validation ──

  describe("completeRecording — ownership and status", () => {
    it("completes a simple recording (partCount=1, file exists)", async () => {
      const recording = makeRecording({ status: "UPLOADING" });
      const fakeRepo = createFakeRecordingRepo(recording);

      const { service } = await buildService({
        recordingRepo: fakeRepo,
        headObjectResult: { exists: true, contentLength: 2048 },
      });

      const result = await service.completeRecording(studentAuthA, SCHOOL_A, RECORDING_ID, {});
      expect(result.status).toBe("COMPLETE");
    });

    it("rejects completion when file does not exist in storage", async () => {
      const recording = makeRecording({ status: "UPLOADING" });
      const fakeRepo = createFakeRecordingRepo(recording);

      const { service } = await buildService({
        recordingRepo: fakeRepo,
        headObjectResult: { exists: false },
      });

      await expect(
        service.completeRecording(studentAuthA, SCHOOL_A, RECORDING_ID, {}),
      ).rejects.toThrow(RecordingStatusException);
    });

    it("rejects completion when file size is 0", async () => {
      const recording = makeRecording({ status: "UPLOADING" });
      const fakeRepo = createFakeRecordingRepo(recording);

      const { service } = await buildService({
        recordingRepo: fakeRepo,
        headObjectResult: { exists: true, contentLength: 0 },
      });

      await expect(
        service.completeRecording(studentAuthA, SCHOOL_A, RECORDING_ID, {}),
      ).rejects.toThrow(RecordingStatusException);
    });

    it("rejects completion from wrong state (COMPLETE → COMPLETE)", async () => {
      const recording = makeRecording({ status: "COMPLETE" });
      const fakeRepo = createFakeRecordingRepo(recording);

      const { service } = await buildService({ recordingRepo: fakeRepo });

      await expect(
        service.completeRecording(studentAuthA, SCHOOL_A, RECORDING_ID, {}),
      ).rejects.toThrow(RecordingStatusException);
    });

    it("rejects when student does not own the recording's enrollment", async () => {
      const recording = makeRecording({ status: "UPLOADING" });
      const fakeRepo = createFakeRecordingRepo(recording);

      const { service } = await buildService({
        recordingRepo: fakeRepo,
        prismaOverrides: {
          enrollment: { findFirst: async () => null },
        },
      });

      await expect(
        service.completeRecording(studentAuthA, SCHOOL_A, RECORDING_ID, {}),
      ).rejects.toThrow(RecordingForbiddenException);
    });
  });

  // ─── 5. getRecordingStatus — ownership ───────────────

  describe("getRecordingStatus — ownership", () => {
    it("allows student to read own recording", async () => {
      const recording = makeRecording({ status: "COMPLETE" });
      const fakeRepo = createFakeRecordingRepo(recording);

      const { service } = await buildService({ recordingRepo: fakeRepo });
      const result = await service.getRecordingStatus(studentAuthA, SCHOOL_A, RECORDING_ID);
      expect(result.id).toBe(RECORDING_ID);
    });

    it("rejects when recording not found", async () => {
      const fakeRepo = createFakeRecordingRepo(null);
      const { service } = await buildService({ recordingRepo: fakeRepo });

      await expect(
        service.getRecordingStatus(studentAuthA, SCHOOL_A, "nonexistent"),
      ).rejects.toThrow(RecordingNotFoundException);
    });

    it("rejects student who does not own the enrollment", async () => {
      const recording = makeRecording({ status: "COMPLETE" });
      const fakeRepo = createFakeRecordingRepo(recording);

      const { service } = await buildService({
        recordingRepo: fakeRepo,
        prismaOverrides: {
          enrollment: { findFirst: async () => null },
        },
      });

      await expect(
        service.getRecordingStatus(studentAuthA, SCHOOL_A, RECORDING_ID),
      ).rejects.toThrow(RecordingForbiddenException);
    });
  });

  // ─── 6. Cross-school denial ──────────────────────────

  describe("cross-school denial", () => {
    it("initRecording rejects cross-school access via policy", async () => {
      const { service } = await buildService();
      await expect(
        service.initRecording(studentAuthB, SCHOOL_A, {
          enrollmentId: ENROLLMENT_ID,
          partCount: 1,
        }),
      ).rejects.toThrow(RecordingForbiddenException);
    });

    it("completeRecording rejects cross-school via policy", async () => {
      const { service } = await buildService();
      await expect(
        service.completeRecording(studentAuthB, SCHOOL_A, RECORDING_ID, {}),
      ).rejects.toThrow(RecordingForbiddenException);
    });
  });
});
