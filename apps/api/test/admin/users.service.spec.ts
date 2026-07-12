import { beforeEach, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import { UsersService } from "../../src/modules/admin/users/users.service.js";
import { AdminModule } from "../../src/modules/admin/admin.module.js";
import { ADMIN_USER_REPOSITORY } from "../../src/modules/admin/ports/admin-user-repository.port.js";
import { FakeAdminUserRepository } from "./fakes/fake-admin-user.repository.js";
import {
  platformAdminAuth,
  schoolAdminAuth,
  teacherAuth,
  studentAuth,
} from "../fixtures/auth.js";
import {
  AdminForbiddenException,
  AdminNotFoundException,
  UserAlreadyExistsException,
} from "../../src/modules/admin/domain/admin.errors.js";
import { MembershipRole, MembershipStatus } from "../../src/common/security/index.js";
import { adminUser } from "./fixtures/users.js";

describe("UsersService", () => {
  let service: UsersService;
  let userRepo: FakeAdminUserRepository;
  const schoolId = "school-a";

  beforeEach(async () => {
    userRepo = new FakeAdminUserRepository();

    const moduleRef = await Test.createTestingModule({
      imports: [AdminModule],
    })
      .overrideProvider(ADMIN_USER_REPOSITORY)
      .useValue(userRepo)
      .compile();

    service = moduleRef.get(UsersService);
  });

  describe("list", () => {
    it("returns filtered users for platform admin", async () => {
      const auth = platformAdminAuth(schoolId);
      userRepo.add(
        adminUser({
          id: "u1",
          loginIdentifier: "user1@example.com",
          displayName: "用户A",
          memberships: [
            { id: "m1", schoolId, schoolName: "学校A", role: MembershipRole.TEACHER, status: "ACTIVE", joinedAt: new Date() },
          ],
        }),
        adminUser({
          id: "u2",
          loginIdentifier: "user2@example.com",
          displayName: "用户B",
          status: "SUSPENDED",
          memberships: [
            { id: "m2", schoolId, schoolName: "学校A", role: MembershipRole.STUDENT, status: "ACTIVE", joinedAt: new Date() },
          ],
        }),
      );

      const result = await service.list(auth, { limit: 10, status: "ACTIVE" });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.displayName).toBe("用户A");
    });

    it("returns users filtered by schoolId", async () => {
      const auth = platformAdminAuth(schoolId);
      userRepo.add(
        adminUser({
          id: "u1",
          memberships: [
            { id: "m1", schoolId, schoolName: "学校A", role: MembershipRole.TEACHER, status: "ACTIVE", joinedAt: new Date() },
          ],
        }),
        adminUser({
          id: "u2",
          memberships: [
            { id: "m2", schoolId: "school-b", schoolName: "学校B", role: MembershipRole.TEACHER, status: "ACTIVE", joinedAt: new Date() },
          ],
        }),
      );

      const result = await service.list(auth, { limit: 10, schoolId });
      expect(result.items).toHaveLength(1);
    });

    it("allows school admin to list users", async () => {
      const auth = schoolAdminAuth(schoolId);
      userRepo.add(adminUser({ id: "u1" }));

      const result = await service.list(auth, { limit: 10 });
      expect(result.items).toHaveLength(1);
    });

    it("rejects teacher", async () => {
      const auth = teacherAuth(schoolId);
      await expect(
        service.list(auth, { limit: 10 }),
      ).rejects.toThrow(AdminForbiddenException);
    });

    it("rejects student", async () => {
      const auth = studentAuth(schoolId);
      await expect(
        service.list(auth, { limit: 10 }),
      ).rejects.toThrow(AdminForbiddenException);
    });
  });

  describe("invite", () => {
    it("creates a new user", async () => {
      const auth = platformAdminAuth(schoolId);
      const result = await service.invite(auth, {
        loginIdentifier: "new@example.com",
        displayName: "新用户",
        schoolId,
        role: MembershipRole.TEACHER,
      });

      expect(result.loginIdentifier).toBe("new@example.com");
      expect(result.displayName).toBe("新用户");
      expect(result.status).toBe("INVITED");
    });

    it("rejects duplicate user with UserAlreadyExistsException", async () => {
      const auth = platformAdminAuth(schoolId);
      userRepo.add(
        adminUser({ id: "u1", loginIdentifier: "existing@example.com" }),
      );

      await expect(
        service.invite(auth, {
          loginIdentifier: "existing@example.com",
          displayName: "重复用户",
          schoolId,
          role: MembershipRole.TEACHER,
        }),
      ).rejects.toThrow(UserAlreadyExistsException);
    });

    it("allows school admin to invite users", async () => {
      const auth = schoolAdminAuth(schoolId);
      const result = await service.invite(auth, {
        loginIdentifier: "new@example.com",
        displayName: "新用户",
        schoolId,
        role: MembershipRole.TEACHER,
      });
      expect(result.loginIdentifier).toBe("new@example.com");
    });

    it("rejects teacher from inviting users", async () => {
      const auth = teacherAuth(schoolId);
      await expect(
        service.invite(auth, {
          loginIdentifier: "new@example.com",
          displayName: "新用户",
          schoolId,
          role: MembershipRole.TEACHER,
        }),
      ).rejects.toThrow(AdminForbiddenException);
    });
  });

  describe("bulkImport", () => {
    it("handles successful bulk import", async () => {
      const auth = platformAdminAuth(schoolId);
      const result = await service.bulkImport(auth, {
        users: [
          {
            loginIdentifier: "bulk1@example.com",
            displayName: "批量用户1",
            schoolId,
            role: MembershipRole.STUDENT,
          },
          {
            loginIdentifier: "bulk2@example.com",
            displayName: "批量用户2",
            schoolId,
            role: MembershipRole.STUDENT,
          },
        ],
      });

      expect(result).toHaveLength(2);
      expect(result[0]!.success).toBe(true);
      expect(result[1]!.success).toBe(true);
    });

    it("handles partial failure in bulk import", async () => {
      const auth = platformAdminAuth(schoolId);
      userRepo.add(
        adminUser({ id: "u1", loginIdentifier: "existing@example.com" }),
      );

      const result = await service.bulkImport(auth, {
        users: [
          {
            loginIdentifier: "existing@example.com",
            displayName: "已存在用户",
            schoolId,
            role: MembershipRole.STUDENT,
          },
          {
            loginIdentifier: "new@example.com",
            displayName: "新用户",
            schoolId,
            role: MembershipRole.STUDENT,
          },
        ],
      });

      expect(result).toHaveLength(2);
      expect(result[0]!.success).toBe(false);
      expect(result[1]!.success).toBe(true);
    });

    it("rejects non-platform-admin from bulk import", async () => {
      const auth = schoolAdminAuth(schoolId);
      await expect(
        service.bulkImport(auth, { users: [] }),
      ).rejects.toThrow(AdminForbiddenException);
    });
  });

  describe("updateMembership", () => {
    it("modifies user role and status", async () => {
      const auth = platformAdminAuth(schoolId);
      userRepo.add(
        adminUser({
          id: "u1",
          memberships: [
            {
              id: "m1",
              schoolId,
              schoolName: "学校A",
              role: MembershipRole.TEACHER,
              status: "ACTIVE",
              joinedAt: new Date(),
            },
          ],
        }),
      );

      const result = await service.updateMembership(
        auth,
        "u1",
        "m1",
        { expectedUpdatedAt: new Date().toISOString(), role: MembershipRole.SCHOOL_ADMIN },
      );

      expect(result.id).toBe("u1");
    });

    it("throws AdminNotFoundException when user not found", async () => {
      const auth = platformAdminAuth(schoolId);
      await expect(
        service.updateMembership(auth, "nonexistent", "m1", {
          expectedUpdatedAt: new Date().toISOString(),
          role: MembershipRole.SCHOOL_ADMIN,
        }),
      ).rejects.toThrow(AdminNotFoundException);
    });

    it("throws AdminNotFoundException when user has no memberships", async () => {
      const auth = platformAdminAuth(schoolId);
      userRepo.add(adminUser({ id: "u1", memberships: [] }));

      await expect(
        service.updateMembership(auth, "u1", "m1", {
          expectedUpdatedAt: new Date().toISOString(),
        }),
      ).rejects.toThrow(AdminNotFoundException);
    });

    it("rejects school admin from different school", async () => {
      const otherSchoolId = "school-b";
      const auth = schoolAdminAuth(otherSchoolId);
      userRepo.add(
        adminUser({
          id: "u1",
          memberships: [
            {
              id: "m1",
              schoolId,
              schoolName: "学校A",
              role: MembershipRole.TEACHER,
              status: "ACTIVE",
              joinedAt: new Date(),
            },
          ],
        }),
      );

      await expect(
        service.updateMembership(auth, "u1", "m1", {
          expectedUpdatedAt: new Date().toISOString(),
        }),
      ).rejects.toThrow(AdminForbiddenException);
    });
  });

  describe("revokeSessions", () => {
    it("calls through to repository", async () => {
      const auth = platformAdminAuth(schoolId);
      userRepo.add(
        adminUser({
          id: "u1",
          memberships: [
            {
              id: "m1",
              schoolId,
              schoolName: "学校A",
              role: MembershipRole.TEACHER,
              status: "ACTIVE",
              joinedAt: new Date(),
            },
          ],
        }),
      );

      const result = await service.revokeSessions(auth, "u1");
      expect(result.userId).toBe("u1");
      expect(result.revoked).toBe(true);
      expect(userRepo.revokeSessionsCalls).toContain("u1");
    });

    it("throws AdminNotFoundException when user not found", async () => {
      const auth = platformAdminAuth(schoolId);
      await expect(
        service.revokeSessions(auth, "nonexistent"),
      ).rejects.toThrow(AdminNotFoundException);
    });

    it("rejects school admin from different school", async () => {
      const otherSchoolId = "school-b";
      const auth = schoolAdminAuth(otherSchoolId);
      userRepo.add(
        adminUser({
          id: "u1",
          memberships: [
            {
              id: "m1",
              schoolId,
              schoolName: "学校A",
              role: MembershipRole.TEACHER,
              status: "ACTIVE",
              joinedAt: new Date(),
            },
          ],
        }),
      );

      await expect(
        service.revokeSessions(auth, "u1"),
      ).rejects.toThrow(AdminForbiddenException);
    });
  });

  describe("fail-closed with unavailable repositories", () => {
    it("throws when user repository is unavailable", async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [AdminModule],
      }).compile();
      const svc = moduleRef.get(UsersService);
      const auth = platformAdminAuth(schoolId);

      await expect(svc.list(auth, { limit: 10 })).rejects.toThrow();
    });
  });
});
