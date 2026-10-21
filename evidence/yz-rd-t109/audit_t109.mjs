import { createRequire } from "node:module";
import { PrismaClient } from "@yuzan/database";

const requireApi = createRequire(new URL("../../backend/api/package.json", import.meta.url));
const { PrismaPg } = requireApi("@prisma/adapter-pg");
const { Pool } = requireApi("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function prefix(value) {
  return typeof value === "string" ? value.slice(0, 8) : null;
}

function progressSummary(value) {
  if (!value) return null;
  return {
    activityIdPrefix: prefix(value.activityId),
    position: value.position,
    completed: value.completed,
    revision: value.revision,
  };
}

try {
  const school = await prisma.school.findUnique({ where: { code: "default-school" } });
  if (!school) throw new Error("T109 isolated school is missing");
  const student = await prisma.user.findUnique({ where: { loginIdentifier: process.env.T109_STUDENT_IDENTIFIER } });
  if (!student) throw new Error("T109 isolated student is missing");
  const enrollment = await prisma.enrollment.findFirst({ where: { schoolId: school.id, userId: student.id, role: "STUDENT", status: "ACTIVE" } });
  if (!enrollment) throw new Error("T109 active student enrollment is missing");

  const course = await prisma.course.findUnique({ where: { schoolId_stableKey: { schoolId: school.id, stableKey: "t109-course-video-acceptance" } } });
  const recommendationCourse = await prisma.course.findUnique({ where: { schoolId_stableKey: { schoolId: school.id, stableKey: "t109-course-recommendation" } } });
  if (!course || !recommendationCourse) throw new Error("T109 course records are missing");
  const assignments = await prisma.assignment.findMany({
    where: { schoolId: school.id, courseVersion: { courseId: course.id } },
    select: { id: true, courseVersionId: true },
  });
  const recommendationAssignment = await prisma.assignment.findFirst({
    where: { schoolId: school.id, courseVersion: { courseId: recommendationCourse.id } },
    select: { id: true },
  });
  const activities = await prisma.learningActivity.findMany({
    where: { lesson: { unit: { courseVersion: { courseId: course.id } } } },
    select: { id: true, type: true, title: true, coursePractice: { select: { practiceDefinitionId: true } } },
    orderBy: { sortOrder: "asc" },
  });
  const videoActivity = activities.find((activity) => activity.type === "VIDEO");
  const practiceActivity = activities.find((activity) => activity.coursePractice !== null);
  if (!videoActivity || !practiceActivity) throw new Error("T109 course activities are incomplete");

  const progressRows = await prisma.activityProgress.findMany({
    where: { schoolId: school.id, enrollmentId: enrollment.id, activityId: { in: [videoActivity.id, practiceActivity.id] } },
    select: { activityId: true, position: true, completed: true, revision: true },
  });
  const submission = await prisma.submission.findFirst({
    where: { schoolId: school.id, assignmentId: assignments[0]?.id, enrollmentId: enrollment.id, deletedAt: null },
    select: { id: true, status: true, revision: true },
  });
  const attempt = await prisma.assessmentSession.findFirst({
    where: { schoolId: school.id, enrollmentId: enrollment.id, courseActivityId: practiceActivity.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, purpose: true, courseActivityId: true, courseSubmissionId: true, deliveryId: true },
  });
  if (!attempt) throw new Error("T109 course practice attempt is missing");
  const report = await prisma.assessmentReport.findUnique({ where: { sessionId: attempt.id } });
  const items = await prisma.assessmentItem.findMany({
    where: { sessionId: attempt.id },
    select: { id: true, maxScore: true, scoredScore: true, autoResult: true, recordingId: true, questionVersionId: true },
    orderBy: { sortOrder: "asc" },
  });
  const answerRows = await prisma.writtenAnswer.count({ where: { item: { sessionId: attempt.id } } });
  const schoolCounts = await Promise.all([
    prisma.school.count(),
    prisma.user.count(),
    prisma.membership.count({ where: { schoolId: school.id, role: "STUDENT", status: "ACTIVE" } }),
    prisma.membership.count({ where: { schoolId: school.id, role: "TEACHER", status: "ACTIVE" } }),
    prisma.enrollment.count({ where: { schoolId: school.id, role: "STUDENT", status: "ACTIVE" } }),
    prisma.course.count({ where: { schoolId: school.id } }),
    prisma.assignment.count({ where: { schoolId: school.id } }),
    prisma.resource.count({ where: { schoolId: school.id } }),
    prisma.practiceDefinition.count({ where: { schoolId: school.id } }),
    prisma.questionBankItem.count({ where: { schoolId: school.id } }),
    prisma.assessmentSession.count({ where: { schoolId: school.id } }),
    prisma.assessmentReport.count({ where: { schoolId: school.id } }),
    prisma.recording.count({ where: { schoolId: school.id } }),
  ]);

  const firstItem = items[0] ?? null;
  const autoResult = firstItem?.autoResult && typeof firstItem.autoResult === "object" ? firstItem.autoResult : null;
  const result = {
    taskId: "YZ-RD-T109",
    sourceSha: "8974c2a7d5842bb20dbfcd091b63cac5674dcc32",
    runtimeProject: "yz-rd-t109",
    database: "yz_rd_t109",
    schoolIdPrefix: prefix(school.id),
    studentIdPrefix: prefix(student.id),
    enrollmentIdPrefix: prefix(enrollment.id),
    courseAssignmentIdPrefix: prefix(assignments[0]?.id),
    recommendationAssignmentIdPrefix: prefix(recommendationAssignment?.id),
    videoActivityIdPrefix: prefix(videoActivity.id),
    practiceActivityIdPrefix: prefix(practiceActivity.id),
    submission: submission ? { idPrefix: prefix(submission.id), status: submission.status, revision: submission.revision } : null,
    progress: {
      video: progressSummary(progressRows.find((row) => row.activityId === videoActivity.id)),
      practice: progressSummary(progressRows.find((row) => row.activityId === practiceActivity.id)),
    },
    unansweredPractice: {
      attemptIdPrefix: prefix(attempt.id),
      status: attempt.status,
      purpose: attempt.purpose,
      hasCourseActivityBinding: attempt.courseActivityId === practiceActivity.id && Boolean(attempt.courseSubmissionId),
      reportPresent: Boolean(report),
      reportStatus: attempt.status,
      reportSummary: report && report.summary && typeof report.summary === "object" ? {
        totalItems: report.summary.totalItems,
        answeredItems: report.summary.answeredItems,
        unansweredItems: report.summary.unansweredItems,
      } : null,
      overallScore: report?.overallScore ?? null,
      itemCount: items.length,
      maxScore: firstItem?.maxScore ?? null,
      scoredScore: firstItem?.scoredScore ?? null,
      reasonCode: autoResult?.reasonCode ?? null,
      writtenAnswerRows: answerRows,
      recordingIds: items.filter((item) => item.recordingId).length,
      questionVersionBound: items.every((item) => Boolean(item.questionVersionId)),
    },
    isolatedDataCounts: {
      schools: schoolCounts[0],
      users: schoolCounts[1],
      activeStudentMemberships: schoolCounts[2],
      activeTeacherMemberships: schoolCounts[3],
      activeStudentEnrollments: schoolCounts[4],
      courses: schoolCounts[5],
      assignments: schoolCounts[6],
      scopedResources: schoolCounts[7],
      practices: schoolCounts[8],
      syntheticT109QuestionBankItems: schoolCounts[9],
      assessmentSessions: schoolCounts[10],
      assessmentReports: schoolCounts[11],
      recordings: schoolCounts[12],
    },
  };

  const passed = attempt.status === "COMPLETED"
    && Boolean(report)
    && report.overallScore === 0
    && report.summary?.unansweredItems === 1
    && firstItem?.maxScore === 5
    && firstItem?.scoredScore === 0
    && autoResult?.reasonCode === "UNANSWERED"
    && answerRows === 0
    && items.every((item) => item.recordingId === null)
    && schoolCounts[0] === 1
    && schoolCounts[2] === 1
    && schoolCounts[3] === 0
    && schoolCounts[4] === 1
    && schoolCounts[5] === 2
    && schoolCounts[6] === 2
    && schoolCounts[7] === 1
    && schoolCounts[8] === 1
    && schoolCounts[9] === 1
    && schoolCounts[12] === 0;
  result.status = passed ? "PASS" : "FAIL";
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!passed) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
  await pool.end();
}
