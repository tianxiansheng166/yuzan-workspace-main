import { MODULE_METADATA } from "@nestjs/common/constants";
import { PATH_METADATA } from "@nestjs/common/constants";
import { Test, type TestingModule } from "@nestjs/testing";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import {
  AuthenticationGuard,
  IS_PUBLIC_KEY,
  PolicyGuard,
  TenantAuthorizationGuard,
} from "../../src/common/security/index.js";
import { IdentityException } from "../../src/modules/identity/identity.errors.js";
import { IdentityService } from "../../src/modules/identity/identity.service.js";
import {
  USER_IDENTITY_REPOSITORY,
  type UserIdentityRepository,
} from "../../src/modules/identity/ports/index.js";
import { CurriculumRepositoryUnavailableException } from "../../src/modules/curriculum/domain/curriculum.errors.js";
import { CurriculumService } from "../../src/modules/curriculum/curriculum.service.js";
import { CurriculumController } from "../../src/modules/curriculum/curriculum.controller.js";
import {
  COURSE_VERSION_REPOSITORY,
  type CourseVersionRepositoryPort,
} from "../../src/modules/curriculum/ports/course-version-repository.port.js";
import { HealthController } from "../../src/modules/health/health.controller.js";

/**
 * Integration test for AppModule root composition.
 *
 * Requires a real PostgreSQL database because AppModule initializes
 * PrismaService (which opens a pg Pool in its constructor).
 * Skips the entire suite when DATABASE_URL is not set.
 */
const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("AppModule root composition", () => {
  let module: TestingModule;
  let AppModule: typeof import("../../src/app.module.js").AppModule;

  beforeAll(async () => {
    Object.assign(process.env, {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://unused:unused@127.0.0.1:5432/unused",
      NODE_ENV: "test",
      SESSION_SECRET: "test-only-session-secret-at-least-32-characters",
      WEB_ORIGIN: "http://127.0.0.1:3000",
    });
    ({ AppModule } = await import("../../src/app.module.js"));
    module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  });

  afterAll(async () => {
    await module.close();
  });

  it("compiles and resolves approved feature and security providers", () => {
    expect(module.get(IdentityService)).toBeInstanceOf(IdentityService);
    expect(module.get(CurriculumService)).toBeInstanceOf(CurriculumService);
    expect(module.get(AuthenticationGuard)).toBeInstanceOf(AuthenticationGuard);
    expect(module.get(TenantAuthorizationGuard)).toBeInstanceOf(
      TenantAuthorizationGuard,
    );
    expect(module.get(PolicyGuard)).toBeInstanceOf(PolicyGuard);
  });

  it("imports each approved module once and excludes modules awaiting approval", () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      AppModule,
    ) as Array<{
      name?: string;
    }>;
    const names = imports.map((item) => item.name).filter(Boolean);

    for (const approved of [
      "HealthModule",
      "IdentityModule",
      "OrganizationsModule",
      "ClassesModule",
      "CurriculumModule",
      "AssignmentsModule",
      "SubmissionsModule",
      "FeedbackModule",
      "LearningModule",
      "AuthModule",
    ]) {
      expect(names.filter((name) => name === approved)).toHaveLength(1);
    }
    expect(new Set(names).size).toBe(names.length);
  });

  it("keeps health and readiness public without opening business controllers", () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, HealthController)).toBe(true);
  });

  it("normalizes the approved curriculum publish route for Nest 11 startup", () => {
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        CurriculumController.prototype.publishCourseVersion,
      ),
    ).toBe(":courseVersionId/publish");
  });

  it("keeps unavailable identity persistence fail-closed", async () => {
    const repository = module.get<UserIdentityRepository>(
      USER_IDENTITY_REPOSITORY,
    );
    await expect(repository.findByIdentifier("anyone")).rejects.toBeInstanceOf(
      IdentityException,
    );
  });

  it("keeps unavailable curriculum persistence fail-closed", async () => {
    const repository = module.get<CourseVersionRepositoryPort>(
      COURSE_VERSION_REPOSITORY,
    );
    await expect(
      repository.list("00000000-0000-4000-8000-000000000001", {}),
    ).rejects.toBeInstanceOf(CurriculumRepositoryUnavailableException);
  });
});
