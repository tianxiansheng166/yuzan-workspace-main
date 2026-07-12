import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  MembershipRole,
  MembershipStatus,
  type Prisma,
  UserStatus,
} from "@yuzan/database";
import { PrismaService } from "../../../shared/database/prisma.service.js";
import {
  AdminNotFoundException,
  AdminUnavailableException,
  UserAlreadyExistsException,
} from "../domain/admin.errors.js";
import type { AdminUser, BulkImportResult } from "../domain/admin.types.js";
import type {
  AdminUserListOptions,
  AdminUserListResult,
  AdminUserRepositoryPort,
} from "../ports/admin-user-repository.port.js";

const userIncludeArgs = {
  include: { memberships: { include: { school: true } } },
} as const;

type UserRow = Prisma.UserGetPayload<typeof userIncludeArgs>;

@Injectable()
export class PrismaAdminUserRepository implements AdminUserRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async list(options: AdminUserListOptions): Promise<AdminUserListResult> {
    try {
      const where: Prisma.UserWhereInput = {};
      const membershipWhere: Prisma.MembershipWhereInput = {};

      if (options.schoolId) {
        membershipWhere.schoolId = options.schoolId;
      }
      if (options.role) {
        membershipWhere.role = options.role as MembershipRole;
      }
      if (options.status) {
        where.status = options.status as UserStatus;
      }

      if (Object.keys(membershipWhere).length > 0) {
        where.memberships = { some: membershipWhere };
      }

      if (options.search) {
        where.OR = [
          { displayName: { contains: options.search, mode: "insensitive" } },
          { loginIdentifier: { contains: options.search, mode: "insensitive" } },
        ];
      }

      const take = options.limit;
      const skip = options.cursor ? 1 : 0;
      const cursor = options.cursor
        ? ({ id: options.cursor } satisfies Prisma.UserWhereUniqueInput)
        : undefined;

      const rows = await this.prisma.user.findMany({
        where,
        ...userIncludeArgs,
        orderBy: { createdAt: "desc" },
        take: take + 1,
        skip,
        ...(cursor ? { cursor } : {}),
      });

      const hasMore = rows.length > take;
      const items = rows.slice(0, take).map(toAdminUser);
      const lastItem = items[items.length - 1];

      return {
        items,
        nextCursor: hasMore ? (lastItem?.id ?? null) : null,
        hasMore,
      };
    } catch (err) {
      if (err instanceof AdminUnavailableException) throw err;
      throw new AdminUnavailableException();
    }
  }

  async findById(userId: string): Promise<AdminUser | null> {
    try {
      const row = await this.prisma.user.findUnique({
        where: { id: userId },
        ...userIncludeArgs,
      });
      return row ? toAdminUser(row) : null;
    } catch (err) {
      if (err instanceof AdminUnavailableException) throw err;
      throw new AdminUnavailableException();
    }
  }

  async findByLoginIdentifier(
    loginIdentifier: string,
  ): Promise<AdminUser | null> {
    try {
      const row = await this.prisma.user.findUnique({
        where: { loginIdentifier },
        ...userIncludeArgs,
      });
      return row ? toAdminUser(row) : null;
    } catch (err) {
      if (err instanceof AdminUnavailableException) throw err;
      throw new AdminUnavailableException();
    }
  }

  async invite(
    loginIdentifier: string,
    displayName: string,
    schoolId: string,
    role: string,
  ): Promise<AdminUser> {
    try {
      const existing = await this.prisma.user.findUnique({
        where: { loginIdentifier },
      });
      if (existing) {
        throw new UserAlreadyExistsException(loginIdentifier);
      }

      const now = new Date();
      const row = await this.prisma.user.create({
        data: {
          id: randomUUID(),
          loginIdentifier,
          displayName,
          passwordHash: "", // Invited users set password later
          status: UserStatus.ACTIVE,
          memberships: {
            create: {
              id: randomUUID(),
              schoolId,
              role: role as MembershipRole,
              status: MembershipStatus.INVITED,
              joinedAt: now,
            },
          },
        },
        ...userIncludeArgs,
      });

      return toAdminUser(row);
    } catch (err) {
      if (
        err instanceof UserAlreadyExistsException ||
        err instanceof AdminUnavailableException
      ) {
        throw err;
      }
      throw new AdminUnavailableException();
    }
  }

  async bulkImport(
    users: readonly {
      loginIdentifier: string;
      displayName: string;
      schoolId: string;
      role: string;
    }[],
  ): Promise<BulkImportResult> {
    const results: {
      loginIdentifier: string;
      success: boolean;
      error?: string;
    }[] = [];

    for (const entry of users) {
      try {
        await this.invite(
          entry.loginIdentifier,
          entry.displayName,
          entry.schoolId,
          entry.role,
        );
        results.push({ loginIdentifier: entry.loginIdentifier, success: true });
      } catch (err) {
        if (err instanceof UserAlreadyExistsException) {
          results.push({
            loginIdentifier: entry.loginIdentifier,
            success: false,
            error: "用户已存在",
          });
        } else {
          throw err;
        }
      }
    }

    return results;
  }

  async updateMembership(
    schoolId: string,
    userId: string,
    membershipId: string,
    role: string,
    status: string,
  ): Promise<void> {
    try {
      const membership = await this.prisma.membership.findFirst({
        where: { id: membershipId, userId, schoolId },
      });
      if (!membership) {
        throw new AdminNotFoundException("成员关系");
      }

      await this.prisma.membership.update({
        where: { id: membershipId },
        data: {
          role: role as MembershipRole,
          status: status as MembershipStatus,
        },
      });
    } catch (err) {
      if (
        err instanceof AdminNotFoundException ||
        err instanceof AdminUnavailableException
      ) {
        throw err;
      }
      throw new AdminUnavailableException();
    }
  }

  async revokeSessions(userId: string): Promise<void> {
    try {
      await this.prisma.sessionPair.updateMany({
        where: { userId },
        data: { revokedAt: new Date() },
      });
    } catch (err) {
      if (err instanceof AdminUnavailableException) throw err;
      throw new AdminUnavailableException();
    }
  }
}

function toAdminUser(row: UserRow): AdminUser {
  return {
    id: row.id,
    loginIdentifier: row.loginIdentifier,
    displayName: row.displayName,
    preferredLocale: row.preferredLocale,
    status: row.status,
    memberships: row.memberships.map((m) => ({
      id: m.id,
      schoolId: m.schoolId,
      schoolName: m.school.name,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt,
    })),
    lastActiveAt: null,
    createdAt: row.createdAt,
  };
}
