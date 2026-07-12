import { describe, expect, it } from "vitest";
import {
  RuleNotFoundException,
  RuleConflictException,
  RuleVersionConflictException,
} from "../../src/modules/product-plans/domain/rule.errors.js";
import { RulesService } from "../../src/modules/product-plans/rules/rules.service.js";
import {
  platformAdminAuth,
  schoolAdminAuth,
  teacherAuth,
} from "../fixtures/auth.js";
import { FakeRuleRepository } from "./fakes/fake-rule.repository.js";
import { recommendationRule } from "./fixtures/rules.js";

function createService(ruleRepo: FakeRuleRepository) {
  return new RulesService(ruleRepo as never);
}

describe("RulesService", () => {
  const schoolId = "school-1";

  describe("list", () => {
    it("returns rules with status filter", async () => {
      const ruleRepo = new FakeRuleRepository();
      const service = createService(ruleRepo);
      const auth = platformAdminAuth(schoolId);

      ruleRepo.add(
        recommendationRule({ status: "DRAFT" }),
        recommendationRule({ status: "PUBLISHED" }),
      );

      const result = await service.list(auth, {
        limit: 10,
        status: "PUBLISHED",
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.status).toBe("PUBLISHED");
    });

    it("returns rules with issueCode filter", async () => {
      const ruleRepo = new FakeRuleRepository();
      const service = createService(ruleRepo);
      const auth = platformAdminAuth(schoolId);

      ruleRepo.add(
        recommendationRule({ issueCode: "ANXIETY" }),
        recommendationRule({ issueCode: "DEPRESSION" }),
      );

      const result = await service.list(auth, {
        limit: 10,
        issueCode: "ANXIETY",
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.issueCode).toBe("ANXIETY");
    });

    it("returns rules with dimensionCode filter", async () => {
      const ruleRepo = new FakeRuleRepository();
      const service = createService(ruleRepo);
      const auth = platformAdminAuth(schoolId);

      ruleRepo.add(
        recommendationRule({ dimensionCode: "EMOTIONAL" }),
        recommendationRule({ dimensionCode: "COGNITIVE" }),
      );

      const result = await service.list(auth, {
        limit: 10,
        dimensionCode: "EMOTIONAL",
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.dimensionCode).toBe("EMOTIONAL");
    });
  });

  describe("findById", () => {
    it("returns rule when found", async () => {
      const ruleRepo = new FakeRuleRepository();
      const service = createService(ruleRepo);
      const auth = platformAdminAuth(schoolId);

      const rule = recommendationRule({ id: "rule-1" });
      ruleRepo.add(rule);

      const result = await service.findById(auth, "rule-1");
      expect(result.id).toBe("rule-1");
    });

    it("throws RuleNotFoundException when not found", async () => {
      const ruleRepo = new FakeRuleRepository();
      const service = createService(ruleRepo);
      const auth = platformAdminAuth(schoolId);

      await expect(service.findById(auth, "nonexistent")).rejects.toThrow(
        RuleNotFoundException,
      );
    });
  });

  describe("create", () => {
    it("saves new rule with DRAFT status", async () => {
      const ruleRepo = new FakeRuleRepository();
      const service = createService(ruleRepo);
      const auth = platformAdminAuth(schoolId);

      const result = await service.create(auth, {
        issueCode: "ANXIETY",
        dimensionCode: "EMOTIONAL",
        severityMin: 1,
        severityMax: 5,
        courseVersionId: "cv-1",
        priority: 1,
      });

      expect(result.status).toBe("DRAFT");
      expect(result.issueCode).toBe("ANXIETY");
      expect(result.dimensionCode).toBe("EMOTIONAL");
      expect(result.version).toBe(1);
    });

    it("rejects conflicting rules", async () => {
      const ruleRepo = new FakeRuleRepository();
      const service = createService(ruleRepo);
      const auth = platformAdminAuth(schoolId);

      ruleRepo.add(
        recommendationRule({
          id: "existing-rule",
          issueCode: "ANXIETY",
          dimensionCode: "EMOTIONAL",
          severityMin: 1,
          severityMax: 5,
          priority: 1,
        }),
      );

      await expect(
        service.create(auth, {
          issueCode: "ANXIETY",
          dimensionCode: "EMOTIONAL",
          severityMin: 2,
          severityMax: 4,
          courseVersionId: "cv-2",
          priority: 1,
        }),
      ).rejects.toThrow(RuleConflictException);
    });

    it("allows non-conflicting rules with same issueCode but different priority", async () => {
      const ruleRepo = new FakeRuleRepository();
      const service = createService(ruleRepo);
      const auth = platformAdminAuth(schoolId);

      ruleRepo.add(
        recommendationRule({
          issueCode: "ANXIETY",
          dimensionCode: "EMOTIONAL",
          severityMin: 1,
          severityMax: 5,
          priority: 1,
        }),
      );

      const result = await service.create(auth, {
        issueCode: "ANXIETY",
        dimensionCode: "EMOTIONAL",
        severityMin: 1,
        severityMax: 5,
        courseVersionId: "cv-2",
        priority: 2,
      });

      expect(result.status).toBe("DRAFT");
    });
  });

  describe("update", () => {
    it("modifies rule with optimistic concurrency", async () => {
      const ruleRepo = new FakeRuleRepository();
      const service = createService(ruleRepo);
      const auth = platformAdminAuth(schoolId);

      const rule = recommendationRule({ id: "rule-1", priority: 1 });
      ruleRepo.add(rule);

      const result = await service.update(auth, "rule-1", {
        priority: 2,
        expectedUpdatedAt: rule.updatedAt.getTime(),
      });

      expect(result.priority).toBe(2);
    });

    it("rejects wrong expectedUpdatedAt with RuleVersionConflictException", async () => {
      const ruleRepo = new FakeRuleRepository();
      const service = createService(ruleRepo);
      const auth = platformAdminAuth(schoolId);

      const rule = recommendationRule({ id: "rule-1" });
      ruleRepo.add(rule);

      await expect(
        service.update(auth, "rule-1", {
          priority: 2,
          expectedUpdatedAt: 0,
        }),
      ).rejects.toThrow(RuleVersionConflictException);
    });

    it("throws RuleNotFoundException for nonexistent rule", async () => {
      const ruleRepo = new FakeRuleRepository();
      const service = createService(ruleRepo);
      const auth = platformAdminAuth(schoolId);

      await expect(
        service.update(auth, "nonexistent", {
          priority: 2,
          expectedUpdatedAt: Date.now(),
        }),
      ).rejects.toThrow(RuleNotFoundException);
    });
  });

  describe("publish (state machine)", () => {
    it("transitions DRAFT to PUBLISHED", async () => {
      const ruleRepo = new FakeRuleRepository();
      const service = createService(ruleRepo);
      const auth = platformAdminAuth(schoolId);

      const rule = recommendationRule({ id: "rule-1", status: "DRAFT" });
      ruleRepo.add(rule);

      const result = await service.publish(auth, "rule-1");

      expect(result.status).toBe("PUBLISHED");
      expect(result.version).toBe(2);
    });

    it("checks conflicts before publishing", async () => {
      const ruleRepo = new FakeRuleRepository();
      const service = createService(ruleRepo);
      const auth = platformAdminAuth(schoolId);

      ruleRepo.add(
        recommendationRule({
          id: "published-rule",
          issueCode: "ANXIETY",
          dimensionCode: "EMOTIONAL",
          severityMin: 1,
          severityMax: 5,
          priority: 1,
          status: "PUBLISHED",
        }),
        recommendationRule({
          id: "draft-rule",
          issueCode: "ANXIETY",
          dimensionCode: "EMOTIONAL",
          severityMin: 2,
          severityMax: 4,
          priority: 1,
          status: "DRAFT",
        }),
      );

      await expect(service.publish(auth, "draft-rule")).rejects.toThrow(
        RuleConflictException,
      );
    });

    it("rejects already published rule", async () => {
      const ruleRepo = new FakeRuleRepository();
      const service = createService(ruleRepo);
      const auth = platformAdminAuth(schoolId);

      const rule = recommendationRule({ id: "rule-1", status: "PUBLISHED" });
      ruleRepo.add(rule);

      await expect(service.publish(auth, "rule-1")).rejects.toThrow(
        RuleConflictException,
      );
    });

    it("rejects archived rule", async () => {
      const ruleRepo = new FakeRuleRepository();
      const service = createService(ruleRepo);
      const auth = platformAdminAuth(schoolId);

      const rule = recommendationRule({ id: "rule-1", status: "ARCHIVED" });
      ruleRepo.add(rule);

      await expect(service.publish(auth, "rule-1")).rejects.toThrow(
        RuleConflictException,
      );
    });
  });

  describe("archive (state machine)", () => {
    it("transitions DRAFT to ARCHIVED", async () => {
      const ruleRepo = new FakeRuleRepository();
      const service = createService(ruleRepo);
      const auth = platformAdminAuth(schoolId);

      const rule = recommendationRule({ id: "rule-1", status: "DRAFT" });
      ruleRepo.add(rule);

      const result = await service.archive(auth, "rule-1");
      expect(result.status).toBe("ARCHIVED");
    });

    it("transitions PUBLISHED to ARCHIVED", async () => {
      const ruleRepo = new FakeRuleRepository();
      const service = createService(ruleRepo);
      const auth = platformAdminAuth(schoolId);

      const rule = recommendationRule({ id: "rule-1", status: "PUBLISHED" });
      ruleRepo.add(rule);

      const result = await service.archive(auth, "rule-1");
      expect(result.status).toBe("ARCHIVED");
    });

    it("rejects already archived rule", async () => {
      const ruleRepo = new FakeRuleRepository();
      const service = createService(ruleRepo);
      const auth = platformAdminAuth(schoolId);

      const rule = recommendationRule({ id: "rule-1", status: "ARCHIVED" });
      ruleRepo.add(rule);

      await expect(service.archive(auth, "rule-1")).rejects.toThrow(
        RuleConflictException,
      );
    });
  });

  describe("detectConflictsForAll", () => {
    it("fetches all rules and detects conflicts", async () => {
      const ruleRepo = new FakeRuleRepository();
      const service = createService(ruleRepo);
      const auth = platformAdminAuth(schoolId);

      ruleRepo.add(
        recommendationRule({
          id: "rule-a",
          issueCode: "ANXIETY",
          dimensionCode: "EMOTIONAL",
          severityMin: 1,
          severityMax: 5,
          priority: 1,
        }),
        recommendationRule({
          id: "rule-b",
          issueCode: "ANXIETY",
          dimensionCode: "EMOTIONAL",
          severityMin: 2,
          severityMax: 6,
          priority: 1,
        }),
      );

      const conflicts = await service.detectConflictsForAll(auth);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]!.conflictType).toBe("PRIORITY_OVERLAP");
    });

    it("returns empty array when no conflicts", async () => {
      const ruleRepo = new FakeRuleRepository();
      const service = createService(ruleRepo);
      const auth = platformAdminAuth(schoolId);

      ruleRepo.add(
        recommendationRule({
          issueCode: "ANXIETY",
          dimensionCode: "EMOTIONAL",
          severityMin: 1,
          severityMax: 3,
          priority: 1,
        }),
        recommendationRule({
          issueCode: "DEPRESSION",
          dimensionCode: "COGNITIVE",
          severityMin: 1,
          severityMax: 3,
          priority: 1,
        }),
      );

      const conflicts = await service.detectConflictsForAll(auth);
      expect(conflicts).toHaveLength(0);
    });
  });

  describe("authorization", () => {
    it("rejects non-platform-admin for create", async () => {
      const ruleRepo = new FakeRuleRepository();
      const service = createService(ruleRepo);
      const auth = schoolAdminAuth(schoolId);

      await expect(
        service.create(auth, {
          issueCode: "ANXIETY",
          dimensionCode: "EMOTIONAL",
          severityMin: 1,
          severityMax: 5,
          courseVersionId: "cv-1",
          priority: 1,
        }),
      ).rejects.toThrow(RuleConflictException);
    });

    it("rejects non-platform-admin for update", async () => {
      const ruleRepo = new FakeRuleRepository();
      const service = createService(ruleRepo);
      const auth = schoolAdminAuth(schoolId);

      ruleRepo.add(recommendationRule({ id: "rule-1" }));

      await expect(
        service.update(auth, "rule-1", {
          priority: 2,
          expectedUpdatedAt: Date.now(),
        }),
      ).rejects.toThrow(RuleConflictException);
    });

    it("rejects non-platform-admin for publish", async () => {
      const ruleRepo = new FakeRuleRepository();
      const service = createService(ruleRepo);
      const auth = schoolAdminAuth(schoolId);

      ruleRepo.add(recommendationRule({ id: "rule-1", status: "DRAFT" }));

      await expect(service.publish(auth, "rule-1")).rejects.toThrow(
        RuleConflictException,
      );
    });

    it("rejects non-platform-admin for archive", async () => {
      const ruleRepo = new FakeRuleRepository();
      const service = createService(ruleRepo);
      const auth = schoolAdminAuth(schoolId);

      ruleRepo.add(recommendationRule({ id: "rule-1", status: "DRAFT" }));

      await expect(service.archive(auth, "rule-1")).rejects.toThrow(
        RuleConflictException,
      );
    });

    it("rejects non-platform-admin for conflict detection", async () => {
      const ruleRepo = new FakeRuleRepository();
      const service = createService(ruleRepo);
      const auth = schoolAdminAuth(schoolId);

      await expect(service.detectConflictsForAll(auth)).rejects.toThrow(
        RuleConflictException,
      );
    });

    it("school_admin can view but not manage", async () => {
      const ruleRepo = new FakeRuleRepository();
      const service = createService(ruleRepo);
      const auth = schoolAdminAuth(schoolId);

      ruleRepo.add(recommendationRule({ id: "rule-1" }));

      // Can view
      const rule = await service.findById(auth, "rule-1");
      expect(rule.id).toBe("rule-1");

      const list = await service.list(auth, { limit: 10 });
      expect(list.items).toHaveLength(1);

      // Cannot manage
      await expect(
        service.create(auth, {
          issueCode: "ANXIETY",
          dimensionCode: "EMOTIONAL",
          severityMin: 1,
          severityMax: 5,
          courseVersionId: "cv-1",
          priority: 1,
        }),
      ).rejects.toThrow(RuleConflictException);
    });

    it("teacher cannot view rules", async () => {
      const ruleRepo = new FakeRuleRepository();
      const service = createService(ruleRepo);
      const auth = teacherAuth(schoolId);

      await expect(service.list(auth, { limit: 10 })).rejects.toThrow(
        RuleConflictException,
      );
    });
  });

  describe("fail-closed", () => {
    it("list throws when repository returns error", async () => {
      const ruleRepo = new FakeRuleRepository();
      const service = createService(ruleRepo);
      const auth = platformAdminAuth(schoolId);

      ruleRepo.list = async () => {
        throw new Error("Repository unavailable");
      };

      await expect(service.list(auth, { limit: 10 })).rejects.toThrow(
        "Repository unavailable",
      );
    });
  });
});
