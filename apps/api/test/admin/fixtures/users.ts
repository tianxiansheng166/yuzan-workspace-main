import type { AdminUser } from "../../../src/modules/admin/domain/admin.types.js";

export function adminUser(
  overrides: Partial<AdminUser> & Pick<AdminUser, "id">,
): AdminUser {
  const now = new Date("2026-07-10T00:00:00Z");
  return {
    loginIdentifier: `user-${overrides.id}@example.com`,
    displayName: "测试用户",
    preferredLocale: "zh-CN",
    status: "ACTIVE",
    memberships: [],
    lastActiveAt: null,
    createdAt: now,
    ...overrides,
  };
}
