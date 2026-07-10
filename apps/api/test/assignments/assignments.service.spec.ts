import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpException } from "@nestjs/common";
import {
  createAuthContext,
  MembershipRole,
  MembershipStatus,
} from "../../src/common/security/index.js";
import {
  AssignmentConflictException,
  AssignmentForbiddenException,
  AssignmentNotFoundException,
  AssignmentValidationException,
} from "../../src/modules/assignments/domain/assignment.errors.js";
import { AssignmentsService } from "../../src/modules/assignments/assignments.service.js";
import { FakeClassRepository } from "../organizations/fakes/fake-class.repository.js";
import {
  classEntity,
  studentEnrollment,
} from "../organizations/fixtures/classes.js";
import { FakeCourseVersionRepository } from "../curriculum/fakes/fake-course-version.repository.js";
import { courseVersion } from "../curriculum/fixtures/course-versions.js";
import { FakeAssignmentRepository } from "./fakes/fake-assignment.repository.js";
import { FixedClock } from "./fakes/fake-clock.js";
import { assignment } from "./fixtures/assignments.js";

const NOW = new Date("2026-07-10T12:00:00Z");

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

async function expectAssignmentNotFound(
  promise: Promise<unknown>,
): Promise<void> {
  const captured = await captureError(promise);
  expect(captured.status).toBe(404);
  expect(captured.body).toEqual({
    code: "ASSIGNMENT_NOT_FOUND",
    message: "任务不存在",
  });
}

function auth(
  userId: string,
  schoolId: string,
  roles: MembershipRole[],
  status: MembershipStatus = MembershipStatus.ACTIVE,
) {
  return createAuthContext(
    "request-id",
    {
      userId,
      roles,
      membershipStatus: status,
      source: "stub",
    },
    { schoolId },
  );
}

function makeService(
  assignmentRepo: FakeAssignmentRepository,
  classRepo: FakeClassRepository,
  courseRepo: FakeCourseVersionRepository,
  clock: FixedClock = new FixedClock(NOW),
) {
  return new AssignmentsService(assignmentRepo, classRepo, courseRepo, clock);
}

