import { beforeEach, describe, expect, it } from "vitest";
import { HttpException } from "@nestjs/common";
import {
  createAuthContext,
  MembershipRole,
  MembershipStatus,
} from "../../src/common/security/index.js";
import { AssessmentService } from "../../src/modules/assessment/assessment.service.js";
import {
  AssessmentConflictException,
  AssessmentForbiddenException,
  AssessmentNotFoundException,
  AssessmentPreconditionFailedException,
} from "../../src/modules/assessment/domain/assessment.errors.js";
import { FakeAssignmentRepository } from "../assignments/fakes/fake-assignment.repository.js";
import { assignment } from "../assignments/fixtures/assignments.js";
import { FakeClassRepository } from "../organizations/fakes/fake-class.repository.js";
import { classEntity } from "../organizations/fixtures/classes.js";
import { FakeCourseVersionRepository } from "../curriculum/fakes/fake-course-version.repository.js";
import {
  activity,
  courseVersion,
  lesson,
  unit,
} from "../curriculum/fixtures/course-versions.js";
import { FakeAssessmentRepository } from "./fakes/fake-assessment.repository.js";
import { FixedClock } from "../assignments/fakes/fake-clock.js";
import {
  activityAttempt,
  answerDraft,
  fillBlankQuestion,
  matchingQuestion,
  multipleChoiceQuestion,
  orderingQuestion,
  shortAnswerQuestion,
  singleChoiceQuestion,
} from "./fixtures/assessment.js";

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

async function expectNotFound(
  promise: Promise<unknown>,
  message = "测评不存在",
): Promise<void> {
  const captured = await captureError(promise);
  expect(captured.status).toBe(404);
  expect(captured.body).toEqual({
    code: "ASSESSMENT_NOT_FOUND",
    message,
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
      { activityId: "act-1", activityType: "CHOICE", title: "选择题" },
    ],
    publishedAt: new Date("2026-07-01T00:00:00Z"),
    latePolicy: "ACCEPT",
    retryPolicy: { maxAttempts: 2, allowRetest: true },
    ...overrides,
  });
}

function makeService(
  assignmentRepo: FakeAssignmentRepository,
  classRepo: FakeClassRepository,
  courseRepo: FakeCourseVersionRepository,
  assessmentRepo: FakeAssessmentRepository,
  clock: FixedClock = new FixedClock(NOW),
) {
  return new AssessmentService(
    assignmentRepo,
    classRepo,
    courseRepo,
    assessmentRepo,
    clock,
  );
}

function exerciseActivity(
  id: string,
  questions: import("../../src/modules/assessment/domain/assessment.types.js").Question[],
) {
  return activity({
    id,
    type: "CHOICE",
    title: "测评活动",
    content: { questions },
  });
}

