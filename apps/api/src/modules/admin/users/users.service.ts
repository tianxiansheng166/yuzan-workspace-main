import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { AuthContext } from "../../../common/security/auth.types.js";
import {
  AdminBadRequestException,
  AdminForbiddenException,
  AdminNotFoundException,
  UserAlreadyExistsException,
} from "../domain/admin.errors.js";
import type {
  AdminUserListOptions,
  AdminUserRepositoryPort,
} from "../ports/admin-user-repository.port.js";
import { ADMIN_USER_REPOSITORY } from "../ports/admin-user-repository.port.js";
import type { BulkImportUsersDto } from "../dto/bulk-import-users.dto.js";
import type { InviteUserDto } from "../dto/invite-user.dto.js";
import type { UpdateMembershipDto } from "../dto/update-membership.dto.js";
import { toAdminUserResponse } from "../dto/admin-user.response.js";
import { AdminUsersPolicy } from "./users.policy.js";
import { MembershipStatus } from "../../../common/security/auth.types.js";

@Injectable()
export class UsersService {
  private readonly policy = new AdminUsersPolicy();

  constructor(
    @Inject(ADMIN_USER_REPOSITORY)
    private readonly userRepo: AdminUserRepositoryPort,
  ) {}

  async list(auth: AuthContext, options: AdminUserListOptions) {
    if (!this.policy.canViewUsers(auth)) {
      throw new AdminForbiddenException();
    }

    // School admins can only list users in their own school.
    if (!this.policy.canManageUsers(auth) && options.schoolId) {
      const tenantSchoolId = auth.tenant.schoolId;
      if (options.schoolId !== tenantSchoolId) {
        throw new AdminForbiddenException();
      }
    }

    const result = await this.userRepo.list(options);
    return {
      items: result.items.map(toAdminUserResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async invite(auth: AuthContext, dto: InviteUserDto) {
    if (!this.policy.canInviteUsers(auth)) {
      throw new AdminForbiddenException();
    }

    const schoolId = dto.schoolId;
    if (!schoolId) {
      throw new AdminBadRequestException("缺少学校ID");
    }
    if (!this.policy.canManageUsers(auth) && schoolId) {
      const tenantSchoolId = auth.tenant.schoolId;
      if (schoolId !== tenantSchoolId) {
        throw new AdminForbiddenException();
      }
    }

    const existing = await this.userRepo.findByLoginIdentifier(
      dto.loginIdentifier,
    );
    if (existing) {
      throw new UserAlreadyExistsException(dto.loginIdentifier);
    }

    const user = await this.userRepo.invite(
      dto.loginIdentifier,
      dto.displayName,
      schoolId,
      dto.role,
    );
    return toAdminUserResponse(user);
  }

  async bulkImport(auth: AuthContext, dto: BulkImportUsersDto) {
    // Bulk import is platform-admin only.
    if (!this.policy.canBulkImport(auth)) {
      throw new AdminForbiddenException();
    }

    const entries = dto.users.map((u) => {
      if (!u.schoolId) {
        throw new AdminBadRequestException("批量导入条目缺少学校ID");
      }
      return {
        loginIdentifier: u.loginIdentifier,
        displayName: u.displayName,
        schoolId: u.schoolId,
        role: String(u.role),
      };
    });

    const result = await this.userRepo.bulkImport(entries);
    return result;
  }

  async updateMembership(
    auth: AuthContext,
    userId: string,
    membershipId: string,
    dto: UpdateMembershipDto,
  ) {
    if (!this.policy.canManageUsers(auth)) {
      throw new AdminForbiddenException();
    }

    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AdminNotFoundException("用户");
    }

    const membership = user.memberships.find((m) => m.id === membershipId);
    if (!membership) {
      throw new AdminNotFoundException("成员关系");
    }

    // School admins can only manage memberships in their own school.
    if (!this.policy.canManageUsers(auth) || !this.policy.canRevokeSessions(auth)) {
      const tenantSchoolId = auth.tenant.schoolId;
      if (membership.schoolId !== tenantSchoolId) {
        throw new AdminForbiddenException();
      }
    }

    const role = dto.role ?? membership.role;
    const status = dto.status ?? membership.status;

    await this.userRepo.updateMembership(
      membership.schoolId,
      userId,
      membershipId,
      String(role),
      String(status),
    );

    return toAdminUserResponse({
      ...user,
      memberships: user.memberships.map((m) =>
        m.id === membershipId ? { ...m, role: String(role), status: String(status) } : m,
      ),
    });
  }

  async revokeSessions(auth: AuthContext, userId: string) {
    if (!this.policy.canRevokeSessions(auth)) {
      throw new AdminForbiddenException();
    }

    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AdminNotFoundException("用户");
    }

    // School admins can only revoke sessions for users in their own school.
    if (!this.policy.canManageUsers(auth)) {
      const tenantSchoolId = auth.tenant.schoolId;
      const belongsToSchool = user.memberships.some(
        (m) => m.schoolId === tenantSchoolId,
      );
      if (!belongsToSchool) {
        throw new AdminForbiddenException();
      }
    }

    await this.userRepo.revokeSessions(userId);
    return { userId, revoked: true };
  }
}
