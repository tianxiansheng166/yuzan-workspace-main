import type { School } from "../../../src/modules/organizations/domain/organization.types.js";

export function school(
  overrides: Partial<School> & Pick<School, "id">,
): School {
  const now = new Date("2026-07-10T00:00:00Z");
  return {
    name: "拉萨市第一小学",
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
