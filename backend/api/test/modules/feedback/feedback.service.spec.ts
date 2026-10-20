import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import {
  MembershipRole,
  MembershipStatus,
  createAuthContext,
} from "../../../src/common/security/index.js";
import { FeedbackService } from "../../../src/modules/feedback/feedback.service.js";
import {
  FeedbackForbiddenException,
  SubmissionNotReviewableException,
} from "../../../src/modules/feedback/domain/feedback.errors.js";
import type { FeedbackDecision } from "../../../src/modules/feedback/domain/feedback.types.js";
import { PrismaFeedbackRepository } from "../../../src/modules/feedback/infra/prisma-feedback.repository.js";
import { FEEDBACK_REPOSITORY } from "../../../src/modules/feedback/ports/feedback-repository.port.js";
import {
  SUBMISSION_LOOKUP,
  type SubmissionLookupPort,
} from "../../../src/modules/submissions/ports/submission-lookup.port.js";
import type {
  SubmissionStatus,
  SubmissionSummary,
} from "../../../src/modules/submissions/domain/submission.types.js";
import { PrismaService } from "../../../src/shared/database/prisma.service.js";
import { FakeFeedbackRepository } from "./fakes/fake-feedback.repository.js";
import { feedback } from "./fixtures/feedback.js";

const schoolId = "school-a";
const submissionId = "submission-a";

type EnrollmentRow = {
  id: string;
  schoolId: string;
  classId: string;
  userId: string;
  role: MembershipRole;
  status: MembershipStatus;
};

type DbSubmission = {
  id: string;
  schoolId: string;
  status: SubmissionStatus;
  revision: number;
  deletedAt: Date | null;
};

type FeedbackCreateData = {
  schoolId: string;
  submissionId: string;
  authorUserId: string;
  decision: FeedbackDecision;
  comment: string;
  score: number | null;
  revision: number;
  releasedAt: Date;
};

type FeedbackRow = FeedbackCreateData & { id: string };
type TransitionWhere = {
  id: string;
  schoolId: string;
  deletedAt: null;
  status: "NEEDS_REVIEW";
  revision: number;
};

type MockTransaction = {
  submission: {
    updateMany(args: {
      where: TransitionWhere;
      data: {
        status: SubmissionStatus;
        revision: { increment: number };
      };
    }): Promise<{ count: number }>;
  };
  feedback: {
    create(args: { data: FeedbackCreateData }): Promise<FeedbackRow>;
  };
};

type HarnessOptions = {
  summary?: SubmissionSummary;
  databaseRevision?: number;
  databaseStatus?: SubmissionStatus;
  enrollments?: EnrollmentRow[];
  deleted?: boolean;
};

type Harness = {
  service: FeedbackService;
  feedbackRepo: FakeFeedbackRepository;
  lookup: MemorySubmissionLookup;
  db: {
    enrollments: EnrollmentRow[];
    submission: DbSubmission;
    persistedFeedbacks: FeedbackRow[];
    transitionCounts: number[];
    transitionWheres: TransitionWhere[];
    feedbackCreateCalls: number;
  };
};

function auth(
  userId: string,
  tenantSchoolId: string,
  roles: MembershipRole[],
  membershipStatus = MembershipStatus.ACTIVE,
) {
  return createAuthContext(
    "req-1",
    { userId, roles, membershipStatus, source: "test" },
    { schoolId: tenantSchoolId },
  );
}

const teacherAuth = auth("teacher-a", schoolId, [MembershipRole.TEACHER]);
const otherClassTeacherAuth = auth("teacher-b", schoolId, [
  MembershipRole.TEACHER,
]);
const adminAuth = auth("admin-a", schoolId, [MembershipRole.SCHOOL_ADMIN]);
const studentAuth = auth("student-a", schoolId, [MembershipRole.STUDENT]);
const otherStudentAuth = auth("student-b", schoolId, [MembershipRole.STUDENT]);

function submissionSummary(
  overrides: Partial<SubmissionSummary> = {},
): SubmissionSummary {
  return {
    id: submissionId,
    schoolId,
    assignmentId: "assignment-a",
    enrollmentId: "student-enrollment-a",
    attemptNo: 1,
    status: "NEEDS_REVIEW",
    revision: 4,
    createdAt: new Date("2026-10-20T00:00:00.000Z"),
    ...overrides,
  };
}

