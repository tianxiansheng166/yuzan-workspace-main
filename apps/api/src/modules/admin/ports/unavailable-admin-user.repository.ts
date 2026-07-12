import { Injectable } from "@nestjs/common";
import type {
  AdminUser,
  BulkImportResult,
} from "../domain/admin.types.js";
import { AdminUnavailableException } from "../domain/admin.errors.js";
import type {
  AdminUserListOptions,
  AdminUserListResult,
  AdminUserRepositoryPort,
} from "./admin-user-repository.port.js";

@Injectable()
export class UnavailableAdminUserRepository
  implements AdminUserRepositoryPort
{
  async list(_options: AdminUserListOptions): Promise<AdminUserListResult> {
    throw new AdminUnavailableException();
  }

  async findById(_userId: string): Promise<AdminUser | null> {
    throw new AdminUnavailableException();
  }

  async findByLoginIdentifier(
    _loginIdentifier: string,
  ): Promise<AdminUser | null> {
    throw new AdminUnavailableException();
  }

  async invite(
    _loginIdentifier: string,
    _displayName: string,
    _schoolId: string,
    _role: string,
  ): Promise<AdminUser> {
    throw new AdminUnavailableException();
  }

  async bulkImport(
    _users: readonly {
      loginIdentifier: string;
      displayName: string;
      schoolId: string;
      role: string;
    }[],
  ): Promise<BulkImportResult> {
    throw new AdminUnavailableException();
  }

  async updateMembership(
    _schoolId: string,
    _userId: string,
    _membershipId: string,
    _role: string,
    _status: string,
  ): Promise<void> {
    throw new AdminUnavailableException();
  }

  async revokeSessions(_userId: string): Promise<void> {
    throw new AdminUnavailableException();
  }
}
