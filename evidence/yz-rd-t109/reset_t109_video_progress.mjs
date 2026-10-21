import { createRequire } from "node:module";

const requireApi = createRequire(new URL("../../backend/api/package.json", import.meta.url));
const { PrismaClient } = requireApi("@yuzan/database");
const { PrismaPg } = requireApi("@prisma/adapter-pg");
const { Pool } = requireApi("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const prefix = (value) => typeof value === "string" ? value.slice(0, 8) : null;

try {
  const school = await prisma.school.findUnique({ where: { code: "default-school" } });
  const student = await prisma.user.findUnique({ where: { loginIdentifier: process.env.T109_STUDENT_IDENTIFIER } });
  if (!school || !student) throw new Error("T109-only school or student was not found");
  const enrollment = await prisma.enrollment.findFirst({
    where: { schoolId: school.id, userId: student.id, status: "ACTIVE" },
  });
  const course = await prisma.course.findFirst({
    where: { schoolId: school.id, stableKey: "t109-course-video-acceptance" },
    include: { versions: { where: { version: 1 }, include: { units: { include: { lessons: { include: { activities: true } } } } } } },
  });
  if (!enrollment || !course || course.versions.length !== 1) throw new Error("T109-only enrollment or course version was not found");
  const activities = course.versions[0].units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities));
  const video = activities.find((activity) => activity.type === "VIDEO" && activity.title === "观察花朵生长短片");
  if (!video) throw new Error("T109-owned video activity was not found");

  const submissions = await prisma.submission.findMany({
    where: { schoolId: school.id, assignment: { courseVersionId: course.versions[0].id }, enrollmentId: enrollment.id },
    select: { id: true },
  });
  const recordings = await prisma.recording.count({ where: { schoolId: school.id, enrollmentId: enrollment.id } });
  if (recordings !== 0) throw new Error("T109 test enrollment unexpectedly has recording rows; refusing to reset");

  const before = await prisma.activityProgress.findUnique({
    where: { activityId_enrollmentId: { activityId: video.id, enrollmentId: enrollment.id } },
    select: { position: true, completed: true, revision: true },
  });
  const reset = await prisma.$transaction(async (tx) => {
    const deletedAttempts = await tx.activityAttempt.deleteMany({
      where: { schoolId: school.id, activityId: video.id, submissionId: { in: submissions.map((row) => row.id) } },
    });
    const after = await tx.activityProgress.upsert({
      where: { activityId_enrollmentId: { activityId: video.id, enrollmentId: enrollment.id } },
      create: { schoolId: school.id, activityId: video.id, enrollmentId: enrollment.id, position: 0, completed: false, revision: 1 },
      update: { position: 0, completed: false, revision: 1 },
      select: { position: true, completed: true, revision: true },
    });
    return { deletedAttempts, after };
  });

  process.stdout.write(`${JSON.stringify({
    taskId: "YZ-RD-T109",
    status: "PASS",
    scope: "only T109 test enrollment and video activity",
    courseStableKey: course.stableKey,
    activityIdPrefix: prefix(video.id),
    enrollmentIdPrefix: prefix(enrollment.id),
    priorProgress: before,
    resetProgress: reset.after,
    deletedT109VideoAttempts: reset.deletedAttempts.count,
    recordingsTouched: false,
    recordingRows: recordings,
    otherStudentsOrCoursesTouched: false,
  })}\n`);
} finally {
  await prisma.$disconnect();
  await pool.end();
}
