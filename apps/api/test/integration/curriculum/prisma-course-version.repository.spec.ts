import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type {
  Activity,
  CourseVersion,
  Lesson,
  Unit,
} from "../../../src/modules/curriculum/domain/course-version.types.js";
import { PrismaCourseVersionRepository } from "../../../src/modules/curriculum/ports/prisma-course-version.repository.js";
import {
  CurriculumConflictException,
} from "../../../src/modules/curriculum/domain/curriculum.errors.js";
import {
  cleanCurriculumTables,
  createSchoolAndUser,
  disconnect,
  prisma,
} from "./helpers/prisma.js";

function makeVersion(
  schoolId: string,
  authorUserId: string,
  courseId: string,
  overrides: Partial<CourseVersion> = {},
): CourseVersion {
  const now = new Date();
  return {
    id: randomUUID(),
    schoolId,
    courseId,
    authorUserId,
    version: 1,
    status: "DRAFT",
    title: "Test Course",
    locale: "zh-CN",
    objectives: [],
    units: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: randomUUID(),
    title: "Unit",
    sortOrder: 0,
    lessons: [],
    ...overrides,
  };
}

function makeLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: randomUUID(),
    title: "Lesson",
    sortOrder: 0,
    activities: [],
    ...overrides,
  };
}

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: randomUUID(),
    type: "TEXT",
    title: "Activity",
    sortOrder: 0,
    required: true,
    resources: [],
    ...overrides,
  };
}

