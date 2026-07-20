import { describe, expect, it, vi } from "vitest";
import { PlansStubController } from "../../../src/modules/mvp-gaps/plans-stub.controller.js";

describe("PlansStubController", () => {
  it("returns only active plans and enabled entitlements", async () => {
    const prisma: any = { productPlan: { findMany: vi.fn().mockResolvedValue([{ id: "p1", code: "BASIC", name: "基础版", version: 1, priceCents: 0, currency: "CNY", trialDays: 14, entitlements: [{ key: "students", limitValue: 100, config: null }] }]) } };
    const controller = new PlansStubController(prisma);
    const result = await controller.listPublicPlans("10");

    expect(result.data.items[0].code).toBe("BASIC");
    expect(prisma.productPlan.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "ACTIVE" }, take: 10, select: expect.objectContaining({ entitlements: expect.objectContaining({ where: { enabled: true } }) }) }));
  });
});
