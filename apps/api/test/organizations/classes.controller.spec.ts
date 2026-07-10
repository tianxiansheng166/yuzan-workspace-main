import { beforeEach, describe, expect, it } from "vitest";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import {
  AUTH_CONTEXT_SOURCE,
  MembershipRole,
  MembershipStatus,
} from "../../src/common/security/index.js";
import { StubAuthContextSource } from "../../src/modules/auth/stub-auth-context.source.js";
import { ClassesController } from "../../src/modules/classes/classes.controller.js";
import { ClassesModule } from "../../src/modules/classes/classes.module.js";
import { CLASS_REPOSITORY } from "../../src/modules/classes/ports/class-repository.port.js";
import { FakeClassRepository } from "./fakes/fake-class.repository.js";
import { classEntity, studentEnrollment } from "./fixtures/classes.js";
import { school } from "./fixtures/schools.js";
import { FakeSchoolRepository } from "./fakes/fake-school.repository.js";
import { SCHOOL_REPOSITORY } from "../../src/modules/organizations/ports/school-repository.port.js";

describe("ClassesController", () => {
  let controller: ClassesController;
  let classRepo: FakeClassRepository;
  let schoolRepo: FakeSchoolRepository;

  beforeEach(async () => {
    classRepo = new FakeClassRepository();
    schoolRepo = new FakeSchoolRepository();

    const moduleRef = await Test.createTestingModule({
      imports: [ClassesModule],
    })
      .overrideProvider(CLASS_REPOSITORY)
      .useValue(classRepo)
      .overrideProvider(AUTH_CONTEXT_SOURCE)
      .useValue(new StubAuthContextSource())
      .compile();

    controller = moduleRef.get(ClassesController);
  });

  describe("listClasses", () => {
    it("lists classes for teacher", async () => {
      classRepo.add(
        classEntity({
          id: "class-1",
          schoolId: "school-a",
          name: "一年级一班",
          grade: "一年级",
          teacherUserIds: ["teacher-1"],
          studentCount: 20,
        }),
      );

      const principal = {
        userId: "teacher-1",
        roles: [MembershipRole.TEACHER],
        membershipStatus: "ACTIVE" as const,
        source: "stub",
      };
      const tenant = { schoolId: "school-a" };

      const result = await controller.listClasses(
        "school-a",
        { limit: 20 } as never,
        tenant,
        principal,
      );
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe("一年级一班");
    });

    it("only lists enrolled classes for student", async () => {
      classRepo.add(
        classEntity({
          id: "class-1",
          schoolId: "school-a",
          name: "一年级一班",
          grade: "一年级",
          studentCount: 20,
        }),
        classEntity({
          id: "class-2",
          schoolId: "school-a",
          name: "一年级二班",
          grade: "一年级",
          studentCount: 20,
        }),
      );
      classRepo.enroll(
        "class-1",
        studentEnrollment("class-1", "school-a", "student-1"),
      );

      const principal = {
        userId: "student-1",
        roles: [MembershipRole.STUDENT],
        membershipStatus: "ACTIVE" as const,
        source: "stub",
      };
      const tenant = { schoolId: "school-a" };

      const result = await controller.listClasses(
        "school-a",
        { limit: 20 } as never,
        tenant,
        principal,
      );
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe("class-1");
    });
  });

  describe("getClass", () => {
    it("allows teacher to read responsible class", async () => {
      classRepo.add(
        classEntity({
          id: "class-1",
          schoolId: "school-a",
          name: "一年级一班",
          grade: "一年级",
          teacherUserIds: ["teacher-1"],
          studentCount: 20,
        }),
      );

      const principal = {
        userId: "teacher-1",
        roles: [MembershipRole.TEACHER],
        membershipStatus: "ACTIVE" as const,
        source: "stub",
      };
      const tenant = { schoolId: "school-a" };

      const result = await controller.getClass(
        "school-a",
        "class-1",
        tenant,
        principal,
      );
      expect(result.id).toBe("class-1");
    });

    it("rejects teacher reading non-responsible class", async () => {
      classRepo.add(
        classEntity({
          id: "class-1",
          schoolId: "school-a",
          name: "一年级一班",
          grade: "一年级",
          teacherUserIds: ["teacher-2"],
          studentCount: 20,
        }),
      );

      const principal = {
        userId: "teacher-1",
        roles: [MembershipRole.TEACHER],
        membershipStatus: "ACTIVE" as const,
        source: "stub",
      };
      const tenant = { schoolId: "school-a" };

      await expect(
        controller.getClass("school-a", "class-1", tenant, principal),
      ).rejects.toThrow();
    });

    it("allows student reading own class", async () => {
      classRepo.add(
        classEntity({
          id: "class-1",
          schoolId: "school-a",
          name: "一年级一班",
          grade: "一年级",
          studentCount: 20,
        }),
      );
      classRepo.enroll(
        "class-1",
        studentEnrollment("class-1", "school-a", "student-1"),
      );

      const principal = {
        userId: "student-1",
        roles: [MembershipRole.STUDENT],
        membershipStatus: "ACTIVE" as const,
        source: "stub",
      };
      const tenant = { schoolId: "school-a" };

      const result = await controller.getClass(
        "school-a",
        "class-1",
        tenant,
        principal,
      );
      expect(result.id).toBe("class-1");
    });

    it("rejects student reading other class", async () => {
      classRepo.add(
        classEntity({
          id: "class-1",
          schoolId: "school-a",
          name: "一年级一班",
          grade: "一年级",
          studentCount: 20,
        }),
      );
      classRepo.enroll(
        "class-1",
        studentEnrollment("class-1", "school-a", "student-2"),
      );

      const principal = {
        userId: "student-1",
        roles: [MembershipRole.STUDENT],
        membershipStatus: "ACTIVE" as const,
        source: "stub",
      };
      const tenant = { schoolId: "school-a" };

      await expect(
        controller.getClass("school-a", "class-1", tenant, principal),
      ).rejects.toThrow();
    });
  });

  describe("listClassMembers", () => {
    it("allows responsible teacher to list members", async () => {
      classRepo.add(
        classEntity({
          id: "class-1",
          schoolId: "school-a",
          name: "一年级一班",
          grade: "一年级",
          teacherUserIds: ["teacher-1"],
          studentCount: 20,
        }),
      );
      classRepo.enroll(
        "class-1",
        studentEnrollment("class-1", "school-a", "student-1"),
      );

      const principal = {
        userId: "teacher-1",
        roles: [MembershipRole.TEACHER],
        membershipStatus: "ACTIVE" as const,
        source: "stub",
      };
      const tenant = { schoolId: "school-a" };

      const result = await controller.listClassMembers(
        "school-a",
        "class-1",
        tenant,
        principal,
      );
      expect(result).toHaveLength(2);
    });

    it("rejects non-responsible teacher", async () => {
      classRepo.add(
        classEntity({
          id: "class-1",
          schoolId: "school-a",
          name: "一年级一班",
          grade: "一年级",
          teacherUserIds: ["teacher-2"],
          studentCount: 20,
        }),
      );

      const principal = {
        userId: "teacher-1",
        roles: [MembershipRole.TEACHER],
        membershipStatus: "ACTIVE" as const,
        source: "stub",
      };
      const tenant = { schoolId: "school-a" };

      await expect(
        controller.listClassMembers("school-a", "class-1", tenant, principal),
      ).rejects.toThrow();
    });

    it("rejects student", async () => {
      const reflector = new Reflector();
      const moduleRef = await Test.createTestingModule({
        imports: [ClassesModule],
      })
        .overrideProvider(CLASS_REPOSITORY)
        .useValue(classRepo)
        .overrideProvider(AUTH_CONTEXT_SOURCE)
        .useValue(new StubAuthContextSource())
        .compile();
      const ctrl = moduleRef.get(ClassesController);

      const roles = reflector.get("requiredRoles", ctrl.listClassMembers);
      expect(roles).not.toContain(MembershipRole.STUDENT);
    });
  });

  describe("my classes", () => {
    it("returns teacher classes", async () => {
      classRepo.add(
        classEntity({
          id: "class-1",
          schoolId: "school-a",
          name: "一年级一班",
          grade: "一年级",
          teacherUserIds: ["teacher-1"],
          studentCount: 20,
        }),
      );

      const principal = {
        userId: "teacher-1",
        roles: [MembershipRole.TEACHER],
        membershipStatus: "ACTIVE" as const,
        source: "stub",
      };
      const tenant = { schoolId: "school-a" };

      const result = await controller.listMyTeacherClasses(
        "school-a",
        tenant,
        principal,
      );
      expect(result).toHaveLength(1);
    });

    it("returns student classes", async () => {
      classRepo.add(
        classEntity({
          id: "class-1",
          schoolId: "school-a",
          name: "一年级一班",
          grade: "一年级",
          studentCount: 20,
        }),
      );
      classRepo.enroll(
        "class-1",
        studentEnrollment("class-1", "school-a", "student-1"),
      );

      const principal = {
        userId: "student-1",
        roles: [MembershipRole.STUDENT],
        membershipStatus: "ACTIVE" as const,
        source: "stub",
      };
      const tenant = { schoolId: "school-a" };

      const result = await controller.listMyStudentClasses(
        "school-a",
        tenant,
        principal,
      );
      expect(result).toHaveLength(1);
    });
  });
});
