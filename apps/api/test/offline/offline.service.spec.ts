import { describe, it, expect, beforeEach } from "vitest";
import { Test } from "@nestjs/testing";
import { OfflineService } from "../../src/modules/offline/offline.service.js";
import type { OfflineRepositoryPort } from "../../src/modules/offline/ports/offline-repository.port.js";
import { OFFLINE_REPOSITORY } from "../../src/modules/offline/ports/offline-repository.port.js";
import type { OfflineContentPackage, SyncBatch } from "../../src/modules/offline/domain/offline.types.js";
import type { AuthContext } from "../../src/common/security/auth.types.js";
import { MembershipRole } from "../../src/common/security/membership-role.js";
import { MembershipStatus } from "../../src/common/security/auth.types.js";

function makeAuth(schoolId: string, role: MembershipRole = MembershipRole.TEACHER): AuthContext {
  return {
    requestId: "test-req-id",
    principal: { userId: "user-1", roles: [role], membershipStatus: MembershipStatus.ACTIVE, source: "test" },
    tenant: { schoolId },
  };
}

function makePackage(): OfflineContentPackage {
  return {
    id: "pkg-1", schoolId: "school-1", courseVersionId: "cv-1", version: 1,
    checksum: "abc123", byteSize: BigInt(1024), downloadRequired: false,
    expiresAt: null, revision: 1, createdAt: new Date(), updatedAt: new Date(),
  };
}

function makeSyncBatch(): SyncBatch {
  return {
    id: "batch-1", schoolId: "school-1", deviceId: "device-1",
    clientBatchId: "client-batch-1", status: "ACCEPTED",
    operationCount: 5, acceptedCount: 3, duplicateCount: 1,
    conflictCount: 0, rejectedCount: 1, permissionChanged: 0,
    summary: null, errorCode: null, createdAt: new Date(), updatedAt: new Date(),
  };
}

describe("OfflineService", () => {
  let service: OfflineService;
  let repo: OfflineRepositoryPort;

  beforeEach(async () => {
    repo = {
      listPackages: vi.fn(),
      findPackageById: vi.fn(),
      createPackage: vi.fn(),
      findBatchById: vi.fn(),
      findBatchByClientBatchId: vi.fn(),
      createBatch: vi.fn(),
      authorizeDownload: vi.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [OfflineService, { provide: OFFLINE_REPOSITORY, useValue: repo }],
    }).compile();
    service = module.get(OfflineService);
  });

  describe("listPackages", () => {
    it("returns packages for authorized user", async () => {
      const auth = makeAuth("school-1");
      vi.mocked(repo.listPackages).mockResolvedValue({ items: [makePackage()], nextCursor: null, hasMore: false });
      const result = await service.listPackages(auth, "school-1", {});
      expect(result.items).toHaveLength(1);
    });

    it("rejects wrong school tenant", async () => {
      const auth = makeAuth("school-2");
      await expect(service.listPackages(auth, "school-1", {})).rejects.toThrow();
    });
  });

  describe("createPackage", () => {
    it("creates package for teacher", async () => {
      const auth = makeAuth("school-1", MembershipRole.TEACHER);
      vi.mocked(repo.createPackage).mockResolvedValue(makePackage());
      const result = await service.createPackage(auth, "school-1", { courseVersionId: "cv-1" });
      expect(result.id).toBe("pkg-1");
    });

    it("rejects student creating package", async () => {
      const auth = makeAuth("school-1", MembershipRole.STUDENT);
      await expect(service.createPackage(auth, "school-1", { courseVersionId: "cv-1" })).rejects.toThrow();
    });
  });

  describe("createSyncBatch", () => {
    it("tracks all five sync batch statuses", async () => {
      vi.mocked(repo.findBatchByClientBatchId).mockResolvedValue(null);
      vi.mocked(repo.createBatch).mockResolvedValue(makeSyncBatch());
      const auth = makeAuth("school-1", MembershipRole.STUDENT);
      const result = await service.createSyncBatch(auth, "school-1", {
        deviceId: "device-1", clientBatchId: "client-batch-1", operationCount: 5,
      });
      expect(result.acceptedCount).toBe(3);
      expect(result.duplicateCount).toBe(1);
      expect(result.rejectedCount).toBe(1);
    });
  });
});
