import { beforeEach, describe, expect, it } from "vitest";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { HttpStatus, RequestMethod, ValidationPipe } from "@nestjs/common";
import {
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from "@nestjs/common/constants";
import {
  AUTH_CONTEXT_SOURCE,
  AuthenticationGuard,
  MembershipRole,
  PolicyGuard,
  TenantAuthorizationGuard,
} from "../../src/common/security/index.js";
import { StubAuthContextSource } from "../../src/modules/auth/stub-auth-context.source.js";
import { CurriculumController } from "../../src/modules/curriculum/curriculum.controller.js";
import { CurriculumModule } from "../../src/modules/curriculum/curriculum.module.js";
import { COURSE_VERSION_REPOSITORY } from "../../src/modules/curriculum/ports/course-version-repository.port.js";
import { RESOURCE_LOOKUP_PORT } from "../../src/modules/resources/ports/resource-lookup.port.js";
import {
  activity,
  courseVersion,
  resourceRef,
  unit,
} from "./fixtures/course-versions.js";
import {
  approvedAudioResource,
  approvedImageResource,
} from "./fixtures/resources.js";
import { FakeCourseVersionRepository } from "./fakes/fake-course-version.repository.js";
import { FakeResourceLookupAdapter } from "./fakes/fake-resource-lookup.adapter.js";

describe("CurriculumController", () => {
  let controller: CurriculumController;
  let repo: FakeCourseVersionRepository;
  let resourceRepo: FakeResourceLookupAdapter;
  let reflector: Reflector;

  beforeEach(async () => {
    repo = new FakeCourseVersionRepository();
    resourceRepo = new FakeResourceLookupAdapter();

    const moduleRef = await Test.createTestingModule({
      imports: [CurriculumModule],
    })
      .overrideProvider(COURSE_VERSION_REPOSITORY)
      .useValue(repo)
      .overrideProvider(RESOURCE_LOOKUP_PORT)
      .useValue(resourceRepo)
      .overrideProvider(AUTH_CONTEXT_SOURCE)
      .useValue(new StubAuthContextSource())
      .compile();

    controller = moduleRef.get(CurriculumController);
    reflector = moduleRef.get(Reflector);
  });

  it("has required role metadata on create draft", () => {
    const roles = reflector.get("requiredRoles", controller.createCourseDraft);
    expect(roles).toContain(MembershipRole.TEACHER);
    expect(roles).toContain(MembershipRole.SCHOOL_ADMIN);
  });

  it("has required role metadata on publish", () => {
    const roles = reflector.get(
      "requiredRoles",
      controller.publishCourseVersion,
    );
    expect(roles).toContain(MembershipRole.TEACHER);
    expect(roles).toContain(MembershipRole.SCHOOL_ADMIN);
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        CurriculumController.prototype.publishCourseVersion,
      ),
    ).toBe(":courseVersionId/publish");
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        CurriculumController.prototype.publishCourseVersion,
      ),
    ).toBe(RequestMethod.POST);
    expect(
      Reflect.getMetadata(
        HTTP_CODE_METADATA,
        CurriculumController.prototype.publishCourseVersion,
      ),
    ).toBe(HttpStatus.OK);
  });

  it("allows student role on list endpoint", () => {
    const roles = reflector.get("requiredRoles", controller.listCourseVersions);
    expect(roles).toContain(MembershipRole.STUDENT);
  });

  it("creates a draft via controller", async () => {
    const principal = {
      userId: "teacher-1",
      roles: [MembershipRole.TEACHER],
      membershipStatus: "ACTIVE" as const,
      source: "stub",
    };
    const tenant = { schoolId: "school-a" };

    const result = await controller.createCourseDraft(
      "school-a",
      { title: "新课程" } as never,
      tenant,
      principal,
    );

    expect(result.status).toBe("DRAFT");
    expect(result.version).toBe(1);
  });

  it("rejects DTO with title too long", async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    await expect(
      pipe.transform(
        { title: "a".repeat(161) },
        {
          type: "body",
          metatype:
            await import("../../src/modules/curriculum/dto/create-course-draft.dto.js").then(
              (m) => m.CreateCourseDraftDto,
            ),
        },
      ),
    ).rejects.toThrow();
  });

  it("lists published versions for student", async () => {
    repo.add(courseVersion({ schoolId: "school-a", status: "PUBLISHED" }));
    repo.add(courseVersion({ schoolId: "school-a", status: "DRAFT" }));

    const principal = {
      userId: "student-1",
      roles: [MembershipRole.STUDENT],
      membershipStatus: "ACTIVE" as const,
      source: "stub",
    };
    const tenant = { schoolId: "school-a" };

    const result = await controller.listCourseVersions(
      "school-a",
      { limit: 20 } as never,
      tenant,
      principal,
    );

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("PUBLISHED");
  });

  it("publishes a valid version via controller", async () => {
    const image = approvedImageResource();
    const audio = approvedAudioResource();
    resourceRepo.add(image, audio);

    const version = courseVersion({
      schoolId: "school-a",
      authorUserId: "teacher-1",
      status: "DRAFT",
      units: [
        unit({
          id: "unit-1",
          sortOrder: 0,
          lessons: [
            {
              id: "lesson-1",
              title: "课次一",
              sortOrder: 0,
              activities: [
                activity({
                  id: "activity-1",
                  sortOrder: 0,
                  type: "AUDIO",
                  resources: [
                    resourceRef(image.id),
                    resourceRef(audio.id, {
                      kind: "AUDIO",
                      mediaType: "audio/mpeg",
                    }),
                  ],
                }),
              ],
            },
          ],
        }),
      ],
    });
    repo.add(version);

    const principal = {
      userId: "teacher-1",
      roles: [MembershipRole.TEACHER],
      membershipStatus: "ACTIVE" as const,
      source: "stub",
    };
    const tenant = { schoolId: "school-a" };

    const result = await controller.publishCourseVersion(
      "school-a",
      version.id,
      tenant,
      principal,
    );

    expect(result.status).toBe("PUBLISHED");
  });

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
          path: "/schools/school-a/course-versions",
          method: "GET",
        }),
        getResponse: () => ({
          getHeader: () => "req-1",
        }),
      }),
      getHandler: () => controller.listCourseVersions,
      getClass: () => CurriculumController,
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
      path: "/schools/school-b/course-versions",
      method: "GET",
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({
          getHeader: () => "req-1",
        }),
      }),
      getHandler: () => controller.listCourseVersions,
      getClass: () => CurriculumController,
    } as never;

    await authGuard.canActivate(context);
    expect(() => tenantGuard.canActivate(context)).toThrow();
  });
});
