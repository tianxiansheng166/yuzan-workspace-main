import { describe, expect, it } from "vitest";
import { createAuthContext } from "../../src/common/security/auth-context.js";
import type { CreateCourseDraftDto } from "../../src/modules/curriculum/dto/create-course-draft.dto.js";
import {
  CurriculumConflictException,
  CurriculumForbiddenException,
  CurriculumNotFoundException,
  CurriculumRepositoryUnavailableException,
  CurriculumValidationException,
} from "../../src/modules/curriculum/domain/curriculum.errors.js";
import { CurriculumService } from "../../src/modules/curriculum/curriculum.service.js";
import { UnavailableCourseVersionRepository } from "../../src/modules/curriculum/ports/unavailable-course-version.repository.js";
import { UnavailableResourceLookupAdapter } from "../../src/modules/resources/ports/unavailable-resource-lookup.adapter.js";
import {
  activity,
  bilingualContent,
  courseVersion,
  resourceRef,
  unit,
} from "./fixtures/course-versions.js";
import {
  approvedImageResource,
  approvedAudioResource,
} from "./fixtures/resources.js";
import {
  schoolAdminPrincipal,
  studentPrincipal,
  teacherPrincipal,
} from "./fixtures/users.js";
import { FakeCourseVersionRepository } from "./fakes/fake-course-version.repository.js";
import { FakeResourceLookupAdapter } from "./fakes/fake-resource-lookup.adapter.js";

function createService(
  repo: FakeCourseVersionRepository,
  resourceRepo: FakeResourceLookupAdapter,
) {
  return new CurriculumService(repo, resourceRepo);
}

function createCourseDraftDto(
  overrides: Partial<CreateCourseDraftDto> = {},
): CreateCourseDraftDto {
  return {
    title: "新课程",
    description: "课程描述",
    gradeBand: "一年级",
    locale: "zh-CN",
    ...overrides,
  };
}

function createPublishableVersion(
  repo: FakeCourseVersionRepository,
  resourceRepo: FakeResourceLookupAdapter,
  overrides: Partial<ReturnType<typeof courseVersion>> = {},
) {
  const image = approvedImageResource();
  const audio = approvedAudioResource();
  resourceRepo.add(image, audio);

  const version = courseVersion({
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
    ...overrides,
  });

  repo.add(version);
  return { version, image, audio };
}