function defaultEnrollments(): EnrollmentRow[] {
  return [
    {
      id: "student-enrollment-a",
      schoolId,
      classId: "class-a",
      userId: "student-a",
      role: MembershipRole.STUDENT,
      status: MembershipStatus.ACTIVE,
    },
    {
      id: "teacher-enrollment-a",
      schoolId,
      classId: "class-a",
      userId: "teacher-a",
      role: MembershipRole.TEACHER,
      status: MembershipStatus.ACTIVE,
    },
  ];
}

class MemorySubmissionLookup implements SubmissionLookupPort {
  private readonly records = new Map<
    string,
    { summary: SubmissionSummary; deleted: boolean }
  >();
  findCalls = 0;

  add(summary: SubmissionSummary, deleted = false): void {
    this.records.set(summary.id, { summary, deleted });
  }

  remove(submissionId: string): void {
    this.records.delete(submissionId);
  }

  findSummaryById(
    requestedSchoolId: string,
    requestedSubmissionId: string,
  ): Promise<SubmissionSummary | null> {
    this.findCalls += 1;
    const record = this.records.get(requestedSubmissionId);
    if (
      !record ||
      record.deleted ||
      record.summary.schoolId !== requestedSchoolId
    ) {
      return Promise.resolve(null);
    }
    return Promise.resolve(record.summary);
  }

  transitionStatus(
    _schoolId: string,
    _submissionId: string,
    _to: SubmissionStatus,
    _expectedRevision: number,
  ): Promise<SubmissionSummary> {
    void _schoolId;
    void _submissionId;
    void _to;
    void _expectedRevision;
    return Promise.reject(
      new Error("FeedbackService must use its atomic transaction transition"),
    );
  }
}

