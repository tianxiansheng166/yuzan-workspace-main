import type {
  MembershipRole,
  MembershipStatus,
} from "../../../src/common/security/index.js";
import type {
  Membership,
  SchoolMember,
} from "../../../src/modules/organizations/domain/organization.types.js";
import type {
  ListMembersOptions,
  MembershipRepositoryPort,
  PaginatedResult,
} from "../../../src/modules/organizations/ports/membership-repository.port.js";

export class FakeMembershipRepository implements MembershipRepositoryPort {
  private readonly memberships = new Map<string, Membership>();

  private key(schoolId: string, userId: string): string {
    return `${schoolId}:${userId}`;
  }

  add(...memberships: Membership[]): void {
    for (const m of memberships) {
      this.memberships.set(this.key(m.schoolId, m.userId), m);
    }
  }

  async findMembership(
    schoolId: string,
    userId: string,
  ): Promise<Membership | null> {
    return this.memberships.get(this.key(schoolId, userId)) ?? null;
  }

  async listMembers(
    schoolId: string,
    options: ListMembersOptions,
  ): Promise<PaginatedResult<SchoolMember>> {
    let all = Array.from(this.memberships.values()).filter(
      (m) => m.schoolId === schoolId,
    );

    if (options.role) {
      all = all.filter((m) => m.role === options.role);
    }
    if (options.status) {
      all = all.filter((m) => m.status === options.status);
    }

    const limit = options.limit;
    const start = options.cursor ? Number.parseInt(options.cursor, 10) : 0;
    const items = all.slice(start, start + limit).map((m) => ({
      userId: m.userId,
      displayName: `User ${m.userId}`,
      role: m.role,
      status: m.status,
    }));

    return {
      items,
      nextCursor: all.length > start + limit ? String(start + limit) : null,
      hasMore: all.length > start + limit,
    };
  }

  async listMembershipsByUser(userId: string): Promise<readonly Membership[]> {
    return Array.from(this.memberships.values()).filter(
      (m) => m.userId === userId,
    );
  }
}
