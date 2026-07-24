const { PrismaClient } = require('../../packages/database/generated/client');
const prisma = new PrismaClient();

async function main() {
  // Find student.test user and their enrollments
  const user = await prisma.user.findFirst({
    where: { identifier: 'student.test' },
    select: { id: true, identifier: true }
  });
  console.log('User:', JSON.stringify(user));

  if (!user) {
    console.log('No student.test user found');
    return;
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id },
    select: { id: true, schoolId: true, assignmentId: true }
  });
  console.log('Enrollments:', JSON.stringify(enrollments, null, 2));

  const enrollmentIds = enrollments.map(e => e.id);

  // Get activity progress
  const progress = await prisma.activityProgress.findMany({
    where: { enrollmentId: { in: enrollmentIds } },
    select: { id: true, completed: true, activityId: true, enrollmentId: true }
  });
  console.log('Activity Progress:', JSON.stringify(progress, null, 2));

  // Get submissions
  const submissions = await prisma.submission.findMany({
    where: { enrollmentId: { in: enrollmentIds } },
    select: { id: true, status: true, assignmentId: true, enrollmentId: true, revision: true }
  });
  console.log('Submissions:', JSON.stringify(submissions, null, 2));

  // Get activity attempts
  const attempts = await prisma.activityAttempt.findMany({
    where: { enrollmentId: { in: enrollmentIds } },
    select: { id: true, activityId: true, enrollmentId: true, completed: true }
  });
  console.log('Activity Attempts:', JSON.stringify(attempts, null, 2));

  // Get recordings
  const recordings = await prisma.recording.findMany({
    where: { enrollmentId: { in: enrollmentIds } },
    select: { id: true, objectKey: true, bytes: true, durationMs: true, activityAttemptId: true }
  });
  console.log('Recordings:', JSON.stringify(recordings, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
