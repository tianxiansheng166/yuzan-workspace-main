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
import { ASSIGNMENT_REPOSITORY } from "../../src/modules/assignments/ports/assignment-repository.port.js";
import { CLASS_REPOSITORY } from "../../src/modules/classes/ports/class-repository.port.js";
import { CLOCK } from "../../src/modules/assignments/ports/clock.port.js";
import { COURSE_VERSION_REPOSITORY } from "../../src/modules/curriculum/ports/course-version-repository.port.js";
import { LearningController } from "../../src/modules/learning/learning.controller.js";
import { LearningModule } from "../../src/modules/learning/learning.module.js";
import { LEARNING_REPOSITORY } from "../../src/modules/learning/ports/learning-repository.port.js";
import { FakeAssignmentRepository } from "../assignments/fakes/fake-assignment.repository.js";
import { FakeClassRepository } from "../organizations/fakes/fake-class.repository.js";
import { FakeCourseVersionRepository } from "../curriculum/fakes/fake-course-version.repository.js";
import { FakeLearningRepository } from "./fakes/fake-learning.repository.js";
import { FixedClock } from "../assignments/fakes/fake-clock.js";

const NOW = new Date("2026-07-10T12:00:00Z");

describe("LearningController", () => {
  let controller: LearningController;
  let reflector: Reflector;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [LearningModule],
    })
      .overrideProvider(ASSIGNMENT_REPOSITORY)
      .useValue(new FakeAssignmentRepository())
      .overrideProvider(CLASS_REPOSITORY)
      .useValue(new FakeClassRepository())
      .overrideProvider(COURSE_VERSION_REPOSITORY)
      .useValue(new FakeCourseVersionRepository())
      .overrideProvider(LEARNING_REPOSITORY)
      .useValue(new FakeLearningRepository())
      .overrideProvider(CLOCK)
      .useValue(new FixedClock(NOW))
      .overrideProvider(AUTH_CONTEXT_SOURCE)
      .useValue(new StubAuthContextSource())
      .compile();

    controller = moduleRef.get(LearningController);
    reflector = moduleRef.get(Reflector);
  });

  describe("security guards", () => {
    it("rejects teacher accessing student learning via PolicyGuard", async () => {
      const authGuard = new AuthenticationGuard(
        reflector,
        new StubAuthContextSource(),
      );
      const policyGuard = new PolicyGuard(reflector);

      const request = {
        headers: {
          "x-stub-user-id": "teacher-1",
          "x-stub-school-id": "school-a",
          "x-stub-roles": "TEACHER",
        },
        params: { schoolId: "school-a" },
        path: "/schools/school-a/learning/today",
        method: "GET",
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => ({ getHeader: () => "req-1" }),
        }),
        getHandler: () => controller.listToday,
        getClass: () => LearningController,
      } as never;

      await authGuard.canActivate(context);
      await expect(policyGuard.canActivate(context)).rejects.toThrow();
    });

    it("rejects client-forged schoolId via TenantAuthorizationGuard", async () => {
      const authGuard = new AuthenticationGuard(
        reflector,
        new StubAuthContextSource(),
      );
      const tenantGuard = new TenantAuthorizationGuard(reflector);

      const request = {
        headers: {
          "x-stub-user-id": "student-1",
          "x-stub-school-id": "school-a",
          "x-stub-roles": "STUDENT",
        },
        params: { schoolId: "school-b" },
        path: "/schools/school-b/learning/today",
        method: "GET",
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => ({ getHeader: () => "req-1" }),
        }),
        getHandler: () => controller.listToday,
        getClass: () => LearningController,
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
                userId: "student-1",
                roles: [MembershipRole.STUDENT],
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
            path: "/schools/school-a/learning/today",
            method: "GET",
          }),
          getResponse: () => ({ getHeader: () => "req-1" }),
        }),
        getHandler: () => controller.listToday,
        getClass: () => LearningController,
      } as never;

      await expect(guard.canActivate(context)).rejects.toThrow();
    });
  });

  describe("DTO validation", () => {
    it("rejects invalid progress percent", async () => {
      const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      });

      await expect(
        pipe.transform(
          { progressPercent: 150 },
          {
            type: "body",
            metatype:
              await import("../../src/modules/learning/dto/progress.dto.js").then(
                (m) => m.UpdateProgressDto,
              ),
          },
        ),
      ).rejects.toThrow();
    });
  });
});