describe("PrismaCourseVersionRepository", () => {
  let schoolId: string;
  let authorUserId: string;
  let repo: PrismaCourseVersionRepository;

  beforeAll(async () => {
    ({ schoolId, authorUserId } = await createSchoolAndUser());
    repo = new PrismaCourseVersionRepository(prisma);
  });

  afterEach(async () => {
    await cleanCurriculumTables();
    ({ schoolId, authorUserId } = await createSchoolAndUser());
  });

  afterAll(async () => {
    await disconnect();
  });

  describe("save", () => {
    it("creates a new draft with stable version 1", async () => {
      const courseId = randomUUID();
      const version = makeVersion(schoolId, authorUserId, courseId);

      const saved = await repo.save(version, { generateVersion: false });

      expect(saved.id).toBe(version.id);
      expect(saved.version).toBe(1);
      expect(saved.status).toBe("DRAFT");
      expect(saved.schoolId).toBe(schoolId);
      expect(saved.courseId).toBe(courseId);
    });

    it("updates an existing draft without changing version", async () => {
      const courseId = randomUUID();
      const version = makeVersion(schoolId, authorUserId, courseId);
      const saved = await repo.save(version, { generateVersion: false });

      const updated: CourseVersion = {
        ...saved,
        title: "Updated Title",
        description: "Updated description",
        updatedAt: new Date(),
      };

      const result = await repo.save(updated, {
        generateVersion: false,
        expectedUpdatedAt: saved.updatedAt,
      });

      expect(result.version).toBe(1);
      expect(result.title).toBe("Updated Title");
      expect(result.description).toBe("Updated description");
    });

    it("rejects concurrent updates with mismatched updatedAt", async () => {
      const courseId = randomUUID();
      const version = makeVersion(schoolId, authorUserId, courseId);
      const saved = await repo.save(version, { generateVersion: false });

      const updated: CourseVersion = {
        ...saved,
        title: "Stale Update",
        updatedAt: new Date(),
      };

      await expect(
        repo.save(updated, {
          generateVersion: false,
          expectedUpdatedAt: new Date(Date.now() - 1000),
        }),
      ).rejects.toBeInstanceOf(CurriculumConflictException);
    });

    it("does not mutate a PUBLISHED version on save", async () => {
      const courseId = randomUUID();
      const version = makeVersion(schoolId, authorUserId, courseId);
      const saved = await repo.save(version, { generateVersion: false });
      await repo.publish(schoolId, saved.id, new Date());

      const mutated: CourseVersion = {
        ...saved,
        title: "Mutated",
        status: "DRAFT",
        updatedAt: new Date(),
      };

      await expect(
        repo.save(mutated, { generateVersion: false }),
      ).rejects.toBeInstanceOf(CurriculumConflictException);

      const found = await repo.findById(schoolId, saved.id);
      expect(found?.status).toBe("PUBLISHED");
      expect(found?.title).toBe("Test Course");
    });

    it("persists bilingual content and resource references", async () => {
      const courseId = randomUUID();
      const resourceId = randomUUID();
      await prisma.resource.create({
        data: {
          id: resourceId,
          kind: "IMAGE",
          objectKey: `key-${resourceId.slice(0, 8)}`,
          originalName: "image.png",
          mediaType: "image/png",
          byteSize: 100n,
          checksumSha256: "sha256",
          rightsStatus: "APPROVED",
        },
      });
      const version = makeVersion(schoolId, authorUserId, courseId, {
        objectives: [
          {
            originalText: "目标",
            locale: "zh-CN",
            translationSource: "NONE",
            reviewStatus: "PENDING",
          },
        ],
        units: [
          makeUnit({
            lessons: [
              makeLesson({
                activities: [
                  makeActivity({
                    instruction: {
                      originalText: "instruction",
                      locale: "zh-CN",
                      translationSource: "NONE",
                      reviewStatus: "PENDING",
                    },
                    resources: [
                      {
                        id: resourceId,
                        kind: "IMAGE",
                        objectKey: "key",
                        mediaType: "image/png",
                        byteSize: 100,
                        rightsStatus: "APPROVED",
                      },
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      });

      const saved = await repo.save(version, { generateVersion: false });
      const found = await repo.findById(schoolId, saved.id);

      expect(found?.objectives).toHaveLength(1);
      expect(found?.units[0].lessons[0].activities[0].instruction).toEqual(
        version.units[0].lessons[0].activities[0].instruction,
      );
      expect(found?.units[0].lessons[0].activities[0].resources[0].id).toBe(
        resourceId,
      );
    });
  });

  describe("findById", () => {
    it("returns null when the version belongs to another school", async () => {
      const courseId = randomUUID();
      const version = makeVersion(schoolId, authorUserId, courseId);
      const saved = await repo.save(version, { generateVersion: false });

      const otherSchool = randomUUID();
      const result = await repo.findById(otherSchool, saved.id);

      expect(result).toBeNull();
    });
  });

  describe("list", () => {
    it("lists only versions for the requested school", async () => {
      const courseIdA = randomUUID();
      const courseIdB = randomUUID();

      const { schoolId: otherSchoolId, authorUserId: otherAuthorId } =
        await createSchoolAndUser();

      await repo.save(
        makeVersion(schoolId, authorUserId, courseIdA, {
          title: "Course A",
        }),
        { generateVersion: false },
      );
      await repo.save(
        makeVersion(otherSchoolId, otherAuthorId, courseIdB, {
          title: "Course B",
        }),
        { generateVersion: false },
      );

      const result = await repo.list(schoolId, { limit: 10 });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe("Course A");
    });
  });

  describe("publish", () => {
    it("publishes a DRAFT version and is idempotent", async () => {
      const courseId = randomUUID();
      const version = makeVersion(schoolId, authorUserId, courseId);
      const saved = await repo.save(version, { generateVersion: false });

      const published = await repo.publish(schoolId, saved.id, new Date());
      expect(published?.status).toBe("PUBLISHED");

      const again = await repo.publish(schoolId, saved.id, new Date());
      expect(again?.status).toBe("PUBLISHED");
    });

    it("does not publish a RETIRED version", async () => {
      const courseId = randomUUID();
      const version = makeVersion(schoolId, authorUserId, courseId);
      const saved = await repo.save(version, { generateVersion: false });
      await repo.publish(schoolId, saved.id, new Date());
      await repo.retire(schoolId, saved.id, new Date());

      const result = await repo.publish(schoolId, saved.id, new Date());
      expect(result).toBeNull();
    });
  });

  describe("retire", () => {
    it("archives a PUBLISHED version", async () => {
      const courseId = randomUUID();
      const version = makeVersion(schoolId, authorUserId, courseId);
      const saved = await repo.save(version, { generateVersion: false });
      await repo.publish(schoolId, saved.id, new Date());

      const retired = await repo.retire(schoolId, saved.id, new Date());
      expect(retired?.status).toBe("RETIRED");
    });
  });

  describe("nextVersion", () => {
    it("returns the next version number without modifying existing versions", async () => {
      const courseId = randomUUID();
      const v1 = makeVersion(schoolId, authorUserId, courseId, { version: 1 });
      await repo.save(v1, { generateVersion: false });

      const next = await repo.nextVersion(courseId);
      expect(next).toBe(2);

      const found = await repo.findById(schoolId, v1.id);
      expect(found?.version).toBe(1);
    });
  });

  describe("createNextVersionFromPublished workflow", () => {
    it("creates a new draft without mutating the published parent", async () => {
      const courseId = randomUUID();
      const parent = makeVersion(schoolId, authorUserId, courseId, {
        title: "Parent",
      });
      const savedParent = await repo.save(parent, { generateVersion: false });
      await repo.publish(schoolId, savedParent.id, new Date());

      const nextVersionNumber = await repo.nextVersion(courseId);
      const now = new Date();
      const child: CourseVersion = {
        ...savedParent,
        id: randomUUID(),
        version: nextVersionNumber,
        status: "DRAFT",
        title: "Child Draft",
        submittedAt: undefined,
        approvedAt: undefined,
        publishedAt: undefined,
        retiredAt: undefined,
        createdAt: now,
        updatedAt: now,
      };

      const savedChild = await repo.save(child, { generateVersion: false });

      expect(savedChild.version).toBe(nextVersionNumber);
      expect(savedChild.status).toBe("DRAFT");

      const parentAfter = await repo.findById(schoolId, savedParent.id);
      expect(parentAfter?.status).toBe("PUBLISHED");
      expect(parentAfter?.title).toBe("Parent");
    });
  });

  describe("tenant isolation", () => {
    it("findPublishedByCourseId filters by school", async () => {
      const courseId = randomUUID();
      const version = makeVersion(schoolId, authorUserId, courseId);
      const saved = await repo.save(version, { generateVersion: false });
      await repo.publish(schoolId, saved.id, new Date());

      const other = randomUUID();
      const result = await repo.findPublishedByCourseId(other, courseId);
      expect(result).toBeNull();
    });
  });

  describe("error handling", () => {
    it("translates unique constraint failures into conflict exceptions", async () => {
      const courseId = randomUUID();
      const version = makeVersion(schoolId, authorUserId, courseId, {
        version: 1,
      });
      await repo.save(version, { generateVersion: false });

      const duplicate = makeVersion(schoolId, authorUserId, courseId, {
        id: randomUUID(),
        version: 1,
      });

      await expect(
        repo.save(duplicate, { generateVersion: false }),
      ).rejects.toBeInstanceOf(CurriculumConflictException);
    });
  });
});