describe("AssignmentsService", () => {
  let assignmentRepo: FakeAssignmentRepository;
  let classRepo: FakeClassRepository;
  let courseRepo: FakeCourseVersionRepository;
  let clock: FixedClock;
  let service: AssignmentsService;

  beforeEach(() => {
    assignmentRepo = new FakeAssignmentRepository();
    classRepo = new FakeClassRepository();
    courseRepo = new FakeCourseVersionRepository();
    clock = new FixedClock(NOW);
    service = makeService(assignmentRepo, classRepo, courseRepo, clock);
  });

  describe("createAssignment", () => {
    it("creates a DRAFT assignment", async () => {
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

      const result = await service.createAssignment(
        auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
        "school-a",
        {
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "课后练习",
          activityRefs: [
            { activityId: "act-1", activityType: "CHOICE", title: "选择题" },
          ],
          latePolicy: "ACCEPT",
          retryPolicy: { maxAttempts: 2, allowRetest: true },
        } as never,
      );

      expect(result.status).toBe("DRAFT");
      expect(result.classId).toBe("class-a");
      expect(result.courseVersionId).toBe("cv-1");
      expect(result.createdByUserId).toBe("teacher-1");
      expect(result.activityRefs).toHaveLength(1);
    });

    it("rejects class from another school", async () => {
      classRepo.add(
        classEntity({
          id: "class-b",
          schoolId: "school-b",
          name: "外校班",
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

      await expect(
        service.createAssignment(
          auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
          "school-a",
          {
            classId: "class-b",
            courseVersionId: "cv-1",
            title: "课后练习",
            activityRefs: [],
          } as never,
        ),
      ).rejects.toBeInstanceOf(AssignmentValidationException);
    });

    it("rejects teacher without class permission", async () => {
      classRepo.add(
        classEntity({
          id: "class-a",
          schoolId: "school-a",
          name: "一班",
          grade: "G3",
          teacherUserIds: ["teacher-2"],
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

      await expect(
        service.createAssignment(
          auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
          "school-a",
          {
            classId: "class-a",
            courseVersionId: "cv-1",
            title: "课后练习",
            activityRefs: [],
          } as never,
        ),
      ).rejects.toBeInstanceOf(AssignmentForbiddenException);
    });

    it("allows school admin to create for any school class", async () => {
      classRepo.add(
        classEntity({
          id: "class-a",
          schoolId: "school-a",
          name: "一班",
          grade: "G3",
          teacherUserIds: ["teacher-2"],
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

      const result = await service.createAssignment(
        auth("admin-1", "school-a", [MembershipRole.SCHOOL_ADMIN]),
        "school-a",
        {
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "学校任务",
          activityRefs: [],
        } as never,
      );

      expect(result.status).toBe("DRAFT");
    });

    it("rejects unpublished course version", async () => {
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
          status: "DRAFT",
          title: "草稿课程",
        }),
      );

      await expect(
        service.createAssignment(
          auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
          "school-a",
          {
            classId: "class-a",
            courseVersionId: "cv-1",
            title: "课后练习",
            activityRefs: [],
          } as never,
        ),
      ).rejects.toBeInstanceOf(AssignmentValidationException);
    });

    it("rejects retired course version", async () => {
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
          status: "RETIRED",
          title: "停用课程",
        }),
      );

      await expect(
        service.createAssignment(
          auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
          "school-a",
          {
            classId: "class-a",
            courseVersionId: "cv-1",
            title: "课后练习",
            activityRefs: [],
          } as never,
        ),
      ).rejects.toBeInstanceOf(AssignmentValidationException);
    });

    it("rejects dueAt earlier than publishAt", async () => {
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

      await expect(
        service.createAssignment(
          auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
          "school-a",
          {
            classId: "class-a",
            courseVersionId: "cv-1",
            title: "课后练习",
            activityRefs: [],
            publishAt: new Date("2026-07-20T00:00:00Z"),
            dueAt: new Date("2026-07-19T00:00:00Z"),
          } as never,
        ),
      ).rejects.toBeInstanceOf(AssignmentValidationException);
    });

    it("rejects student creating assignment", async () => {
      await expect(
        service.createAssignment(
          auth("student-1", "school-a", [MembershipRole.STUDENT]),
          "school-a",
          {
            classId: "class-a",
            courseVersionId: "cv-1",
            title: "课后练习",
            activityRefs: [],
          } as never,
        ),
      ).rejects.toBeInstanceOf(AssignmentForbiddenException);
    });

    it("rejects forged schoolId", async () => {
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

      await expect(
        service.createAssignment(
          auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
          "school-b",
          {
            classId: "class-a",
            courseVersionId: "cv-1",
            title: "课后练习",
            activityRefs: [],
          } as never,
        ),
      ).rejects.toBeInstanceOf(AssignmentForbiddenException);
    });
  });

  describe("publishAssignment", () => {
    it("publishes a valid DRAFT assignment", async () => {
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
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "练习",
          createdByUserId: "teacher-1",
          status: "DRAFT",
        }),
      );

      const result = await service.publishAssignment(
        auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
        "school-a",
        "asn-1",
      );

      expect(result.status).toBe("PUBLISHED");
      expect(result.publishedAt).toBeInstanceOf(Date);
    });

    it("is idempotent when already published", async () => {
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
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "练习",
          createdByUserId: "teacher-1",
          status: "PUBLISHED",
          publishedAt: new Date("2026-07-10T00:00:00Z"),
        }),
      );

      const first = await service.publishAssignment(
        auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
        "school-a",
        "asn-1",
      );
      const second = await service.publishAssignment(
        auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
        "school-a",
        "asn-1",
      );

      expect(first.publishedAt?.getTime()).toBe(second.publishedAt?.getTime());
    });

    it("rejects publish when course version becomes retired", async () => {
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
          status: "RETIRED",
          title: "停用课程",
        }),
      );
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "练习",
          createdByUserId: "teacher-1",
          status: "DRAFT",
        }),
      );

      await expect(
        service.publishAssignment(
          auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
          "school-a",
          "asn-1",
        ),
      ).rejects.toBeInstanceOf(AssignmentValidationException);
    });
  });

  describe("updateDraft", () => {
    it("updates title and notes in DRAFT", async () => {
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
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "旧标题",
          createdByUserId: "teacher-1",
          status: "DRAFT",
        }),
      );

      const result = await service.updateDraft(
        auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
        "school-a",
        "asn-1",
        { title: "新标题", teacherNotes: "教师备注" },
      );

      expect(result.title).toBe("新标题");
      expect(result.teacherNotes).toBe("教师备注");
    });

    it("rejects updates after publish", async () => {
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
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "练习",
          createdByUserId: "teacher-1",
          status: "PUBLISHED",
          publishedAt: new Date(),
        }),
      );

      await expect(
        service.updateDraft(
          auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
          "school-a",
          "asn-1",
          { title: "新标题" },
        ),
      ).rejects.toBeInstanceOf(AssignmentConflictException);
    });
  });

  describe("getAssignment", () => {
    it("returns assignment for responsible teacher", async () => {
      classRepo.add(
        classEntity({
          id: "class-a",
          schoolId: "school-a",
          name: "一班",
          grade: "G3",
          teacherUserIds: ["teacher-1"],
        }),
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
          publishedAt: new Date(),
        }),
      );

      const result = await service.getAssignment(
        auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
        "school-a",
        "asn-1",
      );

      expect(result.id).toBe("asn-1");
    });

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
          publishedAt: new Date(),
        }),
      );

      const result = await service.getAssignment(
        auth("student-1", "school-a", [MembershipRole.STUDENT]),
        "school-a",
        "asn-1",
      );

      expect(result.id).toBe("asn-1");
    });

    it("hides draft assignment from student as not found", async () => {
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
          status: "DRAFT",
        }),
      );

      await expect(
        service.getAssignment(
          auth("student-1", "school-a", [MembershipRole.STUDENT]),
          "school-a",
          "asn-1",
        ),
      ).rejects.toBeInstanceOf(AssignmentNotFoundException);
    });

    it("returns not found for cross-school assignment", async () => {
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-b",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "练习",
          createdByUserId: "teacher-1",
          status: "PUBLISHED",
          publishedAt: new Date(),
        }),
      );

      await expect(
        service.getAssignment(
          auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
          "school-a",
          "asn-1",
        ),
      ).rejects.toBeInstanceOf(AssignmentNotFoundException);
    });
  });

  describe("close and archive", () => {
    it("closes a published assignment", async () => {
      classRepo.add(
        classEntity({
          id: "class-a",
          schoolId: "school-a",
          name: "一班",
          grade: "G3",
          teacherUserIds: ["teacher-1"],
        }),
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
          publishedAt: new Date(),
        }),
      );

      const result = await service.closeAssignment(
        auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
        "school-a",
        "asn-1",
      );

      expect(result.status).toBe("CLOSED");
    });

    it("archives a closed assignment", async () => {
      classRepo.add(
        classEntity({
          id: "class-a",
          schoolId: "school-a",
          name: "一班",
          grade: "G3",
          teacherUserIds: ["teacher-1"],
        }),
      );
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "练习",
          createdByUserId: "teacher-1",
          status: "CLOSED",
          publishedAt: new Date(),
          closedAt: new Date(),
        }),
      );

      const result = await service.archiveAssignment(
        auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
        "school-a",
        "asn-1",
      );

      expect(result.status).toBe("ARCHIVED");
    });
  });

  describe("student scope", () => {
    beforeEach(() => {
      classRepo.add(
        classEntity({
          id: "class-a",
          schoolId: "school-a",
          name: "一班",
          grade: "G3",
          teacherUserIds: ["teacher-1"],
        }),
      );
      classRepo.add(
        classEntity({
          id: "class-b",
          schoolId: "school-a",
          name: "二班",
          grade: "G3",
          teacherUserIds: ["teacher-2"],
        }),
      );
      classRepo.enroll(
        "class-a",
        studentEnrollment("class-a", "school-a", "student-1"),
      );
    });

    it("allows ACTIVE student to read published assignment of own class", async () => {
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

      const result = await service.getAssignment(
        auth("student-1", "school-a", [MembershipRole.STUDENT]),
        "school-a",
        "asn-1",
      );
      expect(result.id).toBe("asn-1");
    });

    it("returns 404 when same-school student reads unjoined class assignment", async () => {
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-b",
          courseVersionId: "cv-1",
          title: "练习",
          createdByUserId: "teacher-2",
          status: "PUBLISHED",
          publishedAt: new Date("2026-07-10T10:00:00Z"),
        }),
      );

      await expectAssignmentNotFound(
        service.getAssignment(
          auth("student-1", "school-a", [MembershipRole.STUDENT]),
          "school-a",
          "asn-1",
        ),
      );
    });

    it("does not return tasks in unjoined class list", async () => {
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-b",
          courseVersionId: "cv-1",
          title: "练习",
          createdByUserId: "teacher-2",
          status: "PUBLISHED",
          publishedAt: new Date("2026-07-10T10:00:00Z"),
        }),
      );

      await expectAssignmentNotFound(
        service.listClassAssignments(
          auth("student-1", "school-a", [MembershipRole.STUDENT]),
          "school-a",
          "class-b",
          { limit: 20 } as never,
        ),
      );
    });

    it.each([
      MembershipStatus.INVITED,
      MembershipStatus.SUSPENDED,
      MembershipStatus.LEFT,
    ])("returns 404 for %s membership", async (status) => {
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

      await expectAssignmentNotFound(
        service.getAssignment(
          auth("student-1", "school-a", [MembershipRole.STUDENT], status),
          "school-a",
          "asn-1",
        ),
      );
    });

    it("returns identical 404 for unauthorized existing and nonexistent assignment", async () => {
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-b",
          courseVersionId: "cv-1",
          title: "练习",
          createdByUserId: "teacher-2",
          status: "PUBLISHED",
          publishedAt: new Date("2026-07-10T10:00:00Z"),
        }),
      );

      const existing = await captureError(
        service.getAssignment(
          auth("student-1", "school-a", [MembershipRole.STUDENT]),
          "school-a",
          "asn-1",
        ),
      );
      const missing = await captureError(
        service.getAssignment(
          auth("student-1", "school-a", [MembershipRole.STUDENT]),
          "school-a",
          "asn-missing",
        ),
      );

      expect(existing.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(existing.body).toEqual(missing.body);
    });
  });

  describe("teacher current responsibility", () => {
    beforeEach(() => {
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
    });

    it("allows current responsible teacher to update", async () => {
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "旧标题",
          createdByUserId: "teacher-1",
          status: "DRAFT",
        }),
      );

      const result = await service.updateDraft(
        auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
        "school-a",
        "asn-1",
        { title: "新标题" },
      );
      expect(result.title).toBe("新标题");
    });

    it("allows current responsible teacher to publish", async () => {
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "练习",
          createdByUserId: "teacher-1",
          status: "DRAFT",
        }),
      );

      const result = await service.publishAssignment(
        auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
        "school-a",
        "asn-1",
      );
      expect(result.status).toBe("PUBLISHED");
    });

    it("allows current responsible teacher to close", async () => {
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

      const result = await service.closeAssignment(
        auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
        "school-a",
        "asn-1",
      );
      expect(result.status).toBe("CLOSED");
    });

    it("allows current responsible teacher to archive", async () => {
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "练习",
          createdByUserId: "teacher-1",
          status: "CLOSED",
          publishedAt: new Date("2026-07-10T10:00:00Z"),
          closedAt: new Date("2026-07-10T11:00:00Z"),
        }),
      );

      const result = await service.archiveAssignment(
        auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
        "school-a",
        "asn-1",
      );
      expect(result.status).toBe("ARCHIVED");
    });

    it("returns 404 on update after losing class responsibility", async () => {
      classRepo.add(
        classEntity({
          id: "class-a",
          schoolId: "school-a",
          name: "一班",
          grade: "G3",
          teacherUserIds: ["teacher-2"],
        }),
      );
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "旧标题",
          createdByUserId: "teacher-1",
          status: "DRAFT",
        }),
      );

      await expectAssignmentNotFound(
        service.updateDraft(
          auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
          "school-a",
          "asn-1",
          { title: "新标题" },
        ),
      );
    });

    it("returns 404 on publish after losing class responsibility", async () => {
      classRepo.add(
        classEntity({
          id: "class-a",
          schoolId: "school-a",
          name: "一班",
          grade: "G3",
          teacherUserIds: ["teacher-2"],
        }),
      );
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "练习",
          createdByUserId: "teacher-1",
          status: "DRAFT",
        }),
      );

      await expectAssignmentNotFound(
        service.publishAssignment(
          auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
          "school-a",
          "asn-1",
        ),
      );
    });

    it("returns 404 on close after losing class responsibility", async () => {
      classRepo.add(
        classEntity({
          id: "class-a",
          schoolId: "school-a",
          name: "一班",
          grade: "G3",
          teacherUserIds: ["teacher-2"],
        }),
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

      await expectAssignmentNotFound(
        service.closeAssignment(
          auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
          "school-a",
          "asn-1",
        ),
      );
    });

    it("returns 404 on archive after losing class responsibility", async () => {
      classRepo.add(
        classEntity({
          id: "class-a",
          schoolId: "school-a",
          name: "一班",
          grade: "G3",
          teacherUserIds: ["teacher-2"],
        }),
      );
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "练习",
          createdByUserId: "teacher-1",
          status: "CLOSED",
          publishedAt: new Date("2026-07-10T10:00:00Z"),
          closedAt: new Date("2026-07-10T11:00:00Z"),
        }),
      );

      await expectAssignmentNotFound(
        service.archiveAssignment(
          auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
          "school-a",
          "asn-1",
        ),
      );
    });

    it("does not call write repository when teacher lost responsibility", async () => {
      classRepo.add(
        classEntity({
          id: "class-a",
          schoolId: "school-a",
          name: "一班",
          grade: "G3",
          teacherUserIds: ["teacher-2"],
        }),
      );
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "练习",
          createdByUserId: "teacher-1",
          status: "DRAFT",
        }),
      );

      const saveSpy = vi.spyOn(assignmentRepo, "save");

      await expectAssignmentNotFound(
        service.updateDraft(
          auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
          "school-a",
          "asn-1",
          { title: "新标题" },
        ),
      );

      expect(saveSpy).not.toHaveBeenCalled();
    });

    it("does not grant permission via createdByUserId alone", async () => {
      classRepo.add(
        classEntity({
          id: "class-a",
          schoolId: "school-a",
          name: "一班",
          grade: "G3",
          teacherUserIds: ["teacher-2"],
        }),
      );
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "练习",
          createdByUserId: "teacher-1",
          status: "DRAFT",
        }),
      );

      await expectAssignmentNotFound(
        service.updateDraft(
          auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
          "school-a",
          "asn-1",
          { title: "新标题" },
        ),
      );
    });

    it("allows school admin to manage school tasks", async () => {
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "练习",
          createdByUserId: "teacher-1",
          status: "DRAFT",
        }),
      );

      const result = await service.publishAssignment(
        auth("admin-1", "school-a", [MembershipRole.SCHOOL_ADMIN]),
        "school-a",
        "asn-1",
      );
      expect(result.status).toBe("PUBLISHED");
    });
  });

  describe("resource existence normalization", () => {
    beforeEach(() => {
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
    });

    it("returns 404 for draft assignment to student", async () => {
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "练习",
          createdByUserId: "teacher-1",
          status: "DRAFT",
        }),
      );

      await expectAssignmentNotFound(
        service.getAssignment(
          auth("student-1", "school-a", [MembershipRole.STUDENT]),
          "school-a",
          "asn-1",
        ),
      );
    });

    it("returns 404 for nonexistent assignment", async () => {
      await expectAssignmentNotFound(
        service.getAssignment(
          auth("student-1", "school-a", [MembershipRole.STUDENT]),
          "school-a",
          "asn-missing",
        ),
      );
    });

    it("returns identical code and body for draft and nonexistent assignment", async () => {
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "练习",
          createdByUserId: "teacher-1",
          status: "DRAFT",
        }),
      );

      const draft = await captureError(
        service.getAssignment(
          auth("student-1", "school-a", [MembershipRole.STUDENT]),
          "school-a",
          "asn-1",
        ),
      );
      const missing = await captureError(
        service.getAssignment(
          auth("student-1", "school-a", [MembershipRole.STUDENT]),
          "school-a",
          "asn-missing",
        ),
      );

      expect(draft.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(draft.body).toEqual(missing.body);
    });

    it("returns 404 for archived assignment to student", async () => {
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "练习",
          createdByUserId: "teacher-1",
          status: "ARCHIVED",
          publishedAt: new Date("2026-07-10T10:00:00Z"),
        }),
      );

      await expectAssignmentNotFound(
        service.getAssignment(
          auth("student-1", "school-a", [MembershipRole.STUDENT]),
          "school-a",
          "asn-1",
        ),
      );
    });

    it("does not leak sensitive fields in not-found response", async () => {
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "练习",
          createdByUserId: "teacher-1",
          status: "DRAFT",
        }),
      );

      const captured = await captureError(
        service.getAssignment(
          auth("student-1", "school-a", [MembershipRole.STUDENT]),
          "school-a",
          "asn-1",
        ),
      );
      const responseText = JSON.stringify(captured.body);
      expect(responseText).not.toContain("asn-1");
      expect(responseText).not.toContain("class-a");
      expect(responseText).not.toContain("teacher-1");
      expect(captured.status).toBe(404);
    });
  });

  describe("publishAt visibility", () => {
    beforeEach(() => {
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
    });

    it("excludes future publishAt from student list", async () => {
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "未来任务",
          createdByUserId: "teacher-1",
          status: "PUBLISHED",
          publishedAt: new Date("2026-07-10T10:00:00Z"),
          publishAt: new Date("2026-07-10T15:00:00Z"),
        }),
      );

      const result = await service.listClassAssignments(
        auth("student-1", "school-a", [MembershipRole.STUDENT]),
        "school-a",
        "class-a",
        { limit: 20 } as never,
      );
      expect(result.items).toHaveLength(0);
    });

    it("returns 404 for future publishAt detail", async () => {
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "未来任务",
          createdByUserId: "teacher-1",
          status: "PUBLISHED",
          publishedAt: new Date("2026-07-10T10:00:00Z"),
          publishAt: new Date("2026-07-10T15:00:00Z"),
        }),
      );

      await expectAssignmentNotFound(
        service.getAssignment(
          auth("student-1", "school-a", [MembershipRole.STUDENT]),
          "school-a",
          "asn-1",
        ),
      );
    });

    it("includes assignment when publishAt equals now", async () => {
      clock.set(NOW);
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "当前任务",
          createdByUserId: "teacher-1",
          status: "PUBLISHED",
          publishedAt: new Date("2026-07-10T10:00:00Z"),
          publishAt: NOW,
        }),
      );

      const result = await service.getAssignment(
        auth("student-1", "school-a", [MembershipRole.STUDENT]),
        "school-a",
        "asn-1",
      );
      expect(result.id).toBe("asn-1");
    });

    it("includes assignment when publishAt is in the past", async () => {
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "已发布任务",
          createdByUserId: "teacher-1",
          status: "PUBLISHED",
          publishedAt: new Date("2026-07-10T10:00:00Z"),
          publishAt: new Date("2026-07-10T10:00:00Z"),
        }),
      );

      const result = await service.getAssignment(
        auth("student-1", "school-a", [MembershipRole.STUDENT]),
        "school-a",
        "asn-1",
      );
      expect(result.id).toBe("asn-1");
    });

    it("uses injected clock and ignores client time", async () => {
      clock.set(new Date("2026-07-10T14:00:00Z"));
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "未来任务",
          createdByUserId: "teacher-1",
          status: "PUBLISHED",
          publishedAt: new Date("2026-07-10T10:00:00Z"),
          publishAt: new Date("2026-07-10T15:00:00Z"),
        }),
      );

      await expectAssignmentNotFound(
        service.getAssignment(
          auth("student-1", "school-a", [MembershipRole.STUDENT]),
          "school-a",
          "asn-1",
        ),
      );
    });

    it("applies consistent visibility to list and detail", async () => {
      clock.set(new Date("2026-07-10T14:00:00Z"));
      assignmentRepo.add(
        assignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "未来任务",
          createdByUserId: "teacher-1",
          status: "PUBLISHED",
          publishedAt: new Date("2026-07-10T10:00:00Z"),
          publishAt: new Date("2026-07-10T15:00:00Z"),
        }),
      );

      const list = await service.listClassAssignments(
        auth("student-1", "school-a", [MembershipRole.STUDENT]),
        "school-a",
        "class-a",
        { limit: 20 } as never,
      );
      expect(list.items).toHaveLength(0);

      await expectAssignmentNotFound(
        service.getAssignment(
          auth("student-1", "school-a", [MembershipRole.STUDENT]),
          "school-a",
          "asn-1",
        ),
      );
    });
  });

  describe("repository unavailable", () => {
    it("fails closed when assignment repository is unavailable", async () => {
      const unavailableService = new AssignmentsService(
        {
          findById: () => {
            throw new Error("unavailable");
          },
          list: () => {
            throw new Error("unavailable");
          },
          save: () => {
            throw new Error("unavailable");
          },
        } as never,
        classRepo,
        courseRepo,
        clock,
      );

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

      await expect(
        unavailableService.createAssignment(
          auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
          "school-a",
          {
            classId: "class-a",
            courseVersionId: "cv-1",
            title: "课后练习",
            activityRefs: [],
          } as never,
        ),
      ).rejects.toThrow();
    });
  });
});
