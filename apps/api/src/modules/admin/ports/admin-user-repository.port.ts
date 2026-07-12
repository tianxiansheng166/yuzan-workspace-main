import type {
  AdminUser,
  BulkImportResult,
} from "../domain/admin.types.js";

export const ADMIN_USER_REPOSITORY = Symbol("ADMIN_USER_REPOSITORY");

export interface AdminUserListOptions {
  readonly schoolId?: string;
  readonly role?: string;
  readonly status?: string;
  readonly search?: string;
  readonly cursor?: string;
  readonly limit: number;
}

export interface AdminUserListResult {
  readonly items: readonly AdminUser[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export interface AdminUserRepositoryPort {
  list(options: AdminUserListOptions): Promise<AdminUserListResult>;
  findById(userId: string): Promise<AdminUser | null>;
  findByLoginIdentifier(loginIdentifier: string): Promise<AdminUser | null>;
  invite(
    loginIdentifier: string,
    displayName: string,
    schoolId: string,
    role: string,
  ): Promise<AdminUser>;
  bulkImport(
    users: readonly {
      loginIdentifier: string;
      displayName: string;
      schoolId: string;
      role: string;
    }[],
  ): Promise<BulkImportResult>;
  updateMembership(
    schoolId: string,
    userId: string,
    membershipId: string,
    role: string,
    status: string,
  ): Promise<void>;
  revokeSessions(userId: string): Promise<void>;
}
