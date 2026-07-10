import { beforeEach, describe, expect, it } from "vitest";
import {
  createAuthContext,
  MembershipRole,
  MembershipStatus,
} from "../../src/common/security/index.js";
import { LearningService } from "../../src/modules/learning/learning.service.js";
import { FakeAssignmentRepository } from "../assignments/fakes/fake-assignment.repository.js";
import { assignment } from "../assignments/fixtures/assignments.js";
import { toAssignmentSummary } from "../../src/modules/assignments/domain/assignment.types.js";
import { FakeClassRepository } from "../organizations/fakes/fake-class.repository.js";
import { classEntity } from "../organizations/fixtures/classes.js";
import { FakeCourseVersionRepository } from "../curriculum/fakes/fake-course-version.repository.js";
import {
  activity,
  courseVersion,
  lesson,
  unit,
} from "../curriculum/fixtures/course-versions.js";
import { FakeLearningRepository } from "./fakes/fake-learning.repository.js";
import { learningProgress, learningSession } from "./fixtures/learning.js";

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

function publishedAssignment(
  overrides: Partial<
    import("../../src/modules/assignments/domain/assignment.types.js").Assignment
  > &
    Pick<
      import("../../src/modules/assignments/domain/assignment.types.js").Assignment,
      "id" | "schoolId" | "classId" | "courseVersionId"
    >,
) {
  return assignment({
    status: "PUBLISHED",
    activityRefs: [
      { activityId: "act-1", activityType: "TEXT", title: "阅读" },
      { activityId: "act-2", activityType: "CHOICE", title: "选择" },
    ],
    publishedAt: new Date("2026-07-01T00:00:00Z"),
    latePolicy: "ACCEPT",
    ...overrides,
  });
}

function makeService(
  assignmentRepo: FakeAssignmentRepository,
  classRepo: FakeClassRepository,
  courseRepo: FakeCourseVersionRepository,
  learningRepo: FakeLearningRepository,
) {
  return new LearningService(
    assignmentRepo,
    classRepo,
    courseRepo,
    learningRepo,
  );
}