async function makeHarness(options: HarnessOptions = {}): Promise<Harness> {
  const summary = options.summary ?? submissionSummary();
  const db = {
    enrollments: options.enrollments ?? defaultEnrollments(),
    submission: {
      id: summary.id,
      schoolId: summary.schoolId,
      status: options.databaseStatus ?? summary.status,
      revision: options.databaseRevision ?? summary.revision,
      deletedAt: options.deleted ? new Date() : null,
    },
    persistedFeedbacks: [] as FeedbackRow[],
    transitionCounts: [] as number[],
    transitionWheres: [] as TransitionWhere[],
    feedbackCreateCalls: 0,
  };

  const enrollmentMatches = (
    row: EnrollmentRow,
    where: Partial<EnrollmentRow>,
  ) =>
    Object.entries(where).every(
      ([key, value]) => row[key as keyof EnrollmentRow] === value,
    );

  let transactionTail = Promise.resolve();
  const prisma = {
    enrollment: {
      findFirst: (args: { where: Partial<EnrollmentRow> }) =>
        Promise.resolve(
          db.enrollments.find((row) => enrollmentMatches(row, args.where)) ??
            null,
        ),
      findMany: (args: { where: Partial<EnrollmentRow> }) =>
        Promise.resolve(
          db.enrollments.filter((row) => enrollmentMatches(row, args.where)),
        ),
    },
    $transaction: async <T>(callback: (tx: MockTransaction) => Promise<T>) => {
      const previous = transactionTail;
      let release: () => void = () => undefined;
      transactionTail = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;

      const submissionBefore = { ...db.submission };
      const feedbackCountBefore = db.persistedFeedbacks.length;
      const tx: MockTransaction = {
        submission: {
          updateMany: ({ where, data }) => {
            db.transitionWheres.push(where);
            const matches =
              db.submission.id === where.id &&
              db.submission.schoolId === where.schoolId &&
              db.submission.deletedAt === where.deletedAt &&
              db.submission.status === where.status &&
              db.submission.revision === where.revision;
            const count = matches ? 1 : 0;
            db.transitionCounts.push(count);
            if (matches) {
              db.submission = {
                ...db.submission,
                status: data.status,
                revision: db.submission.revision + data.revision.increment,
              };
            }
            return Promise.resolve({ count });
          },
        },
        feedback: {
          create: ({ data }) => {
            db.feedbackCreateCalls += 1;
            const row = { ...data, id: `feedback-${db.feedbackCreateCalls}` };
            db.persistedFeedbacks.push(row);
            return Promise.resolve(row);
          },
        },
      };

      try {
        return await callback(tx);
      } catch (error) {
        db.submission = submissionBefore;
        db.persistedFeedbacks.splice(feedbackCountBefore);
        throw error;
      } finally {
        release();
      }
    },
  };

  const feedbackRepo = new FakeFeedbackRepository();
  const lookup = new MemorySubmissionLookup();
  lookup.add(summary, options.deleted ?? false);
  const moduleRef = await Test.createTestingModule({
    providers: [
      FeedbackService,
      { provide: FEEDBACK_REPOSITORY, useValue: feedbackRepo },
      { provide: SUBMISSION_LOOKUP, useValue: lookup },
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();

  return {
    service: moduleRef.get(FeedbackService),
    feedbackRepo,
    lookup,
    db,
  };
}

function expectNoFeedbackWrite(
  harness: Harness,
  expectedTransitionCounts: number[] = [],
): void {
  expect(harness.db.transitionCounts).toEqual(expectedTransitionCounts);
  expect(harness.db.persistedFeedbacks).toHaveLength(0);
  expect(harness.db.feedbackCreateCalls).toBe(0);
}

describe("FeedbackService", () => {
  describe("createFeedback", () => {
    it("allows an assigned-class teacher to ACCEPT and advances the expected revision", async () => {
      const harness = await makeHarness();

      const result = await harness.service.createFeedback(
        teacherAuth,
        schoolId,
        submissionId,
        { decision: "ACCEPT", comment: "Great work!" },
      );

      expect(result.decision).toBe("ACCEPT");
      expect(harness.db.submission.status).toBe("ACCEPTED");
      expect(harness.db.submission.revision).toBe(5);
      expect(harness.db.transitionCounts).toEqual([1]);
      expect(harness.db.transitionWheres).toEqual([
        {
          id: submissionId,
          schoolId,
          deletedAt: null,
          status: "NEEDS_REVIEW",
          revision: 4,
        },
      ]);
      expect(harness.db.persistedFeedbacks).toHaveLength(1);
    });

    it("allows an assigned-class teacher to RETURN a NEEDS_REVIEW submission", async () => {
      const harness = await makeHarness();

      const result = await harness.service.createFeedback(
        teacherAuth,
        schoolId,
        submissionId,
        { decision: "RETURN", comment: "Please retry." },
      );

      expect(result.decision).toBe("RETURN");
      expect(harness.db.submission.status).toBe("RETURNED");
      expect(harness.db.transitionCounts).toEqual([1]);
      expect(harness.db.persistedFeedbacks).toHaveLength(1);
    });

    it("allows a same-school administrator to review without class enrollment", async () => {
      const harness = await makeHarness({
        enrollments: [defaultEnrollments()[0]!],
      });

      const result = await harness.service.createFeedback(
        adminAuth,
        schoolId,
        submissionId,
        { decision: "ACCEPT", comment: "Approved." },
      );

      expect(result.decision).toBe("ACCEPT");
      expect(harness.db.transitionCounts).toEqual([1]);
      expect(harness.db.persistedFeedbacks).toHaveLength(1);
    });

    it("denies a teacher assigned only to another class without writing", async () => {
      const enrollments = [
        defaultEnrollments()[0]!,
        {
          id: "teacher-enrollment-b",
          schoolId,
          classId: "class-b",
          userId: "teacher-b",
          role: MembershipRole.TEACHER,
          status: MembershipStatus.ACTIVE,
        },
      ];
      const harness = await makeHarness({ enrollments });

      await expect(
        harness.service.createFeedback(
          otherClassTeacherAuth,
          schoolId,
          submissionId,
          { decision: "RETURN", comment: "Unauthorized." },
        ),
      ).rejects.toBeInstanceOf(FeedbackForbiddenException);
      expectNoFeedbackWrite(harness);
    });

    it("denies cross-school and non-member create attempts before submission lookup", async () => {
      const harness = await makeHarness();

      await expect(
        harness.service.createFeedback(teacherAuth, "school-b", submissionId, {
          decision: "ACCEPT",
          comment: "Wrong school.",
        }),
      ).rejects.toBeInstanceOf(FeedbackForbiddenException);
      await expect(
        harness.service.createFeedback(
          auth("teacher-a", "school-b", [MembershipRole.TEACHER]),
          schoolId,
          submissionId,
          { decision: "ACCEPT", comment: "Non-member." },
        ),
      ).rejects.toBeInstanceOf(FeedbackForbiddenException);

      expect(harness.lookup.findCalls).toBe(0);
      expectNoFeedbackWrite(harness);
    });

    it("denies an inactive teacher enrollment", async () => {
      const enrollments = defaultEnrollments().map((row) =>
        row.role === MembershipRole.TEACHER
          ? { ...row, status: MembershipStatus.LEFT }
          : row,
      );
      const harness = await makeHarness({ enrollments });

      await expect(
        harness.service.createFeedback(teacherAuth, schoolId, submissionId, {
          decision: "ACCEPT",
          comment: "Inactive teacher.",
        }),
      ).rejects.toBeInstanceOf(FeedbackForbiddenException);
      expectNoFeedbackWrite(harness);
    });

    it("fails closed for inactive or missing student enrollment", async () => {
      for (const enrollments of [
        defaultEnrollments().map((row) =>
          row.role === MembershipRole.STUDENT
            ? { ...row, status: MembershipStatus.SUSPENDED }
            : row,
        ),
        defaultEnrollments().filter(
          (row) => row.role !== MembershipRole.STUDENT,
        ),
      ]) {
        const harness = await makeHarness({ enrollments });
        await expect(
          harness.service.createFeedback(teacherAuth, schoolId, submissionId, {
            decision: "ACCEPT",
            comment: "No active student.",
          }),
        ).rejects.toBeInstanceOf(FeedbackForbiddenException);
        expectNoFeedbackWrite(harness);
      }
    });

    it("rejects student create attempts without transitioning or persisting", async () => {
      const harness = await makeHarness();
      await expect(
        harness.service.createFeedback(studentAuth, schoolId, submissionId, {
          decision: "RETURN",
          comment: "Student review.",
        }),
      ).rejects.toBeInstanceOf(FeedbackForbiddenException);
      expectNoFeedbackWrite(harness);
    });

    it("treats wrong-school, unknown, and deleted submissions as not reviewable", async () => {
      const wrongSchool = await makeHarness({
        summary: submissionSummary({ schoolId: "school-b" }),
      });
      const deleted = await makeHarness({ deleted: true });
      const unknown = await makeHarness();
      unknown.lookup.remove(submissionId);

      for (const harness of [wrongSchool, deleted, unknown]) {
        await expect(
          harness.service.createFeedback(teacherAuth, schoolId, submissionId, {
            decision: "ACCEPT",
            comment: "Unavailable.",
          }),
        ).rejects.toBeInstanceOf(SubmissionNotReviewableException);
        expectNoFeedbackWrite(harness);
      }
    });

    it.each([
      "IN_PROGRESS",
      "PENDING_SYNC",
      "SUBMITTED",
      "PROCESSING",
      "REVIEWED",
      "RETURNED",
      "ACCEPTED",
    ] as const)(
      "does not write feedback for %s submissions",
      async (status) => {
        const harness = await makeHarness({
          summary: submissionSummary({ status }),
        });

        await expect(
          harness.service.createFeedback(teacherAuth, schoolId, submissionId, {
            decision: "ACCEPT",
            comment: "Invalid status.",
          }),
        ).rejects.toBeInstanceOf(SubmissionNotReviewableException);
        expectNoFeedbackWrite(harness);
      },
    );

    it("rejects a stale submission revision with a zero-row transition and no feedback write", async () => {
      const harness = await makeHarness({ databaseRevision: 5 });

      await expect(
        harness.service.createFeedback(teacherAuth, schoolId, submissionId, {
          decision: "ACCEPT",
          comment: "Stale revision.",
        }),
      ).rejects.toBeInstanceOf(SubmissionNotReviewableException);

      expectNoFeedbackWrite(harness, [0]);
      expect(harness.db.submission.status).toBe("NEEDS_REVIEW");
      expect(harness.db.submission.revision).toBe(5);
    });

    it("allows only one of repeated concurrent reviews to transition and persist feedback", async () => {
      const harness = await makeHarness();
      const results = await Promise.allSettled([
        harness.service.createFeedback(teacherAuth, schoolId, submissionId, {
          decision: "ACCEPT",
          comment: "First review.",
        }),
        harness.service.createFeedback(teacherAuth, schoolId, submissionId, {
          decision: "RETURN",
          comment: "Competing review.",
        }),
      ]);

      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === "rejected"),
      ).toHaveLength(1);
      expect(harness.db.transitionCounts.sort()).toEqual([0, 1]);
      expect(harness.db.feedbackCreateCalls).toBe(1);
      expect(harness.db.persistedFeedbacks).toHaveLength(1);
      expect(harness.db.submission.revision).toBe(5);
      expect(["ACCEPTED", "RETURNED"]).toContain(harness.db.submission.status);
    });
  });

  describe("getFeedbackBySubmission", () => {
    it("allows an assigned-class teacher to read feedback", async () => {
      const harness = await makeHarness();
      harness.feedbackRepo.add(feedback({ schoolId, submissionId }));

      const result = await harness.service.getFeedbackBySubmission(
        teacherAuth,
        schoolId,
        submissionId,
      );

      expect(result).toHaveLength(1);
    });

    it("allows a same-school administrator to read feedback", async () => {
      const studentEnrollment = {
        ...defaultEnrollments()[0]!,
        status: MembershipStatus.LEFT,
      };
      const harness = await makeHarness({ enrollments: [studentEnrollment] });
      harness.feedbackRepo.add(feedback({ schoolId, submissionId }));

      const result = await harness.service.getFeedbackBySubmission(
        adminAuth,
        schoolId,
        submissionId,
      );

      expect(result).toHaveLength(1);
    });

    it("allows students to read only their own feedback", async () => {
      const harness = await makeHarness();
      harness.feedbackRepo.add(feedback({ schoolId, submissionId }));

      const own = await harness.service.getFeedbackBySubmission(
        studentAuth,
        schoolId,
        submissionId,
      );
      expect(own).toHaveLength(1);

      await expect(
        harness.service.getFeedbackBySubmission(
          otherStudentAuth,
          schoolId,
          submissionId,
        ),
      ).rejects.toBeInstanceOf(FeedbackForbiddenException);
    });

    it("denies another-class teachers and cross-school callers", async () => {
      const enrollments = [
        defaultEnrollments()[0]!,
        {
          id: "teacher-enrollment-b",
          schoolId,
          classId: "class-b",
          userId: "teacher-b",
          role: MembershipRole.TEACHER,
          status: MembershipStatus.ACTIVE,
        },
      ];
      const harness = await makeHarness({ enrollments });
      harness.feedbackRepo.add(feedback({ schoolId, submissionId }));

      await expect(
        harness.service.getFeedbackBySubmission(
          otherClassTeacherAuth,
          schoolId,
          submissionId,
        ),
      ).rejects.toBeInstanceOf(FeedbackForbiddenException);
      await expect(
        harness.service.getFeedbackBySubmission(
          teacherAuth,
          "school-b",
          submissionId,
        ),
      ).rejects.toBeInstanceOf(FeedbackForbiddenException);
      expect(harness.feedbackRepo.pendingQueries).toHaveLength(0);
    });

    it("returns an empty array for absent, deleted, or inactive-student submissions", async () => {
      const deleted = await makeHarness({ deleted: true });
      const inactive = await makeHarness({
        enrollments: defaultEnrollments().map((row) =>
          row.role === MembershipRole.STUDENT
            ? { ...row, status: MembershipStatus.LEFT }
            : row,
        ),
      });
      const missing = await makeHarness();
      missing.lookup.remove(submissionId);

      for (const harness of [deleted, inactive, missing]) {
        expect(
          await harness.service.getFeedbackBySubmission(
            teacherAuth,
            schoolId,
            submissionId,
          ),
        ).toEqual([]);
      }
    });
  });

  describe("listPendingFeedback", () => {
    it("passes only the teacher's active class IDs into the repository query", async () => {
      const enrollments = [
        ...defaultEnrollments(),
        {
          id: "teacher-enrollment-b",
          schoolId,
          classId: "class-b",
          userId: "teacher-a",
          role: MembershipRole.TEACHER,
          status: MembershipStatus.ACTIVE,
        },
      ];
      const harness = await makeHarness({ enrollments });

      await harness.service.listPendingFeedback(teacherAuth, schoolId, {
        limit: 1,
      });

      expect(harness.feedbackRepo.pendingQueries).toHaveLength(1);
      expect(harness.feedbackRepo.pendingQueries[0]?.options).toMatchObject({
        limit: 1,
        authorizedClassIds: ["class-a", "class-b"],
      });
    });

    it("scopes a teacher's pending list to that teacher's own other class", async () => {
      const harness = await makeHarness({
        enrollments: [
          defaultEnrollments()[0]!,
          {
            id: "teacher-enrollment-b",
            schoolId,
            classId: "class-b",
            userId: "teacher-b",
            role: MembershipRole.TEACHER,
            status: MembershipStatus.ACTIVE,
          },
        ],
      });

      await harness.service.listPendingFeedback(
        otherClassTeacherAuth,
        schoolId,
        {
          limit: 1,
        },
      );

      expect(harness.feedbackRepo.pendingQueries[0]?.options).toMatchObject({
        authorizedClassIds: ["class-b"],
      });
    });

    it("returns an empty page without metadata when the teacher has no active classes", async () => {
      const harness = await makeHarness({
        enrollments: [defaultEnrollments()[0]!],
      });

      const result = await harness.service.listPendingFeedback(
        otherClassTeacherAuth,
        schoolId,
        { limit: 1 },
      );

      expect(result).toEqual({ items: [], nextCursor: null, hasMore: false });
      expect(harness.feedbackRepo.submissionQueries).toHaveLength(0);
    });

    it("leaves same-school administrator queries school-wide", async () => {
      const harness = await makeHarness();

      await harness.service.listPendingFeedback(adminAuth, schoolId, {
        limit: 10,
      });

      expect(harness.feedbackRepo.pendingQueries[0]?.options).toEqual({
        limit: 10,
      });
    });

    it("denies students without making a pending query", async () => {
      const harness = await makeHarness();

      await expect(
        harness.service.listPendingFeedback(studentAuth, schoolId, {
          limit: 20,
        }),
      ).rejects.toBeInstanceOf(FeedbackForbiddenException);
      expect(harness.feedbackRepo.pendingQueries).toHaveLength(0);
    });
  });
});

describe("PrismaFeedbackRepository pending class scope", () => {
  it("applies teacher class and active-student scope in SQL before pagination", async () => {
    let query: { where: Record<string, unknown>; take: number } | undefined;
    const prisma = {
      submission: {
        findMany: (args: { where: Record<string, unknown>; take: number }) => {
          query = args;
          return Promise.resolve([{ id: "scoped-submission" }]);
        },
      },
      feedback: {
        findMany: () =>
          Promise.resolve([
            {
              id: "feedback-1",
              schoolId,
              submissionId: "scoped-submission",
              authorUserId: "teacher-a",
              decision: "ACCEPT" as const,
              comment: "Reviewed.",
              score: null,
              revision: 1,
              releasedAt: new Date("2026-10-20T00:00:00.000Z"),
              deletedAt: null,
            },
          ]),
      },
    };
    const repository = new PrismaFeedbackRepository(
      prisma as unknown as PrismaService,
    );

    const result = await repository.findPendingBySchool(schoolId, {
      limit: 1,
      authorizedClassIds: ["class-b"],
    });

    expect(query?.take).toBe(2);
    expect(query?.where).toMatchObject({
      schoolId,
      status: "NEEDS_REVIEW",
      deletedAt: null,
      enrollment: {
        is: {
          schoolId,
          role: "STUDENT",
          status: "ACTIVE",
          classId: { in: ["class-b"] },
        },
      },
    });
    expect(result).toMatchObject({
      hasMore: false,
      nextCursor: null,
      items: [{ submissionId: "scoped-submission" }],
    });
  });

  it("does not query or return pagination metadata for an empty class scope", async () => {
    let queryCount = 0;
    const prisma = {
      submission: {
        findMany: () => {
          queryCount += 1;
          return Promise.resolve([]);
        },
      },
      feedback: { findMany: () => Promise.resolve([]) },
    };
    const repository = new PrismaFeedbackRepository(
      prisma as unknown as PrismaService,
    );

    const result = await repository.findPendingBySchool(schoolId, {
      limit: 1,
      authorizedClassIds: [],
    });

    expect(queryCount).toBe(0);
    expect(result).toEqual({ items: [], nextCursor: null, hasMore: false });
  });
});
