const { PrismaClient } = require('../../packages/database/generated/client');
const prisma = new PrismaClient();

async function main() {
  // Find student.test user
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

  // Delete recordings first (depends on activity attempts)
  const delRecordings = await prisma.recording.deleteMany({
    where: { enrollmentId: { in: enrollmentIds } }
  });
  console.log('Deleted recordings:', delRecordings.count);

  // Delete activity attempts
  const delAttempts = await prisma.activityAttempt.deleteMany({
    where: { enrollmentId: { in: enrollmentIds } }
  });
  console.log('Deleted activity attempts:', delAttempts.count);

  // Delete activity progress
  const delProgress = await prisma.activityProgress.deleteMany({
    where: { enrollmentId: { in: enrollmentIds } }
  });
  console.log('Deleted activity progress:', delProgress.count);

  // Delete submissions
  const delSubmissions = await prisma.submission.deleteMany({
    where: { enrollmentId: { in: enrollmentIds } }
  });
  console.log('Deleted submissions:', delSubmissions.count);

  // Delete student activity notes
  const delNotes = await prisma.studentActivityNote.deleteMany({
    where: { enrollmentId: { in: enrollmentIds } }
  });
  console.log('Deleted notes:', delNotes.count);

  console.log('Reset complete! Student can now start fresh.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