describe("CurriculumService", () => {
  const schoolId = "school-a";

  it("creates a draft with version 1", async () => {
    const repo = new FakeCourseVersionRepository();
    const resourceRepo = new FakeResourceLookupAdapter();
    const service = createService(repo, resourceRepo);
    const principal = teacherPrincipal();
    const auth = createAuthContext("req-1", principal, { schoolId });

    const result = await service.createCourseDraft(
      auth,
      schoolId,
      createCourseDraftDto(),
    );

    expect(result.status).toBe("DRAFT");
    expect(result.version).toBe(1);
    expect(result.title).toBe("新课程");
  });

  it("allows editing a draft", async () => {
    const repo = new FakeCourseVersionRepository();
    const resourceRepo = new FakeResourceLookupAdapter();
    const service = createService(repo, resourceRepo);
    const principal = teacherPrincipal();
    const auth = createAuthContext("req-1", principal, { schoolId });

    const draft = await service.createCourseDraft(
      auth,
      schoolId,
      createCourseDraftDto(),
    );

    const updated = await service.updateDraft(auth, schoolId, draft.id, {
      title: "更新后的标题",
    });

    expect(updated.title).toBe("更新后的标题");
    expect(updated.status).toBe("DRAFT");
  });

  it("transitions draft to review-ready", async () => {
    const repo = new FakeCourseVersionRepository();
    const resourceRepo = new FakeResourceLookupAdapter();
    const service = createService(repo, resourceRepo);
    const principal = teacherPrincipal();
    const auth = createAuthContext("req-1", principal, { schoolId });

    const draft = await service.createCourseDraft(
      auth,
      schoolId,
      createCourseDraftDto(),
    );

    const submitted = await service.submitForReview(auth, schoolId, draft.id);

    expect(submitted.status).toBe("IN_REVIEW");
  });

  it("prevents editing a published version in place", async () => {
    const repo = new FakeCourseVersionRepository();
    const resourceRepo = new FakeResourceLookupAdapter();
    const service = createService(repo, resourceRepo);
    const principal = teacherPrincipal();
    const auth = createAuthContext("req-1", principal, { schoolId });

    const { version } = createPublishableVersion(repo, resourceRepo, {
      authorUserId: principal.userId,
      schoolId,
    });

    await service.publishCourseVersion(auth, schoolId, version.id);

    await expect(
      service.updateDraft(auth, schoolId, version.id, {
        title: "新标题",
      }),
    ).rejects.toThrow(CurriculumConflictException);
  });

  it("creates a new version from a published version", async () => {
    const repo = new FakeCourseVersionRepository();
    const resourceRepo = new FakeResourceLookupAdapter();
    const service = createService(repo, resourceRepo);
    const principal = teacherPrincipal();
    const auth = createAuthContext("req-1", principal, { schoolId });

    const { version } = createPublishableVersion(repo, resourceRepo, {
      authorUserId: principal.userId,
      schoolId,
    });

    const published = await service.publishCourseVersion(
      auth,
      schoolId,
      version.id,
    );

    const nextVersion = await service.createNextVersionFromPublished(
      auth,
      schoolId,
      published.id,
    );

    expect(nextVersion.status).toBe("DRAFT");
    expect(nextVersion.version).toBe(2);
    expect(nextVersion.courseId).toBe(published.courseId);
  });

  it("lists school-visible published practices only for the course owner", async () => {
    const repo = new FakeCourseVersionRepository();
    const service = createService(repo, new FakeResourceLookupAdapter());
    const principal = teacherPrincipal();
    const auth = createAuthContext("req-1", principal, { schoolId });
    const version = courseVersion({ schoolId, authorUserId: principal.userId });
    const option = {
      id: "practice-definition-1",
      title: "已发布练习",
      summary: "课程练习选项",
      difficulty: "MEDIUM",
      requiresRecording: true,
    };
    repo.add(version);
    repo.addPracticeOptions(option);

    await expect(
      service.listCoursePracticeOptions(auth, schoolId, version.id),
    ).resolves.toEqual([option]);

    const otherTeacher = createAuthContext("req-2", teacherPrincipal(), { schoolId });
    await expect(
      service.listCoursePracticeOptions(otherTeacher, schoolId, version.id),
    ).rejects.toThrow(CurriculumForbiddenException);
  });

  it("saves an activity practice relation and safely replays the same write", async () => {
    const repo = new FakeCourseVersionRepository();
    const service = createService(repo, new FakeResourceLookupAdapter());
    const principal = teacherPrincipal();
    const auth = createAuthContext("req-1", principal, { schoolId });
    const targetActivity = activity({ id: "activity-to-link" });
    const version = courseVersion({
      schoolId,
      authorUserId: principal.userId,
      units: [unit({ lessons: [{ id: "lesson-a", title: "课次一", sortOrder: 0, activities: [targetActivity] }] })],
    });
    const option = {
      id: "practice-definition-1",
      title: "已发布练习",
      summary: "课程练习选项",
      difficulty: "MEDIUM",
      requiresRecording: true,
    };
    repo.add(version);
    repo.addPracticeOptions(option);

    const input = {
      practiceDefinitionId: option.id,
      required: true,
      expectedUpdatedAt: version.updatedAt.toISOString(),
    };
    const first = await service.saveActivityPractice(
      auth,
      schoolId,
      version.id,
      targetActivity.id,
      input,
    );
    const replay = await service.saveActivityPractice(
      auth,
      schoolId,
      version.id,
      targetActivity.id,
      input,
    );
    const reread = await service.findById(auth, schoolId, version.id);

    expect(replay.id).toBe(first.id);
    expect(replay.courseVersionUpdatedAt).toEqual(first.courseVersionUpdatedAt);
    expect(reread.units[0]?.lessons[0]?.activities[0]?.practiceReference).toEqual({
      practiceDefinitionId: option.id,
      title: option.title,
      required: true,
    });
  });

  it("rejects practice links on published versions and unknown course activities", async () => {
    const repo = new FakeCourseVersionRepository();
    const service = createService(repo, new FakeResourceLookupAdapter());
    const principal = teacherPrincipal();
    const auth = createAuthContext("req-1", principal, { schoolId });
    const version = courseVersion({
      schoolId,
      authorUserId: principal.userId,
      status: "PUBLISHED",
    });
    const option = {
      id: "practice-definition-1",
      title: "已发布练习",
      summary: "课程练习选项",
      difficulty: "MEDIUM",
      requiresRecording: false,
    };
    repo.add(version);
    repo.addPracticeOptions(option);

    await expect(
      service.saveActivityPractice(auth, schoolId, version.id, "missing-activity", {
        practiceDefinitionId: option.id,
        required: true,
        expectedUpdatedAt: version.updatedAt.toISOString(),
      }),
    ).rejects.toThrow(CurriculumConflictException);

    const draft = courseVersion({ schoolId, authorUserId: principal.userId });
    repo.add(draft);
    await expect(
      service.saveActivityPractice(auth, schoolId, draft.id, "missing-activity", {
        practiceDefinitionId: option.id,
        required: true,
        expectedUpdatedAt: draft.updatedAt.toISOString(),
      }),
    ).rejects.toThrow(CurriculumNotFoundException);
  });

  it("publishes a valid version", async () => {
    const repo = new FakeCourseVersionRepository();
    const resourceRepo = new FakeResourceLookupAdapter();
    const service = createService(repo, resourceRepo);
    const principal = teacherPrincipal();
    const auth = createAuthContext("req-1", principal, { schoolId });

    const { version } = createPublishableVersion(repo, resourceRepo, {
      authorUserId: principal.userId,
      schoolId,
    });

    const published = await service.publishCourseVersion(
      auth,
      schoolId,
      version.id,
    );

    expect(published.status).toBe("PUBLISHED");
  });

  it("does not produce half-published state when validation fails", async () => {
    const repo = new FakeCourseVersionRepository();
    const resourceRepo = new FakeResourceLookupAdapter();
    const service = createService(repo, resourceRepo);
    const principal = teacherPrincipal();
    const auth = createAuthContext("req-1", principal, { schoolId });

    const invalidVersion = courseVersion({
      schoolId,
      authorUserId: principal.userId,
      title: "",
      objectives: [],
      units: [],
    });
    repo.add(invalidVersion);

    await expect(
      service.publishCourseVersion(auth, schoolId, invalidVersion.id),
    ).rejects.toThrow(CurriculumValidationException);

    const stillThere = await repo.findById(schoolId, invalidVersion.id);
    expect(stillThere?.status).toBe("DRAFT");
  });

  it("handles duplicate publish requests idempotently", async () => {
    const repo = new FakeCourseVersionRepository();
    const resourceRepo = new FakeResourceLookupAdapter();
    const service = createService(repo, resourceRepo);
    const principal = teacherPrincipal();
    const auth = createAuthContext("req-1", principal, { schoolId });

    const { version } = createPublishableVersion(repo, resourceRepo, {
      authorUserId: principal.userId,
      schoolId,
    });

    const first = await service.publishCourseVersion(
      auth,
      schoolId,
      version.id,
    );
    const second = await service.publishCourseVersion(
      auth,
      schoolId,
      version.id,
    );

    expect(first.status).toBe("PUBLISHED");
    expect(second.status).toBe("PUBLISHED");
    expect(first.id).toBe(second.id);
  });

  it("archives a published version", async () => {
    const repo = new FakeCourseVersionRepository();
    const resourceRepo = new FakeResourceLookupAdapter();
    const service = createService(repo, resourceRepo);
    const principal = teacherPrincipal();
    const auth = createAuthContext("req-1", principal, { schoolId });

    const { version } = createPublishableVersion(repo, resourceRepo, {
      authorUserId: principal.userId,
      schoolId,
    });

    const published = await service.publishCourseVersion(
      auth,
      schoolId,
      version.id,
    );

    const archived = await service.archiveCourseVersion(
      auth,
      schoolId,
      published.id,
    );

    expect(archived.status).toBe("RETIRED");
  });

  it("archived versions do not appear in student default list", async () => {
    const repo = new FakeCourseVersionRepository();
    const resourceRepo = new FakeResourceLookupAdapter();
    const service = createService(repo, resourceRepo);
    const teacher = teacherPrincipal();
    const student = studentPrincipal();
    const teacherAuth = createAuthContext("req-1", teacher, { schoolId });
    const studentAuth = createAuthContext("req-2", student, { schoolId });

    const { version } = createPublishableVersion(repo, resourceRepo, {
      authorUserId: teacher.userId,
      schoolId,
    });

    const published = await service.publishCourseVersion(
      teacherAuth,
      schoolId,
      version.id,
    );

    await service.archiveCourseVersion(teacherAuth, schoolId, published.id);

    const studentList = await service.listCourseVersions(
      studentAuth,
      schoolId,
      { limit: 20 },
    );

    expect(studentList).toHaveLength(0);
  });

  it("fails to publish when learning objectives are missing", async () => {
    const repo = new FakeCourseVersionRepository();
    const resourceRepo = new FakeResourceLookupAdapter();
    const service = createService(repo, resourceRepo);
    const principal = teacherPrincipal();
    const auth = createAuthContext("req-1", principal, { schoolId });

    const invalidVersion = courseVersion({
      schoolId,
      authorUserId: principal.userId,
      objectives: [],
      units: [unit()],
    });
    repo.add(invalidVersion);

    await expect(
      service.publishCourseVersion(auth, schoolId, invalidVersion.id),
    ).rejects.toThrow(CurriculumValidationException);
  });

  it("fails to publish when language field is missing", async () => {
    const repo = new FakeCourseVersionRepository();
    const resourceRepo = new FakeResourceLookupAdapter();
    const service = createService(repo, resourceRepo);
    const principal = teacherPrincipal();
    const auth = createAuthContext("req-1", principal, { schoolId });

    const invalidVersion = courseVersion({
      schoolId,
      authorUserId: principal.userId,
      locale: "",
      units: [unit()],
    });
    repo.add(invalidVersion);

    await expect(
      service.publishCourseVersion(auth, schoolId, invalidVersion.id),
    ).rejects.toThrow(CurriculumValidationException);
  });

  it("fails to publish when activity is empty", async () => {
    const repo = new FakeCourseVersionRepository();
    const resourceRepo = new FakeResourceLookupAdapter();
    const service = createService(repo, resourceRepo);
    const principal = teacherPrincipal();
    const auth = createAuthContext("req-1", principal, { schoolId });

    const invalidVersion = courseVersion({
      schoolId,
      authorUserId: principal.userId,
      units: [
        unit({
          lessons: [
            {
              id: "lesson-1",
              title: "课次一",
              sortOrder: 0,
              activities: [
                activity({
                  id: "activity-1",
                  sortOrder: 0,
                  content: undefined,
                  instruction: undefined,
                  teacherNotes: undefined,
                  studentNotes: undefined,
                  resources: [],
                }),
              ],
            },
          ],
        }),
      ],
    });
    repo.add(invalidVersion);

    await expect(
      service.publishCourseVersion(auth, schoolId, invalidVersion.id),
    ).rejects.toThrow(CurriculumValidationException);
  });

  it("fails to publish when duplicate ids exist", async () => {
    const repo = new FakeCourseVersionRepository();
    const resourceRepo = new FakeResourceLookupAdapter();
    const service = createService(repo, resourceRepo);
    const principal = teacherPrincipal();
    const auth = createAuthContext("req-1", principal, { schoolId });

    const invalidVersion = courseVersion({
      schoolId,
      authorUserId: principal.userId,
      id: "shared-id",
      units: [
        unit({
          id: "shared-id",
          lessons: [
            {
              id: "lesson-1",
              title: "课次一",
              sortOrder: 0,
              activities: [activity({ id: "activity-1", sortOrder: 0 })],
            },
          ],
        }),
      ],
    });
    repo.add(invalidVersion);

    await expect(
      service.publishCourseVersion(auth, schoolId, invalidVersion.id),
    ).rejects.toThrow(CurriculumValidationException);
  });

  it("fails to publish when resource reference is invalid", async () => {
    const repo = new FakeCourseVersionRepository();
    const resourceRepo = new FakeResourceLookupAdapter();
    const service = createService(repo, resourceRepo);
    const principal = teacherPrincipal();
    const auth = createAuthContext("req-1", principal, { schoolId });

    const invalidVersion = courseVersion({
      schoolId,
      authorUserId: principal.userId,
      units: [
        unit({
          lessons: [
            {
              id: "lesson-1",
              title: "课次一",
              sortOrder: 0,
              activities: [
                activity({
                  id: "activity-1",
                  sortOrder: 0,
                  resources: [resourceRef("missing-resource")],
                }),
              ],
            },
          ],
        }),
      ],
    });
    repo.add(invalidVersion);

    await expect(
      service.publishCourseVersion(auth, schoolId, invalidVersion.id),
    ).rejects.toThrow(CurriculumValidationException);
  });

  it("fails to publish when copyright status is unknown", async () => {
    const repo = new FakeCourseVersionRepository();
    const resourceRepo = new FakeResourceLookupAdapter();
    const service = createService(repo, resourceRepo);
    const principal = teacherPrincipal();
    const auth = createAuthContext("req-1", principal, { schoolId });

    const resource = approvedImageResource({ rightsStatus: "UNKNOWN" });
    resourceRepo.add(resource);

    const invalidVersion = courseVersion({
      schoolId,
      authorUserId: principal.userId,
      units: [
        unit({
          lessons: [
            {
              id: "lesson-1",
              title: "课次一",
              sortOrder: 0,
              activities: [
                activity({
                  id: "activity-1",
                  sortOrder: 0,
                  resources: [resourceRef(resource.id)],
                }),
              ],
            },
          ],
        }),
      ],
    });
    repo.add(invalidVersion);

    await expect(
      service.publishCourseVersion(auth, schoolId, invalidVersion.id),
    ).rejects.toThrow(CurriculumValidationException);
  });

  it("fails to publish when translation is unreviewed but expert confirmed", async () => {
    const repo = new FakeCourseVersionRepository();
    const resourceRepo = new FakeResourceLookupAdapter();
    const service = createService(repo, resourceRepo);
    const principal = teacherPrincipal();
    const auth = createAuthContext("req-1", principal, { schoolId });

    const invalidVersion = courseVersion({
      schoolId,
      authorUserId: principal.userId,
      objectives: [
        bilingualContent({
          translationSource: "AUTO",
          reviewStatus: "EXPERT_CONFIRMED",
        }),
      ],
      units: [unit()],
    });
    repo.add(invalidVersion);

    await expect(
      service.publishCourseVersion(auth, schoolId, invalidVersion.id),
    ).rejects.toThrow(CurriculumValidationException);
  });

  it("fails to publish when bilingual content is pending", async () => {
    const repo = new FakeCourseVersionRepository();
    const resourceRepo = new FakeResourceLookupAdapter();
    const service = createService(repo, resourceRepo);
    const principal = teacherPrincipal();
    const auth = createAuthContext("req-1", principal, { schoolId });

    const invalidVersion = courseVersion({
      schoolId,
      authorUserId: principal.userId,
      objectives: [
        bilingualContent({
          reviewStatus: "PENDING",
        }),
      ],
      units: [unit()],
    });
    repo.add(invalidVersion);

    await expect(
      service.publishCourseVersion(auth, schoolId, invalidVersion.id),
    ).rejects.toThrow(CurriculumValidationException);
  });

  it("denies cross-tenant access", async () => {
    const repo = new FakeCourseVersionRepository();
    const resourceRepo = new FakeResourceLookupAdapter();
    const service = createService(repo, resourceRepo);
    const principal = teacherPrincipal();
    const auth = createAuthContext("req-1", principal, { schoolId });

    const version = courseVersion({
      schoolId: "other-school",
      authorUserId: principal.userId,
    });
    repo.add(version);

    await expect(
      service.findById(auth, "other-school", version.id),
    ).rejects.toThrow(CurriculumForbiddenException);
  });

  it("allows students to read only published content", async () => {
    const repo = new FakeCourseVersionRepository();
    const resourceRepo = new FakeResourceLookupAdapter();
    const service = createService(repo, resourceRepo);
    const student = studentPrincipal();
    const teacher = teacherPrincipal();
    const studentAuth = createAuthContext("req-1", student, { schoolId });
    const teacherAuth = createAuthContext("req-2", teacher, { schoolId });

    const { version } = createPublishableVersion(repo, resourceRepo, {
      authorUserId: teacher.userId,
      schoolId,
    });

    await expect(
      service.findById(studentAuth, schoolId, version.id),
    ).rejects.toThrow(CurriculumForbiddenException);

    const published = await service.publishCourseVersion(
      teacherAuth,
      schoolId,
      version.id,
    );

    const found = await service.findById(studentAuth, schoolId, published.id);
    expect(found.status).toBe("PUBLISHED");
  });

  it("denies teacher managing another teacher's course", async () => {
    const repo = new FakeCourseVersionRepository();
    const resourceRepo = new FakeResourceLookupAdapter();
    const service = createService(repo, resourceRepo);
    const teacherA = teacherPrincipal();
    const teacherB = teacherPrincipal();
    const authA = createAuthContext("req-1", teacherA, { schoolId });

    const version = courseVersion({
      schoolId,
      authorUserId: teacherB.userId,
    });
    repo.add(version);

    await expect(service.findById(authA, schoolId, version.id)).rejects.toThrow(
      CurriculumForbiddenException,
    );
  });

  it("fail-closes when repository is unavailable", async () => {
    const repo = new UnavailableCourseVersionRepository();
    const resourceRepo = new UnavailableResourceLookupAdapter();
    const service = new CurriculumService(repo, resourceRepo);
    const principal = teacherPrincipal();
    const auth = createAuthContext("req-1", principal, { schoolId });

    await expect(
      service.createCourseDraft(auth, schoolId, createCourseDraftDto()),
    ).rejects.toThrow(CurriculumRepositoryUnavailableException);

    await expect(
      service.listCourseVersions(auth, schoolId, { limit: 20 }),
    ).rejects.toThrow(CurriculumRepositoryUnavailableException);
  });

  it("version number is server-controlled", async () => {
    const repo = new FakeCourseVersionRepository();
    const resourceRepo = new FakeResourceLookupAdapter();
    const service = createService(repo, resourceRepo);
    const principal = teacherPrincipal();
    const auth = createAuthContext("req-1", principal, { schoolId });

    const draft = await service.createCourseDraft(
      auth,
      schoolId,
      createCourseDraftDto(),
    );

    expect(draft.version).toBe(1);

    const { version } = createPublishableVersion(repo, resourceRepo, {
      authorUserId: principal.userId,
      schoolId,
      courseId: draft.courseId,
      version: 999,
    });

    const published = await service.publishCourseVersion(
      auth,
      schoolId,
      version.id,
    );

    expect(published.version).toBe(999);
  });
});