describe("AssessmentService", () => {
  let assignmentRepo: FakeAssignmentRepository;
  let classRepo: FakeClassRepository;
  let courseRepo: FakeCourseVersionRepository;
  let assessmentRepo: FakeAssessmentRepository;
  let service: AssessmentService;

  beforeEach(() => {
    assignmentRepo = new FakeAssignmentRepository();
    classRepo = new FakeClassRepository();
    courseRepo = new FakeCourseVersionRepository();
    assessmentRepo = new FakeAssessmentRepository();
    service = makeService(
      assignmentRepo,
      classRepo,
      courseRepo,
      assessmentRepo,
    );
  });

  describe("getExercise", () => {
    it("returns exercise with questions stripped of answer keys for students", async () => {
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
                    exerciseActivity("act-1", [
                      singleChoiceQuestion({ id: "q-1" }),
                    ]),
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
          title: "测评任务",
        }),
      );

      const result = await service.getExercise(
        auth("student-1", "school-a", [MembershipRole.STUDENT]),
        "school-a",
        "asn-1",
        "act-1",
      );

      expect(result.questions).toHaveLength(1);
      const question = result.questions[0];
      expect(question.kind).toBe("SINGLE_CHOICE");
      expect(question.answerKey).toEqual({ optionId: "" });
    });

    it("rejects before publishAt", async () => {
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
                  activities: [exerciseActivity("act-1", [])],
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
          title: "未来任务",
          publishAt: new Date("2099-01-01T00:00:00Z"),
        }),
      );

      const result = await service.getExercise(
        auth("student-1", "school-a", [MembershipRole.STUDENT]),
        "school-a",
        "asn-1",
        "act-1",
      );

      expect(result.canStart).toBe(false);
      expect(result.canSubmit).toBe(false);
    });
  });

  describe("saveDraft", () => {
    it("saves a draft", async () => {
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
                    exerciseActivity("act-1", [
                      singleChoiceQuestion({ id: "q-1" }),
                    ]),
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
          title: "测评任务",
        }),
      );

      const result = await service.saveDraft(
        auth("student-1", "school-a", [MembershipRole.STUDENT]),
        "school-a",
        "asn-1",
        "act-1",
        { answers: { "q-1": { kind: "SINGLE_CHOICE", optionId: "opt-a" } } },
      );

      expect(result.answers["q-1"]).toEqual({
        kind: "SINGLE_CHOICE",
        optionId: "opt-a",
      });
    });
  });

  describe("submitAnswers", () => {
    it("auto-grades single choice correctly", async () => {
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
                    exerciseActivity("act-1", [
                      singleChoiceQuestion({ id: "q-1" }),
                    ]),
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
          title: "测评任务",
        }),
      );

      const result = await service.submitAnswers(
        auth("student-1", "school-a", [MembershipRole.STUDENT]),
        "school-a",
        "asn-1",
        "act-1",
        { answers: { "q-1": { kind: "SINGLE_CHOICE", optionId: "opt-a" } } },
      );

      expect(result.attemptNo).toBe(1);
      expect(result.status).toBe("GRADED");
      expect(result.autoResult?.score).toBe(1);
      expect(result.autoResult?.maxScore).toBe(1);
    });

    it("auto-grades multiple choice incorrectly when partial", async () => {
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
                    exerciseActivity("act-1", [
                      multipleChoiceQuestion({ id: "q-1" }),
                    ]),
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
          title: "测评任务",
        }),
      );

      const result = await service.submitAnswers(
        auth("student-1", "school-a", [MembershipRole.STUDENT]),
        "school-a",
        "asn-1",
        "act-1",
        {
          answers: {
            "q-1": { kind: "MULTIPLE_CHOICE", optionIds: ["opt-a"] },
          },
        },
      );

      expect(result.autoResult?.score).toBe(0);
      expect(result.autoResult?.details[0].correct).toBe(false);
    });

    it("flags short answer for manual review instead of auto-scoring", async () => {
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
                    exerciseActivity("act-1", [
                      shortAnswerQuestion({ id: "q-1" }),
                    ]),
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
          title: "测评任务",
        }),
      );

      const result = await service.submitAnswers(
        auth("student-1", "school-a", [MembershipRole.STUDENT]),
        "school-a",
        "asn-1",
        "act-1",
        { answers: { "q-1": { kind: "SHORT_ANSWER", text: "我的答案" } } },
      );

      expect(result.status).toBe("NEEDS_REVIEW");
      expect(result.autoResult?.details[0].correct).toBeNull();
      expect(result.autoResult?.details[0].score).toBeNull();
    });

    it("rejects submission when attempt limit reached", async () => {
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
                    exerciseActivity("act-1", [
                      singleChoiceQuestion({ id: "q-1" }),
                    ]),
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
          title: "测评任务",
          retryPolicy: { maxAttempts: 1, allowRetest: false },
        }),
      );
      assessmentRepo.addAttempt(
        activityAttempt({
          id: "attempt-1",
          schoolId: "school-a",
          assignmentId: "asn-1",
          activityId: "act-1",
          studentUserId: "student-1",
          attemptNo: 1,
          enrollmentId: "class-a:student-1",
        }),
      );

      await expect(
        service.submitAnswers(
          auth("student-1", "school-a", [MembershipRole.STUDENT]),
          "school-a",
          "asn-1",
          "act-1",
          { answers: { "q-1": { kind: "SINGLE_CHOICE", optionId: "opt-a" } } },
        ),
      ).rejects.toBeInstanceOf(AssessmentConflictException);
    });

    it("rejects submission after due when late policy is REJECT", async () => {
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
                    exerciseActivity("act-1", [
                      singleChoiceQuestion({ id: "q-1" }),
                    ]),
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
          title: "测评任务",
          dueAt: new Date("2020-01-01T00:00:00Z"),
          latePolicy: "REJECT",
        }),
      );

      await expect(
        service.submitAnswers(
          auth("student-1", "school-a", [MembershipRole.STUDENT]),
          "school-a",
          "asn-1",
          "act-1",
          { answers: { "q-1": { kind: "SINGLE_CHOICE", optionId: "opt-a" } } },
        ),
      ).rejects.toBeInstanceOf(AssessmentPreconditionFailedException);
    });
  });

  describe("getResult", () => {
    it("hides answer key from student before due date", async () => {
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
                    exerciseActivity("act-1", [
                      singleChoiceQuestion({ id: "q-1" }),
                    ]),
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
          title: "测评任务",
          dueAt: new Date("2099-01-01T00:00:00Z"),
        }),
      );
      assessmentRepo.addAttempt(
        activityAttempt({
          id: "attempt-1",
          schoolId: "school-a",
          assignmentId: "asn-1",
          activityId: "act-1",
          studentUserId: "student-1",
          attemptNo: 1,
          enrollmentId: "class-a:student-1",
          status: "GRADED",
          answers: { "q-1": { kind: "SINGLE_CHOICE", optionId: "opt-a" } },
          autoResult: {
            score: 1,
            maxScore: 1,
            details: [
              {
                questionId: "q-1",
                kind: "SINGLE_CHOICE",
                correct: true,
                score: 1,
              },
            ],
          },
        }),
      );

      const result = await service.getResult(
        auth("student-1", "school-a", [MembershipRole.STUDENT]),
        "school-a",
        "asn-1",
        "act-1",
        "attempt-1",
      );

      expect(result.answerKeyVisible).toBe(false);
      expect(result.questions[0].answerKey).toEqual({ optionId: "" });
    });

    it("shows answer key to student after due date", async () => {
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
                    exerciseActivity("act-1", [
                      singleChoiceQuestion({ id: "q-1" }),
                    ]),
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
          title: "测评任务",
          dueAt: new Date("2020-01-01T00:00:00Z"),
        }),
      );
      assessmentRepo.addAttempt(
        activityAttempt({
          id: "attempt-1",
          schoolId: "school-a",
          assignmentId: "asn-1",
          activityId: "act-1",
          studentUserId: "student-1",
          attemptNo: 1,
          enrollmentId: "class-a:student-1",
          status: "GRADED",
          answers: { "q-1": { kind: "SINGLE_CHOICE", optionId: "opt-a" } },
          autoResult: {
            score: 1,
            maxScore: 1,
            details: [
              {
                questionId: "q-1",
                kind: "SINGLE_CHOICE",
                correct: true,
                score: 1,
              },
            ],
          },
        }),
      );

      const result = await service.getResult(
        auth("student-1", "school-a", [MembershipRole.STUDENT]),
        "school-a",
        "asn-1",
        "act-1",
        "attempt-1",
      );

      expect(result.answerKeyVisible).toBe(true);
      expect(result.questions[0].answerKey).toEqual({ optionId: "opt-a" });
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
        service.getExercise(
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
          units: [
            unit({
              lessons: [
                lesson({
                  activities: [exerciseActivity("act-1", [])],
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
          title: "测评任务",
        }),
      );

      await expect(
        service.getExercise(
          auth("student-1", "school-a", [MembershipRole.STUDENT]),
          "school-b",
          "asn-1",
          "act-1",
        ),
      ).rejects.toThrow();
    });
  });

  describe("security semantics", () => {
    it("returns 404 for assignment in unjoined class", async () => {
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
          units: [
            unit({
              lessons: [
                lesson({
                  activities: [exerciseActivity("act-1", [])],
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
          title: "未加入班级任务",
        }),
      );

      await expectNotFound(
        service.getExercise(
          auth("student-1", "school-a", [MembershipRole.STUDENT]),
          "school-a",
          "asn-1",
          "act-1",
        ),
      );
    });

    it("rejects non-student roles", async () => {
      await expect(
        service.getExercise(
          auth("teacher-1", "school-a", [MembershipRole.TEACHER]),
          "school-a",
          "asn-1",
          "act-1",
        ),
      ).rejects.toBeInstanceOf(AssessmentForbiddenException);
    });

    it.each([
      MembershipStatus.INVITED,
      MembershipStatus.SUSPENDED,
      MembershipStatus.LEFT,
    ])("rejects %s membership", async (status) => {
      await expect(
        service.getExercise(
          auth("student-1", "school-a", [MembershipRole.STUDENT], status),
          "school-a",
          "asn-1",
          "act-1",
        ),
      ).rejects.toBeInstanceOf(AssessmentForbiddenException);
    });
  });

  describe("repository unavailable", () => {
    it("fails closed when assessment repository is unavailable", async () => {
      const published = assignment({
        id: "asn-1",
        schoolId: "school-a",
        classId: "class-a",
        courseVersionId: "cv-1",
        title: "测评任务",
        status: "PUBLISHED",
        activityRefs: [
          { activityId: "act-1", activityType: "CHOICE", title: "选择" },
        ],
        publishedAt: new Date("2026-07-01T00:00:00Z"),
      });

      const unavailableService = new AssessmentService(
        {
          findById: () => Promise.resolve(published),
          list: () =>
            Promise.resolve({
              items: [],
              nextCursor: null,
              hasMore: false,
            }),
          save: () => Promise.reject(new Error("unavailable")),
        } as never,
        classRepo,
        courseRepo,
        {
          findDraft: () => {
            throw new Error("unavailable");
          },
          saveDraft: () => {
            throw new Error("unavailable");
          },
          countAttempts: () => {
            throw new Error("unavailable");
          },
          findAttempts: () => {
            throw new Error("unavailable");
          },
          findAttemptById: () => {
            throw new Error("unavailable");
          },
          saveAttempt: () => {
            throw new Error("unavailable");
          },
        } as never,
        new FixedClock(NOW),
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
        unavailableService.saveDraft(
          auth("student-1", "school-a", [MembershipRole.STUDENT]),
          "school-a",
          "asn-1",
          "act-1",
          { answers: {} },
        ),
      ).rejects.toThrow();
    });
  });
});
