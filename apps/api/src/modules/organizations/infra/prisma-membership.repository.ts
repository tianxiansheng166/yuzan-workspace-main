import { Inject, Injectable } from "@nestjs/common";
import { MEMBERSHIP_ROLES } from "../../../common/security/membership-role.js";
import type {
  MembershipRole,
  MembershipStatus,
} from "../../../common/security/index.js";
import { OrganizationUnavailableException } from "../domain/organization.errors.js";
import type { Membership, SchoolMember } from "../domain/organization.types.js";
import type {
  ListMembersOptions,
  MembershipRepositoryPort,
  PaginatedResult,
} from "../ports/membership-repository.port.js";
import { PrismaService } from "./prisma/prisma.service.js";
import type { Membership as PrismaMembership } from "./prisma/generated/client.js";

const ACTIVE = "ACTIVE" as const;

@Injectable()
export class PrismaMembershipRepository implements MembershipRepositoryPort {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async findMembership(
    schoolId: string,
    userId: string,
  ): Promise<Membership | null> {
    try {
      const row = await this.prisma.membership.findFirst({
        where: { schoolId, userId, status: ACTIVE },
        orderBy: { joinedAt: "desc" },
      });
      return row && isExecutableRole(row.role) ? toMembership(row) : null;
    } catch {
      throw new OrganizationUnavailableException();
    }
  }

  async listMembers(
    schoolId: string,
    options: ListMembersOptions,
  ): Promise<PaginatedResult<SchoolMember>> {
    try {
      const rows = await this.prisma.membership.findMany({
        where: {
          schoolId,
          ...(options.role ? { role: options.role } : {}),
          ...(options.status ? { status: options.status } : {}),
        },
        include: { user: true },
        orderBy: { joinedAt: "desc" },
        take: options.limit + 1,
        ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      });

      const hasMore = rows.length > options.limit;
      const items = rows.slice(0, options.limit).map((row) => ({
        userId: row.userId,
        displayName: row.user.displayName,
        role: row.role as MembershipRole,
        status: row.status as MembershipStatus,
      }));

      return {
        items,
        nextCursor: hasMore ? (rows[options.limit - 1]?.id ?? null) : null,
        hasMore,
      };
    } catch {
      throw new OrganizationUnavailableException();
    }
  }

  async listMembershipsByUser(userId: string): Promise<readonly Membership[]> {
    try {
      const rows = await this.prisma.membership.findMany({
        where: { userId, status: ACTIVE },
        orderBy: { joinedAt: "desc" },
      });
      return rows.filter((row) => isExecutableRole(row.role)).map(toMembership);
    } catch {
      throw new OrganizationUnavailableException();
    }
  }
}

function toMembership(row: PrismaMembership): Membership {
  return {
    userId: row.userId,
    schoolId: row.schoolId,
    role: row.role as MembershipRole,
    status: row.status as MembershipStatus,
    joinedAt: row.joinedAt,
  };
}

function isExecutableRole(role: string): role is MembershipRole {
  return MEMBERSHIP_ROLES.includes(role as MembershipRole);
}
