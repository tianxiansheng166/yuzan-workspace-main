import { randomUUID } from "node:crypto";
import type {
  AdminUser,
  BulkImportResult,
} from "../../../src/modules/admin/domain/admin.types.js";
import type {
  AdminUserListOptions,
  AdminUserListResult,
  AdminUserRepositoryPort,
} from "../../../src/modules/admin/ports/admin-user-repository.port.js";

export class FakeAdminUserRepository implements AdminUserRepositoryPort {
  private readonly users = new Map<string, AdminUser>();
  private readonly loginIndex = new Map<string, AdminUser>();
  public revokeSessionsCalls: string[] = [];
  public updateMembershipCalls: Array<{
    schoolId: string;
    userId: string;
    membershipId: string;
    role: string;
    status: string;
  }> = [];

  add(...users: AdminUser[]): void {
    for (const user of users) {
      this.users.set(user.id, user);
      this.loginIndex.set(user.loginIdentifier, user);
    }
  }

  async list(options: AdminUserListOptions): Promise<AdminUserListResult> {
    let items = Array.from(this.users.values());

    if (options.schoolId) {
      items = items.filter((u) =>
        u.memberships.some((m) => m.schoolId === options.schoolId),
      );
    }

    if (options.role) {
      items = items.filter((u) =>
        u.memberships.some((m) => m.role === options.role),
      );
    }

    if (options.status) {
      items = items.filter((u) => u.status === options.status);
    }

    if (options.search) {
      const search = options.search.toLowerCase();
      items = items.filter(
        (u) =>
          u.displayName.toLowerCase().includes(search) ||
          u.loginIdentifier.toLowerCase().includes(search),
      );
    }

    // Sort by createdAt descending for stable ordering
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Cursor-based pagination
    let startIndex = 0;
    if (options.cursor) {
      const cursorIndex = items.findIndex((u) => u.id === options.cursor);
      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1;
      }
    }

    const paginated = items.slice(startIndex, startIndex + options.limit);
    const hasMore = startIndex + options.limit < items.length;
    const lastItem = paginated[paginated.length - 1];

    return {
      items: paginated,
      nextCursor: lastItem?.id ?? null,
      hasMore,
    };
  }

  async findById(id: string): Promise<AdminUser | null> {
    return this.users.get(id) ?? null;
  }

  async findByLoginIdentifier(
    loginIdentifier: string,
  ): Promise<AdminUser | null> {
    return this.loginIndex.get(loginIdentifier) ?? null;
  }

  async invite(
    loginIdentifier: string,
    displayName: string,
    schoolId: string,
    role: string,
  ): Promise<AdminUser> {
    const now = new Date();
    const user: AdminUser = {
      id: randomUUID(),
      loginIdentifier,
      displayName,
      preferredLocale: "zh-CN",
      status: "INVITED",
      memberships: [
        {
          id: randomUUID(),
          schoolId,
          schoolName: "学校",
          role,
          status: "INVITED",
          joinedAt: now,
        },
      ],
      lastActiveAt: null,
      createdAt: now,
    };
    this.users.set(user.id, user);
    this.loginIndex.set(user.loginIdentifier, user);
    return user;
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
      const existing = this.loginIndex.get(entry.loginIdentifier);
      if (existing) {
        results.push({
          loginIdentifier: entry.loginIdentifier,
          success: false,
          error: "用户已存在",
        });
      } else {
        await this.invite(
          entry.loginIdentifier,
          entry.displayName,
          entry.schoolId,
          entry.role,
        );
        results.push({ loginIdentifier: entry.loginIdentifier, success: true });
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
    this.updateMembershipCalls.push({
      schoolId,
      userId,
      membershipId,
      role,
      status,
    });
    const user = this.users.get(userId);
    if (user) {
      const updatedMemberships = user.memberships.map((m) =>
        m.id === membershipId ? { ...m, role, status } : m,
      );
      this.users.set(userId, { ...user, memberships: updatedMemberships });
    }
  }

  async revokeSessions(userId: string): Promise<void> {
    this.revokeSessionsCalls.push(userId);
  }
}
