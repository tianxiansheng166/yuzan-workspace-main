import { beforeEach, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import {
  MembershipRole,
  MembershipStatus,
} from "../../src/common/security/index.js";
import { OrganizationsModule } from "../../src/modules/organizations/organizations.module.js";
import { MEMBERSHIP_REPOSITORY } from "../../src/modules/organizations/ports/membership-repository.port.js";
import { SCHOOL_REPOSITORY } from "../../src/modules/organizations/ports/school-repository.port.js";
import { FakeMembershipRepository } from "./fakes/fake-membership.repository.js";
import { FakeSchoolRepository } from "./fakes/fake-school.repository.js";
import { membership } from "./fixtures/memberships.js";
import { school } from "./fixtures/schools.js";
import { OrganizationsService } from "../../src/modules/organizations/organizations.service.js";
import { createAuthContext } from "../../src/common/security/index.js";

describe("OrganizationsService", () => {
  let service: OrganizationsService;
  let schoolRepo: FakeSchoolRepository;
  let membershipRepo: FakeMembershipRepository;

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
      .compile();

    service = moduleRef.get(OrganizationsService);
  });

  function auth(userId: string, schoolId: string, roles: MembershipRole[]) {
    return createAuthContext(
      "request-id",
      {
        userId,
        roles,
        membershipStatus: MembershipStatus.ACTIVE,
        source: "test",
      },
      { schoolId },
    );
  }

  describe("membership status", () => {
    it("allows ACTIVE membership", async () => {
      schoolRepo.add(school({ id: "school-a" }));
      membershipRepo.add(
        membership({
          userId: "teacher-1",
          schoolId: "school-a",
          role: MembershipRole.TEACHER,
          status: MembershipStatus.ACTIVE,
        }),
      );

      const result = await service.requireActiveMembership(
        auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
        "school-a",
      );
      expect(result.status).toBe(MembershipStatus.ACTIVE);
    });

    it.each([
      MembershipStatus.INVITED,
      MembershipStatus.SUSPENDED,
      MembershipStatus.LEFT,
    ])("rejects %s membership", async (status) => {
      schoolRepo.add(school({ id: "school-a" }));
      membershipRepo.add(
        membership({
          userId: "teacher-1",
          schoolId: "school-a",
          role: MembershipRole.TEACHER,
          status,
        }),
      );

      await expect(
        service.requireActiveMembership(
          auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
          "school-a",
        ),
      ).rejects.toThrow();
    });
  });

  describe("repository unavailable", () => {
    it("propagates unavailable school repository", async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [OrganizationsModule],
      }).compile();
      const svc = moduleRef.get(OrganizationsService);

      await expect(
        svc.getSchool(
          auth("admin-1", "school-a", [MembershipRole.SCHOOL_ADMIN]),
          "school-a",
        ),
      ).rejects.toThrow();
    });
  });

  describe("role enforcement", () => {
    it("rejects unknown role accessing members", async () => {
      schoolRepo.add(school({ id: "school-a" }));
      membershipRepo.add(
        membership({
          userId: "researcher-1",
          schoolId: "school-a",
          role: MembershipRole.STUDENT,
          status: MembershipStatus.ACTIVE,
        }),
      );

      await expect(
        service.listMembers(
          auth("researcher-1", "school-a", [MembershipRole.STUDENT]),
          "school-a",
          { limit: 20 },
        ),
      ).rejects.toThrow();
    });

    it("rejects forged schoolId in requireActiveMembership", async () => {
      await expect(
        service.requireActiveMembership(
          auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
          "school-b",
        ),
      ).rejects.toThrow();
    });
  });
});
