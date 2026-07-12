import { describe, expect, it, beforeEach } from "vitest";
import { DELETION_REPOSITORY } from "../../src/modules/privacy/ports/deletion-repository.port.js";
import { DeletionService } from "../../src/modules/privacy/deletion/deletion.service.js";
import {
  PrivacyForbiddenException,
  DeletionRequestNotFoundException,
  DeletionConflictException,
} from "../../src/modules/privacy/domain/privacy.errors.js";
import { FakeDeletionRepository } from "./fakes/fake-deletion.repository.js";
import { deletionRequest } from "./fixtures/privacy.js";
import {
  platformAdminAuth,
  schoolAdminAuth,
  teacherAuth,
} from "../fixtures/auth.js";

describe("DeletionService", () => {
  const schoolId = "school-a";
  let repo: FakeDeletionRepository;
  let service: DeletionService;

  beforeEach(() => {
    repo = new FakeDeletionRepository();
    service = new DeletionService(repo as unknown as {
      [key: symbol]: unknown;
    }[typeof DELETION_REPOSITORY]);
  });

  describe("list", () => {
    it("returns deletion requests with pagination", async () => {
      const auth = platformAdminAuth(schoolId);
      const r1 = deletionRequest({ userId: "user-a" });
      const r2 = deletionRequest({ userId: "user-b" });
      repo.add(r1, r2);

      const result = await service.list(auth, { limit: 10 });

      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });

    it("filters by status", async () => {
      const auth = platformAdminAuth(schoolId);
      const pending = deletionRequest({ status: "PENDING" });
      const approved = deletionRequest({ status: "APPROVED" });
      repo.add(pending, approved);

      const result = await service.list(auth, {
        limit: 10,
        status: "PENDING",
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.status).toBe("PENDING");
    });

    it("filters by userId", async () => {
      const auth = platformAdminAuth(schoolId);
      const r1 = deletionRequest({ userId: "user-a" });
      const r2 = deletionRequest({ userId: "user-b" });
      repo.add(r1, r2);

      const result = await service.list(auth, {
        limit: 10,
        userId: "user-a",
      });

      expect(result.items).toHaveLength(1);
    });

    it("filters by schoolId", async () => {
      const auth = platformAdminAuth(schoolId);
      const r1 = deletionRequest({ schoolId: "school-a" });
      const r2 = deletionRequest({ schoolId: "school-b" });
      repo.add(r1, r2);

      const result = await service.list(auth, {
        limit: 10,
        schoolId: "school-a",
      });

      expect(result.items).toHaveLength(1);
    });

    it("rejects non-platform-admin", async () => {
      const auth = schoolAdminAuth(schoolId);
      await expect(service.list(auth, { limit: 10 })).rejects.toThrow(
        PrivacyForbiddenException,
      );
    });
  });

  describe("state machine: PENDING -> APPROVED", () => {
    it("approves a pending request", async () => {
      const auth = platformAdminAuth(schoolId);
      const request = deletionRequest({ status: "PENDING" });
      repo.add(request);

      const result = await service.processDeletion(auth, request.id, {
        status: "APPROVED",
      });

      expect(result.status).toBe("APPROVED");
      expect(result.approvedAt).not.toBeNull();
    });
  });

  describe("state machine: PENDING -> REJECTED", () => {
    it("rejects a pending request", async () => {
      const auth = platformAdminAuth(schoolId);
      const request = deletionRequest({ status: "PENDING" });
      repo.add(request);

      const result = await service.processDeletion(auth, request.id, {
        status: "REJECTED",
      });

      expect(result.status).toBe("REJECTED");
    });
  });

  describe("state machine: APPROVED -> PROCESSING", () => {
    it("starts processing an approved request", async () => {
      const auth = platformAdminAuth(schoolId);
      const request = deletionRequest({ status: "APPROVED" });
      repo.add(request);

      const result = await service.processDeletion(auth, request.id, {
        status: "PROCESSING",
      });

      expect(result.status).toBe("PROCESSING");
    });
  });

  describe("state machine: PROCESSING -> COMPLETED", () => {
    it("completes a processing request", async () => {
      const auth = platformAdminAuth(schoolId);
      const request = deletionRequest({ status: "PROCESSING" });
      repo.add(request);

      const result = await service.processDeletion(auth, request.id, {
        status: "COMPLETED",
      });

      expect(result.status).toBe("COMPLETED");
      expect(result.completedAt).not.toBeNull();
    });
  });

  describe("invalid transitions", () => {
    it("rejects PENDING -> PROCESSING (must be approved first)", async () => {
      const auth = platformAdminAuth(schoolId);
      const request = deletionRequest({ status: "PENDING" });
      repo.add(request);

      await expect(
        service.processDeletion(auth, request.id, { status: "PROCESSING" }),
      ).rejects.toThrow(DeletionConflictException);
    });

    it("rejects APPROVED -> COMPLETED (must process first)", async () => {
      const auth = platformAdminAuth(schoolId);
      const request = deletionRequest({ status: "APPROVED" });
      repo.add(request);

      await expect(
        service.processDeletion(auth, request.id, { status: "COMPLETED" }),
      ).rejects.toThrow(DeletionConflictException);
    });

    it("rejects COMPLETED -> any (terminal state)", async () => {
      const auth = platformAdminAuth(schoolId);
      const request = deletionRequest({ status: "COMPLETED" });
      repo.add(request);

      await expect(
        service.processDeletion(auth, request.id, { status: "APPROVED" }),
      ).rejects.toThrow(DeletionConflictException);

      await expect(
        service.processDeletion(auth, request.id, { status: "PROCESSING" }),
      ).rejects.toThrow(DeletionConflictException);

      await expect(
        service.processDeletion(auth, request.id, { status: "PENDING" }),
      ).rejects.toThrow(DeletionConflictException);
    });

    it("rejects REJECTED -> any (terminal state)", async () => {
      const auth = platformAdminAuth(schoolId);
      const request = deletionRequest({ status: "REJECTED" });
      repo.add(request);

      await expect(
        service.processDeletion(auth, request.id, { status: "APPROVED" }),
      ).rejects.toThrow(DeletionConflictException);

      await expect(
        service.processDeletion(auth, request.id, { status: "PENDING" }),
      ).rejects.toThrow(DeletionConflictException);
    });

    it("rejects PROCESSING -> PENDING (backwards)", async () => {
      const auth = platformAdminAuth(schoolId);
      const request = deletionRequest({ status: "PROCESSING" });
      repo.add(request);

      await expect(
        service.processDeletion(auth, request.id, { status: "PENDING" }),
      ).rejects.toThrow(DeletionConflictException);
    });
  });

  describe("processDeletion errors", () => {
    it("throws when request not found", async () => {
      const auth = platformAdminAuth(schoolId);

      await expect(
        service.processDeletion(auth, "non-existent-id", {
          status: "APPROVED",
        }),
      ).rejects.toThrow(DeletionRequestNotFoundException);
    });

    it("rejects non-platform-admin", async () => {
      const auth = teacherAuth(schoolId);
      const request = deletionRequest({ status: "PENDING" });
      repo.add(request);

      await expect(
        service.processDeletion(auth, request.id, { status: "APPROVED" }),
      ).rejects.toThrow(PrivacyForbiddenException);
    });

    it("updates notes when provided", async () => {
      const auth = platformAdminAuth(schoolId);
      const request = deletionRequest({
        status: "PENDING",
        notes: null,
      });
      repo.add(request);

      const result = await service.processDeletion(auth, request.id, {
        status: "APPROVED",
        notes: "审批通过",
      });

      expect(result.notes).toBe("审批通过");
    });

    it("preserves existing notes when not provided", async () => {
      const auth = platformAdminAuth(schoolId);
      const request = deletionRequest({
        status: "PENDING",
        notes: "原始备注",
      });
      repo.add(request);

      const result = await service.processDeletion(auth, request.id, {
        status: "APPROVED",
      });

      expect(result.notes).toBe("原始备注");
    });
  });

  describe("fail-closed with unavailable repository", () => {
    it("throws when repository operations fail", async () => {
      const brokenRepo = new FakeDeletionRepository();
      brokenRepo.list = async () => {
        throw new Error("Connection refused");
      };

      const service = new DeletionService(brokenRepo as unknown as {
        [key: symbol]: unknown;
      }[typeof DELETION_REPOSITORY]);
      const auth = platformAdminAuth(schoolId);

      await expect(service.list(auth, { limit: 10 })).rejects.toThrow(
        "Connection refused",
      );
    });
  });
});