describe("LearningService", () => {
  let assignmentRepo: FakeAssignmentRepository;
  let classRepo: FakeClassRepository;
  let courseRepo: FakeCourseVersionRepository;
  let learningRepo: FakeLearningRepository;
  let service: LearningService;

  beforeEach(() => {
    assignmentRepo = new FakeAssignmentRepository();
    classRepo = new FakeClassRepository();
    courseRepo = new FakeCourseVersionRepository();
    learningRepo = new FakeLearningRepository();
    service = makeService(assignmentRepo, classRepo, courseRepo, learningRepo);
  });

  describe("listToday", () => {
    it("shows only enrolled class published assignments", async () => {
      classRepo.add(
        classEntity({
          id: "class-a",
          schoolId: "school-a",
          name: "一班",
          grade: "G3",
          teacherUserIds: ["teacher-1"],
        }),
      );
      classRepo.enroll("class-a", {
        classId: "class-a",
        schoolId: "school-a",
        userId: "student-1",
        roleInClass: MembershipRole.STUDENT,
      });
      courseRepo.add(
        courseVersion({
          id: "cv-1",
          schoolId: "school-a",
          status: "PUBLISHED",
          title: "已发布课程",
        }),
      );
      assignmentRepo.add(
        publishedAssignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "今日任务",
        }),
      );

      const result = await service.listToday(
        auth("student-1", "school-a", [MembershipRole.STUDENT]),
        "school-a",
      );

      expect(result.items).toHaveLength(2);
      expect(result.items[0].assignmentId).toBe("asn-1");
      expect(result.items[0].progressPercent).toBe(0);
    });

    it("hides assignments from classes the student is not enrolled in", async () => {
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
        publishedAssignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "他人班级任务",
        }),
      );

      const result = await service.listToday(
        auth("student-1", "school-a", [MembershipRole.STUDENT]),
        "school-a",
      );

      expect(result.items).toHaveLength(0);
    });

    it("hides draft assignments", async () => {
      classRepo.add(
        classEntity({
          id: "class-a",
          schoolId: "school-a",
          name: "一班",
          grade: "G3",
          teacherUserIds: ["teacher-1"],
        }),
      );
      classRepo.enroll("class-a", {
        classId: "class-a",
        schoolId: "school-a",
        userId: "student-1",
        roleInClass: MembershipRole.STUDENT,
      });
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
          title: "草稿任务",
          status: "DRAFT",
        }),
      );

      const result = await service.listToday(
        auth("student-1", "school-a", [MembershipRole.STUDENT]),
        "school-a",
      );

      expect(result.items).toHaveLength(0);
    });

    it("hides not-yet-open assignments", async () => {
      classRepo.add(
        classEntity({
          id: "class-a",
          schoolId: "school-a",
          name: "一班",
          grade: "G3",
          teacherUserIds: ["teacher-1"],
        }),
      );
      classRepo.enroll("class-a", {
        classId: "class-a",
        schoolId: "school-a",
        userId: "student-1",
        roleInClass: MembershipRole.STUDENT,
      });
      courseRepo.add(
        courseVersion({
          id: "cv-1",
          schoolId: "school-a",
          status: "PUBLISHED",
          title: "已发布课程",
        }),
      );
      assignmentRepo.add(
        publishedAssignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "未来任务",
          publishAt: new Date("2099-01-01T00:00:00Z"),
        }),
      );

      const result = await service.listToday(
        auth("student-1", "school-a", [MembershipRole.STUDENT]),
        "school-a",
      );

      expect(result.items).toHaveLength(0);
    });

    it("returns session and progress when present", async () => {
      classRepo.add(
        classEntity({
          id: "class-a",
          schoolId: "school-a",
          name: "一班",
          grade: "G3",
          teacherUserIds: ["teacher-1"],
        }),
      );
      classRepo.enroll("class-a", {
        classId: "class-a",
        schoolId: "school-a",
        userId: "student-1",
        roleInClass: MembershipRole.STUDENT,
      });
      courseRepo.add(
        courseVersion({
          id: "cv-1",
          schoolId: "school-a",
          status: "PUBLISHED",
          title: "已发布课程",
        }),
      );
      assignmentRepo.add(
        publishedAssignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "任务",
        }),
      );
      learningRepo.addSession(
        learningSession({
          id: "session-1",
          schoolId: "school-a",
          assignmentId: "asn-1",
          activityId: "act-1",
          studentUserId: "student-1",
          enrollmentId: "class-a:student-1",
        }),
      );
      learningRepo.addProgress(
        learningProgress({
          id: "progress-1",
          schoolId: "school-a",
          assignmentId: "asn-1",
          activityId: "act-1",
          studentUserId: "student-1",
          enrollmentId: "class-a:student-1",
          sessionId: "session-1",
          progressPercent: 50,
        }),
      );

      const result = await service.listToday(
        auth("student-1", "school-a", [MembershipRole.STUDENT]),
        "school-a",
      );

      const item = result.items.find((i) => i.activity.activityId === "act-1");
      expect(item?.sessionId).toBe("session-1");
      expect(item?.progressPercent).toBe(50);
    });
  });

  describe("getActivityDetail", () => {
    it("returns activity with canStart true before due date", async () => {
      classRepo.add(
        classEntity({
          id: "class-a",
          schoolId: "school-a",
          name: "一班",
          grade: "G3",
          teacherUserIds: ["teacher-1"],
        }),
      );
      classRepo.enroll("class-a", {
        classId: "class-a",
        schoolId: "school-a",
        userId: "student-1",
        roleInClass: MembershipRole.STUDENT,
      });
      courseRepo.add(
        courseVersion({
          id: "cv-1",
          schoolId: "school-a",
          status: "PUBLISHED",
          title: "已发布课程",
          units: [
            unit({
              lessons: [
                lesson({
                  activities: [
                    activity({ id: "act-1", type: "TEXT", title: "阅读" }),
                  ],
                }),
              ],
            }),
          ],
        }),
      );
      assignmentRepo.add(
        publishedAssignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "任务",
        }),
      );

      const detail = await service.getActivityDetail(
        auth("student-1", "school-a", [MembershipRole.STUDENT]),
        "school-a",
        "asn-1",
        "act-1",
      );

      expect(detail.canStart).toBe(true);
      expect(detail.canSubmit).toBe(true);
      expect(detail.activity.activityId).toBe("act-1");
    });

    it("rejects when activity not in course version", async () => {
      classRepo.add(
        classEntity({
          id: "class-a",
          schoolId: "school-a",
          name: "一班",
          grade: "G3",
          teacherUserIds: ["teacher-1"],
        }),
      );
      classRepo.enroll("class-a", {
        classId: "class-a",
        schoolId: "school-a",
        userId: "student-1",
        roleInClass: MembershipRole.STUDENT,
      });
      courseRepo.add(
        courseVersion({
          id: "cv-1",
          schoolId: "school-a",
          status: "PUBLISHED",
          title: "已发布课程",
        }),
      );
      assignmentRepo.add(
        publishedAssignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "任务",
        }),
      );

      await expect(
        service.getActivityDetail(
          auth("student-1", "school-a", [MembershipRole.STUDENT]),
          "school-a",
          "asn-1",
          "act-unknown",
        ),
      ).rejects.toThrow();
    });
  });

  describe("startSession", () => {
    it("creates a new session", async () => {
      classRepo.add(
        classEntity({
          id: "class-a",
          schoolId: "school-a",
          name: "一班",
          grade: "G3",
          teacherUserIds: ["teacher-1"],
        }),
      );
      classRepo.enroll("class-a", {
        classId: "class-a",
        schoolId: "school-a",
        userId: "student-1",
        roleInClass: MembershipRole.STUDENT,
      });
      courseRepo.add(
        courseVersion({
          id: "cv-1",
          schoolId: "school-a",
          status: "PUBLISHED",
          title: "已发布课程",
          units: [
            unit({
              lessons: [
                lesson({
                  activities: [
                    activity({ id: "act-1", type: "TEXT", title: "阅读" }),
                  ],
                }),
              ],
            }),
          ],
        }),
      );
      assignmentRepo.add(
        publishedAssignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "任务",
        }),
      );

      const result = await service.startSession(
        auth("student-1", "school-a", [MembershipRole.STUDENT]),
        "school-a",
        "asn-1",
        "act-1",
      );

      expect(result.status).toBe("ACTIVE");
      expect(result.sessionId).toBeDefined();
    });

    it("is idempotent", async () => {
      classRepo.add(
        classEntity({
          id: "class-a",
          schoolId: "school-a",
          name: "一班",
          grade: "G3",
          teacherUserIds: ["teacher-1"],
        }),
      );
      classRepo.enroll("class-a", {
        classId: "class-a",
        schoolId: "school-a",
        userId: "student-1",
        roleInClass: MembershipRole.STUDENT,
      });
      courseRepo.add(
        courseVersion({
          id: "cv-1",
          schoolId: "school-a",
          status: "PUBLISHED",
          title: "已发布课程",
          units: [
            unit({
              lessons: [
                lesson({
                  activities: [
                    activity({ id: "act-1", type: "TEXT", title: "阅读" }),
                  ],
                }),
              ],
            }),
          ],
        }),
      );
      assignmentRepo.add(
        publishedAssignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "任务",
        }),
      );

      const first = await service.startSession(
        auth("student-1", "school-a", [MembershipRole.STUDENT]),
        "school-a",
        "asn-1",
        "act-1",
      );
      const second = await service.startSession(
        auth("student-1", "school-a", [MembershipRole.STUDENT]),
        "school-a",
        "asn-1",
        "act-1",
      );

      expect(first.sessionId).toBe(second.sessionId);
    });

    it("rejects before publish", async () => {
      classRepo.add(
        classEntity({
          id: "class-a",
          schoolId: "school-a",
          name: "一班",
          grade: "G3",
          teacherUserIds: ["teacher-1"],
        }),
      );
      classRepo.enroll("class-a", {
        classId: "class-a",
        schoolId: "school-a",
        userId: "student-1",
        roleInClass: MembershipRole.STUDENT,
      });
      courseRepo.add(
        courseVersion({
          id: "cv-1",
          schoolId: "school-a",
          status: "PUBLISHED",
          title: "已发布课程",
          units: [
            unit({
              lessons: [
                lesson({
                  activities: [
                    activity({ id: "act-1", type: "TEXT", title: "阅读" }),
                  ],
                }),
              ],
            }),
          ],
        }),
      );
      assignmentRepo.add(
        publishedAssignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "任务",
          publishAt: new Date("2099-01-01T00:00:00Z"),
        }),
      );

      await expect(
        service.startSession(
          auth("student-1", "school-a", [MembershipRole.STUDENT]),
          "school-a",
          "asn-1",
          "act-1",
        ),
      ).rejects.toThrow();
    });

    it("rejects after due when late policy is REJECT", async () => {
      classRepo.add(
        classEntity({
          id: "class-a",
          schoolId: "school-a",
          name: "一班",
          grade: "G3",
          teacherUserIds: ["teacher-1"],
        }),
      );
      classRepo.enroll("class-a", {
        classId: "class-a",
        schoolId: "school-a",
        userId: "student-1",
        roleInClass: MembershipRole.STUDENT,
      });
      courseRepo.add(
        courseVersion({
          id: "cv-1",
          schoolId: "school-a",
          status: "PUBLISHED",
          title: "已发布课程",
          units: [
            unit({
              lessons: [
                lesson({
                  activities: [
                    activity({ id: "act-1", type: "TEXT", title: "阅读" }),
                  ],
                }),
              ],
            }),
          ],
        }),
      );
      assignmentRepo.add(
        publishedAssignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "任务",
          dueAt: new Date("2020-01-01T00:00:00Z"),
          latePolicy: "REJECT",
        }),
      );

      await expect(
        service.startSession(
          auth("student-1", "school-a", [MembershipRole.STUDENT]),
          "school-a",
          "asn-1",
          "act-1",
        ),
      ).rejects.toThrow();
    });
  });

  describe("updateProgress", () => {
    it("creates progress when session is active", async () => {
      classRepo.add(
        classEntity({
          id: "class-a",
          schoolId: "school-a",
          name: "一班",
          grade: "G3",
          teacherUserIds: ["teacher-1"],
        }),
      );
      classRepo.enroll("class-a", {
        classId: "class-a",
        schoolId: "school-a",
        userId: "student-1",
        roleInClass: MembershipRole.STUDENT,
      });
      courseRepo.add(
        courseVersion({
          id: "cv-1",
          schoolId: "school-a",
          status: "PUBLISHED",
          title: "已发布课程",
        }),
      );
      assignmentRepo.add(
        publishedAssignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "任务",
        }),
      );
      learningRepo.addSession(
        learningSession({
          id: "session-1",
          schoolId: "school-a",
          assignmentId: "asn-1",
          activityId: "act-1",
          studentUserId: "student-1",
          enrollmentId: "class-a:student-1",
        }),
      );

      const result = await service.updateProgress(
        auth("student-1", "school-a", [MembershipRole.STUDENT]),
        "school-a",
        "asn-1",
        "act-1",
        { progressPercent: 60, serverState: { page: 3 } },
      );

      expect(result.progressPercent).toBe(60);
      expect(result.serverState).toEqual({ page: 3 });
    });

    it("rejects updating progress without active session", async () => {
      classRepo.add(
        classEntity({
          id: "class-a",
          schoolId: "school-a",
          name: "一班",
          grade: "G3",
          teacherUserIds: ["teacher-1"],
        }),
      );
      classRepo.enroll("class-a", {
        classId: "class-a",
        schoolId: "school-a",
        userId: "student-1",
        roleInClass: MembershipRole.STUDENT,
      });
      courseRepo.add(
        courseVersion({
          id: "cv-1",
          schoolId: "school-a",
          status: "PUBLISHED",
          title: "已发布课程",
        }),
      );
      assignmentRepo.add(
        publishedAssignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "任务",
        }),
      );

      await expect(
        service.updateProgress(
          auth("student-1", "school-a", [MembershipRole.STUDENT]),
          "school-a",
          "asn-1",
          "act-1",
          { progressPercent: 60 },
        ),
      ).rejects.toThrow();
    });
  });

  describe("completeActivity", () => {
    it("creates a SUBMITTED submission and completes session", async () => {
      classRepo.add(
        classEntity({
          id: "class-a",
          schoolId: "school-a",
          name: "一班",
          grade: "G3",
          teacherUserIds: ["teacher-1"],
        }),
      );
      classRepo.enroll("class-a", {
        classId: "class-a",
        schoolId: "school-a",
        userId: "student-1",
        roleInClass: MembershipRole.STUDENT,
      });
      courseRepo.add(
        courseVersion({
          id: "cv-1",
          schoolId: "school-a",
          status: "PUBLISHED",
          title: "已发布课程",
        }),
      );
      assignmentRepo.add(
        publishedAssignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "任务",
        }),
      );
      learningRepo.addSession(
        learningSession({
          id: "session-1",
          schoolId: "school-a",
          assignmentId: "asn-1",
          activityId: "act-1",
          studentUserId: "student-1",
          enrollmentId: "class-a:student-1",
        }),
      );

      const result = await service.completeActivity(
        auth("student-1", "school-a", [MembershipRole.STUDENT]),
        "school-a",
        "asn-1",
        "act-1",
        { answers: { selected: ["A"] } },
      );

      expect(result.status).toBe("SUBMITTED");
      expect(result.attemptNo).toBe(1);
      expect(result.score).toBeUndefined();

      const session = await learningRepo.findSession(
        "school-a",
        "asn-1",
        "act-1",
        "student-1",
      );
      expect(session?.status).toBe("COMPLETED");
    });

    it("rejects completion without active session", async () => {
      classRepo.add(
        classEntity({
          id: "class-a",
          schoolId: "school-a",
          name: "一班",
          grade: "G3",
          teacherUserIds: ["teacher-1"],
        }),
      );
      classRepo.enroll("class-a", {
        classId: "class-a",
        schoolId: "school-a",
        userId: "student-1",
        roleInClass: MembershipRole.STUDENT,
      });
      courseRepo.add(
        courseVersion({
          id: "cv-1",
          schoolId: "school-a",
          status: "PUBLISHED",
          title: "已发布课程",
        }),
      );
      assignmentRepo.add(
        publishedAssignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "任务",
        }),
      );

      await expect(
        service.completeActivity(
          auth("student-1", "school-a", [MembershipRole.STUDENT]),
          "school-a",
          "asn-1",
          "act-1",
          {},
        ),
      ).rejects.toThrow();
    });
  });

  describe("tenant isolation", () => {
    it("returns not found for cross-school assignment", async () => {
      assignmentRepo.add(
        publishedAssignment({
          id: "asn-1",
          schoolId: "school-b",
          classId: "class-b",
          courseVersionId: "cv-1",
          title: "外校任务",
        }),
      );

      await expect(
        service.getActivityDetail(
          auth("student-1", "school-a", [MembershipRole.STUDENT]),
          "school-a",
          "asn-1",
          "act-1",
        ),
      ).rejects.toThrow();
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
      classRepo.enroll("class-a", {
        classId: "class-a",
        schoolId: "school-a",
        userId: "student-1",
        roleInClass: MembershipRole.STUDENT,
      });
      courseRepo.add(
        courseVersion({
          id: "cv-1",
          schoolId: "school-a",
          status: "PUBLISHED",
          title: "已发布课程",
        }),
      );
      assignmentRepo.add(
        publishedAssignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "任务",
        }),
      );

      await expect(
        service.listToday(
          auth("student-1", "school-a", [MembershipRole.STUDENT]),
          "school-b",
        ),
      ).rejects.toThrow();
    });

    it("rejects teacher accessing student learning", async () => {
      await expect(
        service.listToday(
          auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
          "school-a",
        ),
      ).rejects.toThrow();
    });
  });

  describe("RETIRED course version", () => {
    it("still allows access to already-published assignment", async () => {
      classRepo.add(
        classEntity({
          id: "class-a",
          schoolId: "school-a",
          name: "一班",
          grade: "G3",
          teacherUserIds: ["teacher-1"],
        }),
      );
      classRepo.enroll("class-a", {
        classId: "class-a",
        schoolId: "school-a",
        userId: "student-1",
        roleInClass: MembershipRole.STUDENT,
      });
      courseRepo.add(
        courseVersion({
          id: "cv-1",
          schoolId: "school-a",
          status: "RETIRED",
          title: "已停用课程",
          units: [
            unit({
              lessons: [
                lesson({
                  activities: [
                    activity({ id: "act-1", type: "TEXT", title: "阅读" }),
                  ],
                }),
              ],
            }),
          ],
        }),
      );
      assignmentRepo.add(
        publishedAssignment({
          id: "asn-1",
          schoolId: "school-a",
          classId: "class-a",
          courseVersionId: "cv-1",
          title: "既有任务",
        }),
      );

      const detail = await service.getActivityDetail(
        auth("student-1", "school-a", [MembershipRole.STUDENT]),
        "school-a",
        "asn-1",
        "act-1",
      );

      expect(detail.canStart).toBe(true);
    });
  });

  describe("repository unavailable", () => {
    it("fails closed when learning repository is unavailable", async () => {
      const published = assignment({
        id: "asn-1",
        schoolId: "school-a",
        classId: "class-a",
        courseVersionId: "cv-1",
        title: "今日任务",
        status: "PUBLISHED",
        activityRefs: [
          { activityId: "act-1", activityType: "TEXT", title: "阅读" },
        ],
        publishedAt: new Date("2026-07-01T00:00:00Z"),
      });

      const unavailableService = new LearningService(
        {
          findById: () => Promise.resolve(published),
          list: () =>
            Promise.resolve({
              items: [toAssignmentSummary(published)],
              nextCursor: null,
              hasMore: false,
            }),
          save: () => Promise.reject(new Error("unavailable")),
        } as never,
        classRepo,
        courseRepo,
        {
          findSession: () => {
            throw new Error("unavailable");
          },
          saveSession: () => {
            throw new Error("unavailable");
          },
          findProgress: () => {
            throw new Error("unavailable");
          },
          saveProgress: () => {
            throw new Error("unavailable");
          },
          countSubmissions: () => {
            throw new Error("unavailable");
          },
          saveSubmission: () => {
            throw new Error("unavailable");
          },
        } as never,
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
      classRepo.enroll("class-a", {
        classId: "class-a",
        schoolId: "school-a",
        userId: "student-1",
        roleInClass: MembershipRole.STUDENT,
      });

      await expect(
        unavailableService.listToday(
          auth("student-1", "school-a", [MembershipRole.STUDENT]),
          "school-a",
        ),
      ).rejects.toThrow();
    });
  });
});
