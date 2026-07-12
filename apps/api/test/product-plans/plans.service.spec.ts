import { describe, expect, it } from "vitest";
import {
  PlanNotFoundException,
  PlanConflictException,
  PlanVersionConflictException,
} from "../../src/modules/product-plans/domain/plan.errors.js";
import { PlansService } from "../../src/modules/product-plans/plans/plans.service.js";
import {
  platformAdminAuth,
  schoolAdminAuth,
  teacherAuth,
  studentAuth,
} from "../fixtures/auth.js";
import { FakePlanRepository } from "./fakes/fake-plan.repository.js";
import { FakePlanVersionRepository } from "./fakes/fake-plan-version.repository.js";
import { productPlan } from "./fixtures/plans.js";

function createService(
  planRepo: FakePlanRepository,
  versionRepo: FakePlanVersionRepository,
) {
  return new PlansService(
    planRepo as never,
    versionRepo as never,
  );
}

describe("PlansService", () => {
  const schoolId = "school-1";

  describe("list", () => {
    it("returns plans with tier filter", async () => {
      const planRepo = new FakePlanRepository();
      const versionRepo = new FakePlanVersionRepository();
      const service = createService(planRepo, versionRepo);
      const auth = platformAdminAuth(schoolId);

      planRepo.add(
        productPlan({ tier: "INCLUSIVE", isActive: true }),
        productPlan({ tier: "PROFESSIONAL", isActive: true }),
        productPlan({ tier: "FLAGSHIP", isActive: true }),
      );

      const result = await service.list(auth, {
        limit: 10,
        tier: "INCLUSIVE",
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.tier).toBe("INCLUSIVE");
    });

    it("returns plans with isActive filter", async () => {
      const planRepo = new FakePlanRepository();
      const versionRepo = new FakePlanVersionRepository();
      const service = createService(planRepo, versionRepo);
      const auth = platformAdminAuth(schoolId);

      planRepo.add(
        productPlan({ isActive: true }),
        productPlan({ isActive: false }),
      );

      const result = await service.list(auth, {
        limit: 10,
        isActive: false,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.isActive).toBe(false);
    });

    it("supports pagination", async () => {
      const planRepo = new FakePlanRepository();
      const versionRepo = new FakePlanVersionRepository();
      const service = createService(planRepo, versionRepo);
      const auth = platformAdminAuth(schoolId);

      planRepo.add(
        productPlan({ id: "p1" }),
        productPlan({ id: "p2" }),
        productPlan({ id: "p3" }),
      );

      const page1 = await service.list(auth, { limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).not.toBeNull();

      const page2 = await service.list(auth, {
        limit: 2,
        cursor: page1.nextCursor!,
      });
      expect(page2.items).toHaveLength(1);
      expect(page2.hasMore).toBe(false);
    });
  });

  describe("findById", () => {
    it("returns plan when found", async () => {
      const planRepo = new FakePlanRepository();
      const versionRepo = new FakePlanVersionRepository();
      const service = createService(planRepo, versionRepo);
      const auth = platformAdminAuth(schoolId);

      const plan = productPlan({ id: "plan-1" });
      planRepo.add(plan);

      const result = await service.findById(auth, "plan-1");
      expect(result.id).toBe("plan-1");
    });

    it("throws PlanNotFoundException when not found", async () => {
      const planRepo = new FakePlanRepository();
      const versionRepo = new FakePlanVersionRepository();
      const service = createService(planRepo, versionRepo);
      const auth = platformAdminAuth(schoolId);

      await expect(service.findById(auth, "nonexistent")).rejects.toThrow(
        PlanNotFoundException,
      );
    });
  });

  describe("create", () => {
    it("saves new plan with defaults", async () => {
      const planRepo = new FakePlanRepository();
      const versionRepo = new FakePlanVersionRepository();
      const service = createService(planRepo, versionRepo);
      const auth = platformAdminAuth(schoolId);

      const result = await service.create(auth, {
        tier: "INCLUSIVE",
        displayName: "普惠版",
      });

      expect(result.tier).toBe("INCLUSIVE");
      expect(result.displayName).toBe("普惠版");
      expect(result.isActive).toBe(true);
      expect(result.publicVersion).toBe(0);
      expect(result.contractVersion).toBe(1);
    });

    it("saves new plan with all fields", async () => {
      const planRepo = new FakePlanRepository();
      const versionRepo = new FakePlanVersionRepository();
      const service = createService(planRepo, versionRepo);
      const auth = platformAdminAuth(schoolId);

      const result = await service.create(auth, {
        tier: "PROFESSIONAL",
        displayName: "专业版",
        description: "专业版描述",
        priceMinCents: 19900,
        priceMaxCents: 39900,
        discountFactor: 9500,
        serviceItems: [{ name: "心理咨询" }],
        fundingSource: "政府补贴",
      });

      expect(result.priceMinCents).toBe(19900);
      expect(result.priceMaxCents).toBe(39900);
      expect(result.discountFactor).toBe(9500);
      expect(result.description).toBe("专业版描述");
      expect(result.fundingSource).toBe("政府补贴");
    });

    it("uses integer cents for monetary fields", async () => {
      const planRepo = new FakePlanRepository();
      const versionRepo = new FakePlanVersionRepository();
      const service = createService(planRepo, versionRepo);
      const auth = platformAdminAuth(schoolId);

      const result = await service.create(auth, {
        tier: "FLAGSHIP",
        displayName: "旗舰版",
        priceMinCents: 50000,
        priceMaxCents: 100000,
        discountFactor: 8000,
      });

      expect(Number.isInteger(result.priceMinCents)).toBe(true);
      expect(Number.isInteger(result.priceMaxCents)).toBe(true);
      expect(Number.isInteger(result.discountFactor)).toBe(true);
    });

    it("defaults discountFactor to 10000 (basis points)", async () => {
      const planRepo = new FakePlanRepository();
      const versionRepo = new FakePlanVersionRepository();
      const service = createService(planRepo, versionRepo);
      const auth = platformAdminAuth(schoolId);

      const result = await service.create(auth, {
        tier: "INCLUSIVE",
        displayName: "普惠版",
      });

      expect(result.discountFactor).toBe(10000);
    });
  });

  describe("update", () => {
    it("modifies existing plan with optimistic concurrency", async () => {
      const planRepo = new FakePlanRepository();
      const versionRepo = new FakePlanVersionRepository();
      const service = createService(planRepo, versionRepo);
      const auth = platformAdminAuth(schoolId);

      const plan = productPlan({ id: "plan-1", displayName: "旧名称" });
      planRepo.add(plan);

      const result = await service.update(auth, "plan-1", {
        displayName: "新名称",
        expectedUpdatedAt: plan.updatedAt.getTime(),
      });

      expect(result.displayName).toBe("新名称");
    });

    it("rejects wrong expectedUpdatedAt with PlanVersionConflictException", async () => {
      const planRepo = new FakePlanRepository();
      const versionRepo = new FakePlanVersionRepository();
      const service = createService(planRepo, versionRepo);
      const auth = platformAdminAuth(schoolId);

      const plan = productPlan({ id: "plan-1" });
      planRepo.add(plan);

      await expect(
        service.update(auth, "plan-1", {
          displayName: "新名称",
          expectedUpdatedAt: 0,
        }),
      ).rejects.toThrow(PlanVersionConflictException);
    });

    it("throws PlanNotFoundException for nonexistent plan", async () => {
      const planRepo = new FakePlanRepository();
      const versionRepo = new FakePlanVersionRepository();
      const service = createService(planRepo, versionRepo);
      const auth = platformAdminAuth(schoolId);

      await expect(
        service.update(auth, "nonexistent", {
          displayName: "名称",
          expectedUpdatedAt: Date.now(),
        }),
      ).rejects.toThrow(PlanNotFoundException);
    });

    it("toggles isActive flag", async () => {
      const planRepo = new FakePlanRepository();
      const versionRepo = new FakePlanVersionRepository();
      const service = createService(planRepo, versionRepo);
      const auth = platformAdminAuth(schoolId);

      const plan = productPlan({ id: "plan-1", isActive: true });
      planRepo.add(plan);

      const result = await service.update(auth, "plan-1", {
        isActive: false,
        expectedUpdatedAt: plan.updatedAt.getTime(),
      });

      expect(result.isActive).toBe(false);
    });
  });

  describe("publishVersion", () => {
    it("increments publicVersion and creates version record", async () => {
      const planRepo = new FakePlanRepository();
      const versionRepo = new FakePlanVersionRepository();
      const service = createService(planRepo, versionRepo);
      const auth = platformAdminAuth(schoolId);

      const plan = productPlan({ id: "plan-1", publicVersion: 0 });
      planRepo.add(plan);

      const version = await service.publishVersion(auth, "plan-1");

      expect(version.version).toBe(1);
      expect(version.planId).toBe("plan-1");
      expect(version.publishedAt).not.toBeNull();

      const updatedPlan = await planRepo.findById("plan-1");
      expect(updatedPlan!.publicVersion).toBe(1);
    });

    it("throws PlanNotFoundException for nonexistent plan", async () => {
      const planRepo = new FakePlanRepository();
      const versionRepo = new FakePlanVersionRepository();
      const service = createService(planRepo, versionRepo);
      const auth = platformAdminAuth(schoolId);

      await expect(
        service.publishVersion(auth, "nonexistent"),
      ).rejects.toThrow(PlanNotFoundException);
    });
  });

  describe("authorization", () => {
    it("rejects non-platform-admin for create", async () => {
      const planRepo = new FakePlanRepository();
      const versionRepo = new FakePlanVersionRepository();
      const service = createService(planRepo, versionRepo);
      const auth = schoolAdminAuth(schoolId);

      await expect(
        service.create(auth, { tier: "INCLUSIVE", displayName: "普惠版" }),
      ).rejects.toThrow(PlanConflictException);
    });

    it("rejects non-platform-admin for update", async () => {
      const planRepo = new FakePlanRepository();
      const versionRepo = new FakePlanVersionRepository();
      const service = createService(planRepo, versionRepo);
      const auth = schoolAdminAuth(schoolId);

      planRepo.add(productPlan({ id: "plan-1" }));

      await expect(
        service.update(auth, "plan-1", {
          displayName: "新名称",
          expectedUpdatedAt: Date.now(),
        }),
      ).rejects.toThrow(PlanConflictException);
    });

    it("school_admin can view but not manage", async () => {
      const planRepo = new FakePlanRepository();
      const versionRepo = new FakePlanVersionRepository();
      const service = createService(planRepo, versionRepo);
      const auth = schoolAdminAuth(schoolId);

      planRepo.add(productPlan({ id: "plan-1" }));

      // Can view
      const plan = await service.findById(auth, "plan-1");
      expect(plan.id).toBe("plan-1");

      const list = await service.list(auth, { limit: 10 });
      expect(list.items).toHaveLength(1);

      // Cannot manage
      await expect(
        service.create(auth, { tier: "INCLUSIVE", displayName: "普惠版" }),
      ).rejects.toThrow(PlanConflictException);
    });

    it("teacher cannot view plans", async () => {
      const planRepo = new FakePlanRepository();
      const versionRepo = new FakePlanVersionRepository();
      const service = createService(planRepo, versionRepo);
      const auth = teacherAuth(schoolId);

      await expect(service.list(auth, { limit: 10 })).rejects.toThrow(
        PlanConflictException,
      );
    });
  });

  describe("fail-closed", () => {
    it("list throws when repository returns error", async () => {
      const planRepo = new FakePlanRepository();
      const versionRepo = new FakePlanVersionRepository();
      const service = createService(planRepo, versionRepo);
      const auth = platformAdminAuth(schoolId);

      // Simulate unavailable repository by making list throw
      planRepo.list = async () => {
        throw new Error("Repository unavailable");
      };

      await expect(service.list(auth, { limit: 10 })).rejects.toThrow(
        "Repository unavailable",
      );
    });
  });
});
