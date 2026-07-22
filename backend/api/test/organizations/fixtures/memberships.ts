import type {
  MembershipRole,
  MembershipStatus,
} from "../../../src/common/security/index.js";
import type { Membership } from "../../../src/modules/organizations/domain/organization.types.js";

export function membership(
  overrides: Partial<Membership> &
    Pick<Membership, "userId" | "schoolId" | "role" | "status">,
): Membership {
  return {
    joinedAt: new Date("2026-07-10T00:00:00Z"),
    ...overrides,
  };
}
