import { describe, expect, it } from "vitest";
import {
  LinkNotFoundException,
  LinkRegenerationException,
} from "../../src/modules/product-plans/domain/link.errors.js";
import { LinksService } from "../../src/modules/product-plans/links/links.service.js";
import {
  platformAdminAuth,
  schoolAdminAuth,
  teacherAuth,
} from "../fixtures/auth.js";
import { FakeLinkRepository } from "./fakes/fake-link.repository.js";
import { assessmentLink } from "./fixtures/links.js";

function createService(linkRepo: FakeLinkRepository) {
  return new LinksService(linkRepo as never);
}

describe("LinksService", () => {
  const schoolId = "school-1";

  describe("list", () => {
    it("returns links with schoolId filter", async () => {
      const linkRepo = new FakeLinkRepository();
      const service = createService(linkRepo);
      const auth = platformAdminAuth(schoolId);

      linkRepo.add(
        assessmentLink({ schoolId: "school-1" }),
        assessmentLink({ schoolId: "school-2" }),
      );

      const result = await service.list(auth, {
        schoolId: "school-1",
        limit: 10,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.schoolId).toBe("school-1");
    });

    it("returns links with status filter", async () => {
      const linkRepo = new FakeLinkRepository();
      const service = createService(linkRepo);
      const auth = platformAdminAuth(schoolId);

      linkRepo.add(
        assessmentLink({ schoolId: "school-1", status: "ACTIVE" }),
        assessmentLink({ schoolId: "school-1", status: "DISABLED" }),
      );

      const result = await service.list(auth, {
        schoolId: "school-1",
        limit: 10,
        status: "ACTIVE",
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.status).toBe("ACTIVE");
    });

    it("returns links with assignmentId filter", async () => {
      const linkRepo = new FakeLinkRepository();
      const service = createService(linkRepo);
      const auth = platformAdminAuth(schoolId);

      linkRepo.add(
        assessmentLink({ schoolId: "school-1", assignmentId: "assign-1" }),
        assessmentLink({ schoolId: "school-1", assignmentId: "assign-2" }),
      );

      const result = await service.list(auth, {
        schoolId: "school-1",
        assignmentId: "assign-1",
        limit: 10,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.assignmentId).toBe("assign-1");
    });
  });

  describe("findById", () => {
    it("returns link when found", async () => {
      const linkRepo = new FakeLinkRepository();
      const service = createService(linkRepo);
      const auth = platformAdminAuth(schoolId);

      const link = assessmentLink({ id: "link-1", schoolId: "school-1" });
      linkRepo.add(link);

      const result = await service.findById(auth, "school-1", "link-1");
      expect(result.id).toBe("link-1");
    });

    it("throws LinkNotFoundException when not found", async () => {
      const linkRepo = new FakeLinkRepository();
      const service = createService(linkRepo);
      const auth = platformAdminAuth(schoolId);

      await expect(
        service.findById(auth, "school-1", "nonexistent"),
      ).rejects.toThrow(LinkNotFoundException);
    });
  });

  describe("disable", () => {
    it("transitions ACTIVE to DISABLED", async () => {
      const linkRepo = new FakeLinkRepository();
      const service = createService(linkRepo);
      const auth = platformAdminAuth(schoolId);

      const link = assessmentLink({
        id: "link-1",
        schoolId: "school-1",
        status: "ACTIVE",
      });
      linkRepo.add(link);

      const result = await service.disable(auth, "school-1", "link-1");

      expect(result.status).toBe("DISABLED");
      expect(result.disabledAt).not.toBeNull();
    });

    it("rejects already disabled link", async () => {
      const linkRepo = new FakeLinkRepository();
      const service = createService(linkRepo);
      const auth = platformAdminAuth(schoolId);

      const link = assessmentLink({
        id: "link-1",
        schoolId: "school-1",
        status: "DISABLED",
      });
      linkRepo.add(link);

      await expect(
        service.disable(auth, "school-1", "link-1"),
      ).rejects.toThrow(LinkRegenerationException);
    });

    it("throws LinkNotFoundException for nonexistent link", async () => {
      const linkRepo = new FakeLinkRepository();
      const service = createService(linkRepo);
      const auth = platformAdminAuth(schoolId);

      await expect(
        service.disable(auth, "school-1", "nonexistent"),
      ).rejects.toThrow(LinkNotFoundException);
    });
  });

  describe("regenerate", () => {
    it("creates new link with new tokenHash and tracks regeneratedFromId", async () => {
      const linkRepo = new FakeLinkRepository();
      const service = createService(linkRepo);
      const auth = platformAdminAuth(schoolId);

      const originalLink = assessmentLink({
        id: "link-1",
        schoolId: "school-1",
        status: "ACTIVE",
        tokenHash: "old-hash",
        usageCount: 5,
      });
      linkRepo.add(originalLink);

      const newLink = await service.regenerate(auth, "school-1", "link-1", {});

      expect(newLink.status).toBe("ACTIVE");
      expect(newLink.tokenHash).not.toBe("old-hash");
      expect(newLink.regeneratedFromId).toBe("link-1");
      expect(newLink.usageCount).toBe(0);
      expect(newLink.id).not.toBe("link-1");

      // Old link should be disabled
      const oldLink = await linkRepo.findById("school-1", "link-1");
      expect(oldLink!.status).toBe("DISABLED");
    });

    it("rejects regenerating a disabled link", async () => {
      const linkRepo = new FakeLinkRepository();
      const service = createService(linkRepo);
      const auth = platformAdminAuth(schoolId);

      const link = assessmentLink({
        id: "link-1",
        schoolId: "school-1",
        status: "DISABLED",
      });
      linkRepo.add(link);

      await expect(
        service.regenerate(auth, "school-1", "link-1", {}),
      ).rejects.toThrow(LinkRegenerationException);
    });

    it("throws LinkNotFoundException for nonexistent link", async () => {
      const linkRepo = new FakeLinkRepository();
      const service = createService(linkRepo);
      const auth = platformAdminAuth(schoolId);

      await expect(
        service.regenerate(auth, "school-1", "nonexistent", {}),
      ).rejects.toThrow(LinkNotFoundException);
    });

    it("preserves expiresAt when not overridden", async () => {
      const linkRepo = new FakeLinkRepository();
      const service = createService(linkRepo);
      const auth = platformAdminAuth(schoolId);

      const expiresAt = new Date("2026-12-31");
      const link = assessmentLink({
        id: "link-1",
        schoolId: "school-1",
        status: "ACTIVE",
        expiresAt,
      });
      linkRepo.add(link);

      const newLink = await service.regenerate(auth, "school-1", "link-1", {});

      expect(newLink.expiresAt).toEqual(expiresAt);
    });
  });

  describe("authorization", () => {
    it("rejects non-platform-admin for disable", async () => {
      const linkRepo = new FakeLinkRepository();
      const service = createService(linkRepo);
      const auth = schoolAdminAuth(schoolId);

      linkRepo.add(
        assessmentLink({ id: "link-1", schoolId: "school-1", status: "ACTIVE" }),
      );

      await expect(
        service.disable(auth, "school-1", "link-1"),
      ).rejects.toThrow(LinkRegenerationException);
    });

    it("rejects non-platform-admin for regenerate", async () => {
      const linkRepo = new FakeLinkRepository();
      const service = createService(linkRepo);
      const auth = schoolAdminAuth(schoolId);

      linkRepo.add(
        assessmentLink({ id: "link-1", schoolId: "school-1", status: "ACTIVE" }),
      );

      await expect(
        service.regenerate(auth, "school-1", "link-1", {}),
      ).rejects.toThrow(LinkRegenerationException);
    });

    it("school_admin can view but not disable/regenerate", async () => {
      const linkRepo = new FakeLinkRepository();
      const service = createService(linkRepo);
      const auth = schoolAdminAuth(schoolId);

      linkRepo.add(
        assessmentLink({ id: "link-1", schoolId: "school-1" }),
      );

      // Can view
      const link = await service.findById(auth, "school-1", "link-1");
      expect(link.id).toBe("link-1");

      const list = await service.list(auth, {
        schoolId: "school-1",
        limit: 10,
      });
      expect(list.items).toHaveLength(1);

      // Cannot disable
      await expect(
        service.disable(auth, "school-1", "link-1"),
      ).rejects.toThrow(LinkRegenerationException);

      // Cannot regenerate
      await expect(
        service.regenerate(auth, "school-1", "link-1", {}),
      ).rejects.toThrow(LinkRegenerationException);
    });

    it("teacher cannot view links", async () => {
      const linkRepo = new FakeLinkRepository();
      const service = createService(linkRepo);
      const auth = teacherAuth(schoolId);

      await expect(
        service.list(auth, { schoolId: "school-1", limit: 10 }),
      ).rejects.toThrow(LinkRegenerationException);
    });
  });

  describe("fail-closed", () => {
    it("list throws when repository returns error", async () => {
      const linkRepo = new FakeLinkRepository();
      const service = createService(linkRepo);
      const auth = platformAdminAuth(schoolId);

      linkRepo.list = async () => {
        throw new Error("Repository unavailable");
      };

      await expect(
        service.list(auth, { schoolId: "school-1", limit: 10 }),
      ).rejects.toThrow("Repository unavailable");
    });
  });
});
