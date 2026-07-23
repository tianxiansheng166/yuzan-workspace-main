import { createRequire } from 'node:module';
import { PrismaClient } from '../../infra/database/dist/src/index.js';

const require = createRequire(new URL('../../infra/database/package.json', import.meta.url));
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const identifier = process.env.YUZAN_E2E_STUDENT_IDENTIFIER;
const runtime = process.env.NODE_ENV || 'development';
const databaseUrl = process.env.DATABASE_URL;

if (!['development', 'test'].includes(runtime)) {
  throw new Error('Course-practice fixture reset is restricted to development/test');
}
if (!identifier) {
  throw new Error('YUZAN_E2E_STUDENT_IDENTIFIER is required');
}
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  const user = await prisma.user.findUnique({
    where: { loginIdentifier: identifier },
    select: { id: true },
  });
  if (!user) throw new Error('E2E student was not found');

  const enrollment = await prisma.enrollment.findFirst({
    where: { userId: user.id, role: 'STUDENT', status: 'ACTIVE' },
    select: { id: true, schoolId: true },
  });
  if (!enrollment) throw new Error('Active student enrollment was not found');

  const assignment = await prisma.assignment.findFirst({
    where: {
      schoolId: enrollment.schoolId,
      source: 'TEACHER_ASSIGNED',
      courseVersion: { capabilityTheme: '古诗文' },
    },
    orderBy: { id: 'asc' },
    select: { id: true, courseVersionId: true },
  });
  if (!assignment) {
    throw new Error('Teacher-assigned classical-Chinese course was not found');
  }

  const activities = await prisma.learningActivity.findMany({
    where: {
      lesson: {
        unit: {
          courseVersionId: assignment.courseVersionId,
        },
      },
    },
    select: { id: true },
  });
  const activityIds = activities.map((activity) => activity.id);

  const [progress, submissions] = await prisma.$transaction([
    prisma.activityProgress.deleteMany({
      where: {
        enrollmentId: enrollment.id,
        activityId: { in: activityIds },
      },
    }),
    prisma.submission.deleteMany({
      where: {
        assignmentId: assignment.id,
        enrollmentId: enrollment.id,
      },
    }),
  ]);

  console.log(JSON.stringify({
    status: 'RESET',
    removedProgressRows: progress.count,
    removedSubmissionRows: submissions.count,
  }));
} finally {
  await prisma.$disconnect();
  await pool.end();
}
