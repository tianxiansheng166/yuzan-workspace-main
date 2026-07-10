import { beforeEach, describe, expect, it } from "vitest";
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
import { classEntity } from "../organizations/fixtures/classes.js";
import { FakeCourseVersionRepository } from "../curriculum/fakes/fake-course-version.repository.js";
import { courseVersion } from "../curriculum/fixtures/course-versions.js";
import { FakeAssignmentRepository } from "./fakes/fake-assignment.repository.js";
import { assignment } from "./fixtures/assignments.js";

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
) {
  return new AssignmentsService(assignmentRepo, classRepo, courseRepo);
}

describe("AssignmentsService", () => {
  let assignmentRepo: FakeAssignmentRepository;
  let classRepo: FakeClassRepository;
  let courseRepo: FakeCourseVersionRepository;
  let service: AssignmentsService;

  beforeEach(() => {
    assignmentRepo = new FakeAssignmentRepository();
    classRepo = new FakeClassRepository();
    courseRepo = new FakeCourseVersionRepository();
    service = makeService(assignmentRepo, classRepo, courseRepo);
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
    it("returns assignment for teacher creator", async () => {
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

    it("returns published assignment for student", async () => {
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

    it("hides draft assignment from student", async () => {
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
      ).rejects.toBeInstanceOf(AssignmentForbiddenException);
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
