import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { PrismaClient } from '../../infra/database/dist/src/index.js';

const require = createRequire(new URL('../../infra/database/package.json', import.meta.url));
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const identifier = process.env.YUZAN_E2E_STUDENT_IDENTIFIER;
const databaseUrl = process.env.DATABASE_URL;

if (!identifier) throw new Error('YUZAN_E2E_STUDENT_IDENTIFIER is required');
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function hasNonEmptyAnswer(answer) {
  if (!answer?.content || !answer.finalSubmittedAt) return false;
  const content = answer.content;
  return Number.isInteger(content.optionIndex)
    || Boolean(String(content.text || '').trim());
}

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
  if (!assignment) throw new Error('Target assignment was not found');

  const activity = await prisma.learningActivity.findFirst({
    where: {
      lesson: { unit: { courseVersionId: assignment.courseVersionId } },
      coursePractice: { isNot: null },
    },
    select: {
      id: true,
      coursePractice: {
        select: { practiceDefinitionId: true },
      },
    },
  });
  if (!activity?.coursePractice) throw new Error('Course practice activity was not found');

  const submission = await prisma.submission.findFirst({
    where: {
      assignmentId: assignment.id,
      enrollmentId: enrollment.id,
      deletedAt: null,
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, revision: true },
  });
  if (!submission) throw new Error('Course submission was not found');

  const [progress, activityAttempt, session] = await Promise.all([
    prisma.activityProgress.findUnique({
      where: {
        activityId_enrollmentId: {
          activityId: activity.id,
          enrollmentId: enrollment.id,
        },
      },
      select: { completed: true, revision: true },
    }),
    prisma.activityAttempt.findUnique({
      where: {
        submissionId_activityId: {
          submissionId: submission.id,
          activityId: activity.id,
        },
      },
      select: { id: true, kind: true, value: true },
    }),
    prisma.assessmentSession.findFirst({
      where: {
        courseSubmissionId: submission.id,
        courseActivityId: activity.id,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        practiceDefinitionId: true,
        deliveryId: true,
        items: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            itemType: true,
            status: true,
            recording: {
              select: {
                id: true,
                status: true,
                durationMs: true,
                mimeType: true,
                objectKey: true,
              },
            },
            writtenAnswer: {
              select: {
                content: true,
                finalSubmittedAt: true,
              },
            },
          },
        },
      },
    }),
  ]);

  if (!progress?.completed) throw new Error('Course activity progress is not complete');
  if (activityAttempt?.kind !== 'COURSE_PRACTICE') {
    throw new Error('Course activity attempt is missing or has the wrong kind');
  }
  if (!session || !['SUBMITTED', 'PROCESSING', 'COMPLETED'].includes(session.status)) {
    throw new Error('Practice assessment session is not submitted');
  }
  if (session.practiceDefinitionId !== activity.coursePractice.practiceDefinitionId) {
    throw new Error('Practice definition link does not match the course activity');
  }

  const oral = session.items.filter((item) => item.recording);
  const written = session.items.filter((item) => item.writtenAnswer);
  if (!oral.length || oral.some((item) => (
    item.recording.status !== 'COMPLETE'
    || !(item.recording.durationMs > 0)
    || !item.recording.objectKey
  ))) {
    throw new Error('Database recording evidence is incomplete or empty');
  }
  if (!written.length || written.some((item) => !hasNonEmptyAnswer(item.writtenAnswer))) {
    throw new Error('Database written evidence is empty or not finalized');
  }

  const result = {
    status: 'PASSED',
    assignmentId: assignment.id,
    submission,
    activityId: activity.id,
    activityProgress: progress,
    activityAttempt,
    assessmentSession: {
      id: session.id,
      status: session.status,
      practiceDefinitionId: session.practiceDefinitionId,
      deliveryId: session.deliveryId,
    },
    oralItems: oral.map((item) => ({
      itemId: item.id,
      itemStatus: item.status,
      recording: item.recording,
    })),
    writtenItems: written.map((item) => ({
      itemId: item.id,
      itemStatus: item.status,
      hasNonEmptyFinalAnswer: hasNonEmptyAnswer(item.writtenAnswer),
    })),
  };

  await writeFile(
    new URL('./database-result.json', import.meta.url),
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8',
  );
  console.log(JSON.stringify({
    status: result.status,
    assessmentSessionId: result.assessmentSession.id,
    oralItems: result.oralItems.length,
    writtenItems: result.writtenItems.length,
  }));
} finally {
  await prisma.$disconnect();
  await pool.end();
}
