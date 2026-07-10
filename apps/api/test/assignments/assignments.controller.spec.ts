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
import { AssignmentsController } from "../../src/modules/assignments/assignments.controller.js";
import { AssignmentsModule } from "../../src/modules/assignments/assignments.module.js";
import { ASSIGNMENT_REPOSITORY } from "../../src/modules/assignments/ports/assignment-repository.port.js";
import { CLOCK } from "../../src/modules/assignments/ports/clock.port.js";
import { CLASS_REPOSITORY } from "../../src/modules/classes/ports/class-repository.port.js";
import { COURSE_VERSION_REPOSITORY } from "../../src/modules/curriculum/ports/course-version-repository.port.js";
import { FakeAssignmentRepository } from "./fakes/fake-assignment.repository.js";
import { FakeClassRepository } from "../organizations/fakes/fake-class.repository.js";
import { FakeCourseVersionRepository } from "../curriculum/fakes/fake-course-version.repository.js";
import { FixedClock } from "./fakes/fake-clock.js";
import {
  classEntity,
  studentEnrollment,
} from "../organizations/fixtures/classes.js";
import { courseVersion } from "../curriculum/fixtures/course-versions.js";
import { assignment } from "./fixtures/assignments.js";

const NOW = new Date("2026-07-10T12:00:00Z");

describe("AssignmentsController", () => {
  let controller: AssignmentsController;
  let assignmentRepo: FakeAssignmentRepository;
  let classRepo: FakeClassRepository;
  let courseRepo: FakeCourseVersionRepository;
  let reflector: Reflector;

  beforeEach(async () => {
    assignmentRepo = new FakeAssignmentRepository();
    classRepo = new FakeClassRepository();
    courseRepo = new FakeCourseVersionRepository();

    const moduleRef = await Test.createTestingModule({
      imports: [AssignmentsModule],
    })
      .overrideProvider(ASSIGNMENT_REPOSITORY)
      .useValue(assignmentRepo)
      .overrideProvider(CLASS_REPOSITORY)
      .useValue(classRepo)
      .overrideProvider(COURSE_VERSION_REPOSITORY)
      .useValue(courseRepo)
      .overrideProvider(CLOCK)
      .useValue(new FixedClock(NOW))
      .overrideProvider(AUTH_CONTEXT_SOURCE)
      .useValue(new StubAuthContextSource())
      .compile();

    controller = moduleRef.get(AssignmentsController);
    reflector = moduleRef.get(Reflector);
  });

  describe("createAssignment", () => {
    it("creates an assignment with valid DTO", async () => {
      classRepo.add(
        classEntity({
          id: "class-a",
          schoolId: "school-a",
          name: "一班",
          grade: "G3",
          teacherUserIds: ["teacher-1"],
        }),
      );
      courseRepo.add(
        courseVersion({
          id: "cv-1",
          schoolId: "school-a",
          status: "PUBLISHED",
          title: "已发布课程",
        }),
      );

      const principal = {
        userId: "teacher-1",
        roles: [MembershipRole.TEACHER],
        membershipStatus: "ACTIVE" as const,
        source: "stub",
      };
      const tenant = { schoolId: "school-a" };

      const result = await controller.createAssignment(
        "school-a",
        {
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "课后练习",
          activityRefs: [
            { activityId: "act-1", activityType: "CHOICE", title: "选择题" },
          ],
        } as never,
        tenant,
        principal,
      );

      expect(result.status).toBe("DRAFT");
    });
  });

  describe("getAssignment", () => {
    it("returns published assignment for enrolled student", async () => {
      classRepo.add(
        classEntity({
          id: "class-a",
          schoolId: "school-a",
          name: "一班",
          grade: "G3",
          teacherUserIds: ["teacher-1"],
        }),
      );
      classRepo.enroll(
        "class-a",
        studentEnrollment("class-a", "school-a", "student-1"),
      );
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "练习",
          createdByUserId: "teacher-1",
          status: "PUBLISHED",
          publishedAt: new Date("2026-07-10T10:00:00Z"),
        }),
      );

      const principal = {
        userId: "student-1",
        roles: [MembershipRole.STUDENT],
        membershipStatus: "ACTIVE" as const,
        source: "stub",
      };
      const tenant = { schoolId: "school-a" };

      const result = await controller.getAssignment(
        "school-a",
        "asn-1",
        tenant,
        principal,
      );
      expect(result.id).toBe("asn-1");
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
            path: "/schools/school-a/assignments",
            method: "GET",
          }),
          getResponse: () => ({ getHeader: () => "req-1" }),
        }),
        getHandler: () => controller.getAssignment,
        getClass: () => AssignmentsController,
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
        path: "/schools/school-b/assignments/asn-1",
        method: "GET",
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => ({ getHeader: () => "req-1" }),
        }),
        getHandler: () => controller.getAssignment,
        getClass: () => AssignmentsController,
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
            path: "/schools/school-a/assignments",
            method: "GET",
          }),
          getResponse: () => ({ getHeader: () => "req-1" }),
        }),
        getHandler: () => controller.getAssignment,
        getClass: () => AssignmentsController,
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
              await import("../../src/modules/assignments/dto/list-assignments-query.dto.js").then(
                (m) => m.ListAssignmentsQueryDto,
              ),
          },
        ),
      ).rejects.toThrow();
    });

    it("rejects empty activityRefs", async () => {
      const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      });

      await expect(
        pipe.transform(
          {
            classId: "class-a",
            courseVersionId: "cv-1",
            title: "练习",
            activityRefs: [],
          },
          {
            type: "body",
            metatype:
              await import("../../src/modules/assignments/dto/create-assignment.dto.js").then(
                (m) => m.CreateAssignmentDto,
              ),
          },
        ),
      ).rejects.toThrow();
    });
  });
});
