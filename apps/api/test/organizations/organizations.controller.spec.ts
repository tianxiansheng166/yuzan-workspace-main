import { beforeEach, describe, expect, it } from "vitest";
import { ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import {
  AUTH_CONTEXT_SOURCE,
  AuthenticationGuard,
  createAuthContext,
  MembershipRole,
  MembershipStatus,
  PolicyGuard,
  TenantAuthorizationGuard,
} from "../../src/common/security/index.js";
import { StubAuthContextSource } from "../../src/modules/auth/stub-auth-context.source.js";
import { OrganizationsController } from "../../src/modules/organizations/organizations.controller.js";
import { OrganizationsModule } from "../../src/modules/organizations/organizations.module.js";
import { PrismaService } from "../../src/modules/organizations/infra/prisma/prisma.service.js";
import { MEMBERSHIP_REPOSITORY } from "../../src/modules/organizations/ports/membership-repository.port.js";
import { SCHOOL_REPOSITORY } from "../../src/modules/organizations/ports/school-repository.port.js";
import { FakeMembershipRepository } from "./fakes/fake-membership.repository.js";
import { FakeSchoolRepository } from "./fakes/fake-school.repository.js";
import { membership } from "./fixtures/memberships.js";
import { school } from "./fixtures/schools.js";

describe("OrganizationsController", () => {
  let controller: OrganizationsController;
  let schoolRepo: FakeSchoolRepository;
  let membershipRepo: FakeMembershipRepository;
  let reflector: Reflector;

  beforeEach(async () => {
    schoolRepo = new FakeSchoolRepository();
    membershipRepo = new FakeMembershipRepository();

    const moduleRef = await Test.createTestingModule({
      imports: [OrganizationsModule],
    })
      .overrideProvider(SCHOOL_REPOSITORY)
      .useValue(schoolRepo)
      .overrideProvider(MEMBERSHIP_REPOSITORY)
      .useValue(membershipRepo)
      .overrideProvider(PrismaService)
      .useValue({} as unknown as PrismaService)
      .overrideProvider(AUTH_CONTEXT_SOURCE)
      .useValue(new StubAuthContextSource())
      .compile();

    controller = moduleRef.get(OrganizationsController);
    reflector = moduleRef.get(Reflector);
  });

  describe("getSchool", () => {
    it("allows school admin to read own school", async () => {
      schoolRepo.add(school({ id: "school-a", name: "本校" }));
      const principal = {
        userId: "admin-1",
        roles: [MembershipRole.SCHOOL_ADMIN],
        membershipStatus: "ACTIVE" as const,
        source: "stub",
      };
      const tenant = { schoolId: "school-a" };

      const result = await controller.getSchool("school-a", tenant, principal);
      expect(result.id).toBe("school-a");
    });

    it("rejects cross-school admin", async () => {
      schoolRepo.add(school({ id: "school-b", name: "外校" }));
      const principal = {
        userId: "admin-1",
        roles: [MembershipRole.SCHOOL_ADMIN],
        membershipStatus: "ACTIVE" as const,
        source: "stub",
      };
      const tenant = { schoolId: "school-a" };

      await expect(
        controller.getSchool("school-b", tenant, principal),
      ).rejects.toThrow();
    });

    it("returns not found for unknown school", async () => {
      const principal = {
        userId: "admin-1",
        roles: [MembershipRole.SCHOOL_ADMIN],
        membershipStatus: "ACTIVE" as const,
        source: "stub",
      };
      const tenant = { schoolId: "school-a" };

      await expect(
        controller.getSchool("school-a", tenant, principal),
      ).rejects.toThrow();
    });
  });

  describe("listMembers", () => {
    it("lists active members for teacher", async () => {
      schoolRepo.add(school({ id: "school-a" }));
      membershipRepo.add(
        membership({
          userId: "student-1",
          schoolId: "school-a",
          role: MembershipRole.STUDENT,
          status: MembershipStatus.ACTIVE,
        }),
      );
      membershipRepo.add(
        membership({
          userId: "teacher-1",
          schoolId: "school-a",
          role: MembershipRole.TEACHER,
          status: MembershipStatus.ACTIVE,
        }),
      );

      const principal = {
        userId: "teacher-1",
        roles: [MembershipRole.TEACHER],
        membershipStatus: "ACTIVE" as const,
        source: "stub",
      };
      const tenant = { schoolId: "school-a" };

      const result = await controller.listMembers(
        "school-a",
        { limit: 20 } as never,
        tenant,
        principal,
      );
      expect(result.items).toHaveLength(2);
    });

    it("rejects student listing members", async () => {
      schoolRepo.add(school({ id: "school-a" }));
      const principal = {
        userId: "student-1",
        roles: [MembershipRole.STUDENT],
        membershipStatus: "ACTIVE" as const,
        source: "stub",
      };
      const tenant = { schoolId: "school-a" };

      const roles = reflector.get("requiredRoles", controller.listMembers);
      expect(roles).not.toContain(MembershipRole.STUDENT);
    });
  });

  describe("getMyMembership", () => {
    it("returns own membership", async () => {
      schoolRepo.add(school({ id: "school-a", name: "本校" }));
      membershipRepo.add(
        membership({
          userId: "teacher-1",
          schoolId: "school-a",
          role: MembershipRole.TEACHER,
          status: MembershipStatus.ACTIVE,
        }),
      );

      const principal = {
        userId: "teacher-1",
        roles: [MembershipRole.TEACHER],
        membershipStatus: "ACTIVE" as const,
        source: "stub",
      };
      const tenant = { schoolId: "school-a" };

      const result = await controller.getMyMembership(
        "school-a",
        tenant,
        principal,
      );
      expect(result.role).toBe(MembershipRole.TEACHER);
      expect(result.status).toBe(MembershipStatus.ACTIVE);
    });

    it("rejects forged schoolId", async () => {
      const principal = {
        userId: "teacher-1",
        roles: [MembershipRole.TEACHER],
        membershipStatus: "ACTIVE" as const,
        source: "stub",
      };
      const tenant = { schoolId: "school-a" };

      await expect(
        controller.getMyMembership("school-b", tenant, principal),
      ).rejects.toThrow();
    });
  });

  describe("security guards", () => {
    it("rejects unknown role via AuthenticationGuard", async () => {
      const guard = new AuthenticationGuard(
        reflector,
        new StubAuthContextSource(),
      );

      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              "x-stub-user-id": "user-1",
              "x-stub-school-id": "school-a",
              "x-stub-roles": "UNKNOWN_ROLE",
            },
            path: "/schools/school-a",
            method: "GET",
          }),
          getResponse: () => ({ getHeader: () => "req-1" }),
        }),
        getHandler: () => controller.getSchool,
        getClass: () => OrganizationsController,
      } as never;

      await expect(guard.canActivate(context)).rejects.toThrow();
    });

    it("rejects client-forged schoolId via TenantAuthorizationGuard", async () => {
      const authGuard = new AuthenticationGuard(
        reflector,
        new StubAuthContextSource(),
      );
      const tenantGuard = new TenantAuthorizationGuard(reflector);

      const request = {
        headers: {
          "x-stub-user-id": "teacher-1",
          "x-stub-school-id": "school-a",
          "x-stub-roles": "TEACHER",
        },
        params: { schoolId: "school-b" },
        path: "/schools/school-b",
        method: "GET",
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => ({ getHeader: () => "req-1" }),
        }),
        getHandler: () => controller.getSchool,
        getClass: () => OrganizationsController,
      } as never;

      await authGuard.canActivate(context);
      expect(() => tenantGuard.canActivate(context)).toThrow();
    });

    it("rejects suspended membership", async () => {
      const suspendedSource: import("../../src/common/security/index.js").AuthContextSource =
        {
          resolve: () =>
            createAuthContext(
              "stub-request",
              {
                userId: "user-1",
                roles: [MembershipRole.TEACHER],
                membershipStatus: MembershipStatus.SUSPENDED,
                source: "stub",
              },
              { schoolId: "school-a" },
            ),
        };
      const guard = new AuthenticationGuard(reflector, suspendedSource);

      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {},
            path: "/schools/school-a",
            method: "GET",
          }),
          getResponse: () => ({ getHeader: () => "req-1" }),
        }),
        getHandler: () => controller.getSchool,
        getClass: () => OrganizationsController,
      } as never;

      await expect(guard.canActivate(context)).rejects.toThrow();
    });
  });

  describe("DTO validation", () => {
    it("rejects invalid limit", async () => {
      const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      });

      await expect(
        pipe.transform(
          { limit: 200 },
          {
            type: "query",
            metatype:
              await import("../../src/modules/organizations/dto/list-members-query.dto.js").then(
                (m) => m.ListMembersQueryDto,
              ),
          },
        ),
      ).rejects.toThrow();
    });
  });
});
