import type { AdminSchool } from "../../../src/modules/admin/domain/admin.types.js";

export function adminSchool(
  overrides: Partial<AdminSchool> & Pick<AdminSchool, "id">,
): AdminSchool {
  const now = new Date("2026-07-10T00:00:00Z");
  return {
    code: "SCH001",
    name: "拉萨市第一小学",
    timezone: "Asia/Shanghai",
    regionCode: null,
    isActive: true,
    planId: null,
    planTier: null,
    membershipCount: 0,
    classCount: 0,
    courseCount: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}
