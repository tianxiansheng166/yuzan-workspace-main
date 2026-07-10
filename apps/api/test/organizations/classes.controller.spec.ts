import { beforeEach, describe, expect, it } from "vitest";
import { HttpException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import {
  AUTH_CONTEXT_SOURCE,
  createAuthContext,
  MembershipRole,
  MembershipStatus,
} from "../../src/common/security/index.js";
import { StubAuthContextSource } from "../../src/modules/auth/stub-auth-context.source.js";
import { ClassesController } from "../../src/modules/classes/classes.controller.js";
import { ClassesModule } from "../../src/modules/classes/classes.module.js";
import { ClassesService } from "../../src/modules/classes/classes.service.js";
import { CLASS_REPOSITORY } from "../../src/modules/classes/ports/class-repository.port.js";
import { FakeClassRepository } from "./fakes/fake-class.repository.js";
import { classEntity, studentEnrollment } from "./fixtures/classes.js";
import { school } from "./fixtures/schools.js";
import { FakeSchoolRepository } from "./fakes/fake-school.repository.js";
import { SCHOOL_REPOSITORY } from "../../src/modules/organizations/ports/school-repository.port.js";

interface CapturedError {
  status: number;
  body: unknown;
}

async function captureError(promise: Promise<unknown>): Promise<CapturedError> {
  try {
    await promise;
    throw new Error("expected exception");
  } catch (error) {
    if (error instanceof HttpException) {
      return { status: error.getStatus(), body: error.getResponse() };
    }
    throw error;
  }
}

async function expectClassNotFound(promise: Promise<unknown>): Promise<void> {
  const captured = await captureError(promise);
  expect(captured.status).toBe(404);
  expect(captured.body).toEqual({
    code: "CLASS_NOT_FOUND",
    message: "班级不存在",
  });
}

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

    it("allows school admin to list members of any class in school", async () => {
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
        userId: "admin-1",
        roles: [MembershipRole.SCHOOL_ADMIN],
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

    it("returns 404 when non-responsible teacher accesses existing class", async () => {
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

      await expectClassNotFound(
        controller.listClassMembers("school-a", "class-1", tenant, principal),
      );
    });

    it("returns 404 when teacher accesses nonexistent class", async () => {
      const principal = {
        userId: "teacher-1",
        roles: [MembershipRole.TEACHER],
        membershipStatus: "ACTIVE" as const,
        source: "stub",
      };
      const tenant = { schoolId: "school-a" };

      await expectClassNotFound(
        controller.listClassMembers(
          "school-a",
          "class-missing",
          tenant,
          principal,
        ),
      );
    });

    it("returns identical 404 for unauthorized existing and nonexistent class", async () => {
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

      const existing = await captureError(
        controller.listClassMembers("school-a", "class-1", tenant, principal),
      );
      const missing = await captureError(
        controller.listClassMembers(
          "school-a",
          "class-missing",
          tenant,
          principal,
        ),
      );

      expect(existing.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(existing.body).toEqual(missing.body);
    });

    it("does not reveal class existence to student at service level", async () => {
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

      const moduleRef = await Test.createTestingModule({
        imports: [ClassesModule],
      })
        .overrideProvider(CLASS_REPOSITORY)
        .useValue(classRepo)
        .overrideProvider(AUTH_CONTEXT_SOURCE)
        .useValue(new StubAuthContextSource())
        .compile();
      const service = moduleRef.get(ClassesService);

      const auth = createAuthContext(
        "request-id",
        {
          userId: "student-1",
          roles: [MembershipRole.STUDENT],
          membershipStatus: MembershipStatus.ACTIVE,
          source: "stub",
        },
        { schoolId: "school-a" },
      );

      const captured = await captureError(
        service.listClassMembers(auth, "school-a", "class-1"),
      );
      const responseText = JSON.stringify(captured.body);
      expect(responseText).not.toContain("class-1");
      expect(responseText).not.toContain("teacher-1");
      expect(captured.status).toBe(403);
    });

    it.each([
      MembershipStatus.INVITED,
      MembershipStatus.SUSPENDED,
      MembershipStatus.LEFT,
    ])("does not reveal existence for %s membership", async (status) => {
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

      const moduleRef = await Test.createTestingModule({
        imports: [ClassesModule],
      })
        .overrideProvider(CLASS_REPOSITORY)
        .useValue(classRepo)
        .overrideProvider(AUTH_CONTEXT_SOURCE)
        .useValue(new StubAuthContextSource())
        .compile();
      const service = moduleRef.get(ClassesService);

      const auth = createAuthContext(
        "request-id",
        {
          userId: "teacher-1",
          roles: [MembershipRole.TEACHER],
          membershipStatus: status,
          source: "stub",
        },
        { schoolId: "school-a" },
      );

      await expect(
        service.listClassMembers(auth, "school-a", "class-1"),
      ).rejects.toThrow();
    });

    it("rejects forged schoolId with not-found semantics", async () => {
      classRepo.add(
        classEntity({
          id: "class-1",
          schoolId: "school-b",
          name: "外校班级",
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

      await expectClassNotFound(
        controller.listClassMembers("school-a", "class-1", tenant, principal),
      );
    });

    it("is not affected by header spoofing of schoolId", async () => {
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

      const moduleRef = await Test.createTestingModule({
        imports: [ClassesModule],
      })
        .overrideProvider(CLASS_REPOSITORY)
        .useValue(classRepo)
        .overrideProvider(AUTH_CONTEXT_SOURCE)
        .useValue(new StubAuthContextSource())
        .compile();
      const ctrl = moduleRef.get(ClassesController);

      // Tenant guard resolves school-a; URL param school-b is forged/spoofed.
      const principal = {
        userId: "teacher-1",
        roles: [MembershipRole.TEACHER],
        membershipStatus: "ACTIVE" as const,
        source: "stub",
      };
      const tenant = { schoolId: "school-a" };

      await expect(
        ctrl.listClassMembers("school-b", "class-1", tenant, principal),
      ).rejects.toThrow();
    });

    it("fails closed when repository is unavailable", async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [ClassesModule],
      })
        .overrideProvider(AUTH_CONTEXT_SOURCE)
        .useValue(new StubAuthContextSource())
        .compile();
      const service = moduleRef.get(ClassesService);

      const auth = createAuthContext(
        "request-id",
        {
          userId: "admin-1",
          roles: [MembershipRole.SCHOOL_ADMIN],
          membershipStatus: MembershipStatus.ACTIVE,
          source: "stub",
        },
        { schoolId: "school-a" },
      );

      await expect(
        service.listClassMembers(auth, "school-a", "class-1"),
      ).rejects.toThrow(expect.objectContaining({ status: 503 }));
    });

    it("does not leak classId or member details in not-found response", async () => {
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

      const captured = await captureError(
        controller.listClassMembers("school-a", "class-1", tenant, principal),
      );
      const responseText = JSON.stringify(captured.body);
      expect(responseText).not.toContain("class-1");
      expect(responseText).not.toContain("student-1");
      expect(responseText).not.toContain("teacher-2");
      expect(captured.status).toBe(404);
      expect(captured.body).toEqual({
        code: "CLASS_NOT_FOUND",
        message: "班级不存在",
      });
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
