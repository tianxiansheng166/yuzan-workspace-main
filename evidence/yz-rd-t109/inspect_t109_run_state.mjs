import { createRequire } from "node:module";

const requireApi = createRequire(new URL("../../backend/api/package.json", import.meta.url));
const { PrismaClient } = requireApi("@yuzan/database");
const { PrismaPg } = requireApi("@prisma/adapter-pg");
const { Pool } = requireApi("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const prefix = (value) => typeof value === "string" ? value.slice(0, 8) : null;

try {
  const school = await prisma.school.findUnique({ where: { code: "default-school" }, select: { id: true } });
  const student = await prisma.user.findUnique({ where: { loginIdentifier: process.env.T109_STUDENT_IDENTIFIER }, select: { id: true } });
  const enrollment = school && student ? await prisma.enrollment.findFirst({
    where: { schoolId: school.id, userId: student.id, status: "ACTIVE" },
    select: { id: true },
  }) : null;
  const course = school ? await prisma.course.findFirst({
    where: { schoolId: school.id, stableKey: "t109-course-video-acceptance" },
    include: { versions: { where: { version: 1 }, include: { units: { include: { lessons: { include: { activities: true } } } } } } },
  }) : null;
  const activities = course?.versions?.[0]?.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities)) || [];
  const activityIds = activities.map((activity) => activity.id);
  const progress = enrollment && activityIds.length ? await prisma.activityProgress.findMany({
    where: { enrollmentId: enrollment.id, activityId: { in: activityIds } },
    select: { activityId: true, position: true, completed: true, revision: true, updatedAt: true },
  }) : [];
  const submissions = enrollment && course?.versions?.[0] ? await prisma.submission.findMany({
    where: { enrollmentId: enrollment.id, assignment: { courseVersionId: course.versions[0].id } },
    orderBy: { createdAt: "asc" },
    select: { id: true, status: true, attemptNo: true, submittedAt: true },
  }) : [];
  const attempts = submissions.length && activityIds.length ? await prisma.activityAttempt.findMany({
    where: { schoolId: school.id, submissionId: { in: submissions.map((submission) => submission.id) }, activityId: { in: activityIds } },
    select: { id: true, activityId: true, kind: true, value: true, autoResult: true },
  }) : [];
  const practice = school ? await prisma.practiceDefinition.findFirst({ where: { schoolId: school.id, title: "T109 情境问候练习" }, select: { id: true } }) : null;
  const sessions = enrollment && practice ? await prisma.assessmentSession.findMany({
    where: { enrollmentId: enrollment.id, practiceDefinitionId: practice.id },
    orderBy: { createdAt: "asc" },
    include: { report: true, items: { select: { id: true, maxScore: true, scoredScore: true, recordingId: true, status: true, autoResult: true, questionVersionId: true } } },
  }) : [];
  const questionVersions = [...new Set(sessions.flatMap((session) => session.items.map((item) => item.questionVersionId).filter(Boolean)))];
  const versionRows = questionVersions.length ? await prisma.questionBankItemVersion.findMany({
    where: { id: { in: questionVersions } },
    select: { id: true, status: true, scoringSpec: true },
  }) : [];
  const recordings = enrollment ? await prisma.recording.count({ where: { enrollmentId: enrollment.id } }) : 0;
  process.stdout.write(`${JSON.stringify({
    taskId: "YZ-RD-T109",
    sourceT108Sha: "8974c2a7d5842bb20dbfcd091b63cac5674dcc32",
    schoolIdPrefix: prefix(school?.id),
    studentIdPrefix: prefix(student?.id),
    enrollmentIdPrefix: prefix(enrollment?.id),
    activities: activities.map((activity) => ({ idPrefix: prefix(activity.id), type: activity.type, title: activity.title })),
    progress: progress.map((row) => ({ activityIdPrefix: prefix(row.activityId), position: row.position, completed: row.completed, revision: row.revision, updatedAt: row.updatedAt })),
    submissions: submissions.map((row) => ({ idPrefix: prefix(row.id), status: row.status, attemptNo: row.attemptNo, submitted: Boolean(row.submittedAt) })),
    activityAttemptCount: attempts.length,
    activityAttempts: attempts.map((row) => ({ idPrefix: prefix(row.id), activityIdPrefix: prefix(row.activityId), kind: row.kind, value: row.value && typeof row.value === "object" ? { position: row.value.position, completed: row.value.completed } : null })),
    assessmentSessions: sessions.map((row) => ({ sessionIdPrefix: prefix(row.id), status: row.status, courseActivityLinked: Boolean(row.courseActivityId), courseSubmissionLinked: Boolean(row.courseSubmissionId), reportOverallScore: row.report?.overallScore ?? null, reportSummary: row.report?.summary ?? null, itemCount: row.items.length, items: row.items.map((item) => ({ idPrefix: prefix(item.id), status: item.status, maxScore: item.maxScore, scoredScore: item.scoredScore, recordingIdPresent: item.recordingId != null, autoResult: item.autoResult && typeof item.autoResult === "object" ? { state: item.autoResult.state, score: item.autoResult.score, reasonCode: item.autoResult.reasonCode } : null, questionVersionIdPrefix: prefix(item.questionVersionId) })) })),
    questionVersions: versionRows.map((row) => ({ idPrefix: prefix(row.id), status: row.status, strategy: row.scoringSpec && typeof row.scoringSpec === "object" ? row.scoringSpec.strategy : null, maxScore: row.scoringSpec && typeof row.scoringSpec === "object" ? row.scoringSpec.maxScore : null })),
    recordingRows: recordings,
  })}\n`);
} finally {
  await prisma.$disconnect();
  await pool.end();
}
