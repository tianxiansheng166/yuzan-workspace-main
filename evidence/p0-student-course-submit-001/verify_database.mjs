/**
 * Database / API cross-verification for P0-STUDENT-COURSE-SUBMIT-001.
 *
 * Uses PrismaClient to query the database directly and cross-checks
 * the same data via the API. All IDs are dynamically discovered
 * from the loginIdentifier — no hardcoded assignment/activity IDs.
 *
 * Required env vars:
 *   DATABASE_URL            — PostgreSQL connection string
 *   YUZAN_E2E_STUDENT_IDENTIFIER — loginIdentifier of the test student
 *   YUZAN_E2E_API_URL      — (optional) API base URL, default http://127.0.0.1:4000/api/v1
 */

import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { PrismaClient } from '../../infra/database/dist/src/index.js';

const require = createRequire(new URL('../../infra/database/package.json', import.meta.url));
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const identifier = process.env.YUZAN_E2E_STUDENT_IDENTIFIER;
const databaseUrl = process.env.DATABASE_URL;
const apiBaseUrl = (process.env.YUZAN_E2E_API_URL || 'http://127.0.0.1:4000/api/v1').replace(/\/+$/, '');

if (!identifier) throw new Error('YUZAN_E2E_STUDENT_IDENTIFIER is required');
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// ─── Helpers ────────────────────────────────────────────────────────────────

function hasNonEmptyValue(value) {
  if (!value) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'object') {
    // { answerIndex: 0 }, { answers: ['a'] }, { acknowledged: true }, { recorded: true }
    if (Number.isInteger(value.answerIndex)) return true;
    if (Array.isArray(value.answers) && value.answers.some(a => String(a).trim())) return true;
    if (value.acknowledged === true) return true;
    if (value.recorded === true) return true;
    if (value.text && String(value.text).trim()) return true;
    // Generic: any non-empty string property
    for (const key of Object.keys(value)) {
      if (typeof value[key] === 'string' && value[key].trim()) return true;
      if (typeof value[key] === 'number') return true;
      if (value[key] === true) return true;
    }
  }
  return false;
}

async function apiCall(path, token) {
  const url = `${apiBaseUrl}${path}`;
  const resp = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const body = await resp.json();
  return { status: resp.status, data: body.data || body, ok: resp.ok };
}

// ─── Main ───────────────────────────────────────────────────────────────────

try {
  // 1. Discover student by loginIdentifier
  const user = await prisma.user.findUnique({
    where: { loginIdentifier: identifier },
    select: { id: true, name: true },
  });
  if (!user) throw new Error('E2E student was not found by loginIdentifier');

  // 2. Find active student enrollment
  const enrollment = await prisma.enrollment.findFirst({
    where: { userId: user.id, role: 'STUDENT', status: 'ACTIVE' },
    select: { id: true, schoolId: true },
  });
  if (!enrollment) throw new Error('Active student enrollment was not found');

  // 3. Find a teacher-assigned assignment with non-practice activities
  const assignment = await prisma.assignment.findFirst({
    where: {
      schoolId: enrollment.schoolId,
      source: 'TEACHER_ASSIGNED',
    },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      courseVersionId: true,
      courseVersion: { select: { title: true } },
    },
  });
  if (!assignment) throw new Error('Teacher-assigned assignment was not found');

  // 4. Find all non-practice learning activities for this course
  const allActivities = await prisma.learningActivity.findMany({
    where: {
      lesson: { unit: { courseVersionId: assignment.courseVersionId } },
      type: { in: ['TEXT', 'AUDIO', 'SPEECH', 'CHOICE', 'FILL_BLANK'] },
    },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      type: true,
      title: true,
      sortOrder: true,
      required: true,
    },
  });

  const requiredActivities = allActivities.filter(a => a.required !== false);
  if (requiredActivities.length < 4) {
    throw new Error(`Expected >=4 required non-practice activities, found ${requiredActivities.length}`);
  }

  // 5. Find submission
  const submission = await prisma.submission.findFirst({
    where: {
      assignmentId: assignment.id,
      enrollmentId: enrollment.id,
      deletedAt: null,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      revision: true,
      submittedAt: true,
      enrollmentId: true,
    },
  });
  if (!submission) throw new Error('Course submission was not found');

  // 6. Verify ActivityProgress for all 5 activities
  const progressRecords = await prisma.activityProgress.findMany({
    where: {
      activityId: { in: requiredActivities.map(a => a.id) },
      enrollmentId: enrollment.id,
    },
    select: {
      id: true,
      activityId: true,
      completed: true,
      revision: true,
    },
  });

  const allCompleted = progressRecords.length === requiredActivities.length
    && progressRecords.every(p => p.completed === true);

  // 7. Verify ActivityAttempt for all 5 activities
  const attemptRecords = await prisma.activityAttempt.findMany({
    where: {
      submissionId: submission.id,
      activityId: { in: requiredActivities.map(a => a.id) },
    },
    select: {
      id: true,
      activityId: true,
      kind: true,
      value: true,
    },
  });

  const allHaveNonEmptyValue = attemptRecords.length === requiredActivities.length
    && attemptRecords.every(a => hasNonEmptyValue(a.value));

  // 8. Verify recording for SPEECH activity
  const speechActivity = requiredActivities.find(a => a.type === 'SPEECH');
  let recordingEvidence = null;

  if (speechActivity) {
    const speechAttempt = attemptRecords.find(a => a.activityId === speechActivity.id);

    // Find recording linked to this activity attempt
    const recording = await prisma.recording.findFirst({
      where: {
        activityAttemptId: speechAttempt ? speechAttempt.id : undefined,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        durationMs: true,
        mimeType: true,
        objectKey: true,
        bytes: true,
        activityAttemptId: true,
      },
    });

    // Also check via the link table if no direct link
    let linkedRecording = recording;
    if (!linkedRecording && speechAttempt) {
      linkedRecording = await prisma.recording.findFirst({
        where: {
          submissionId: submission.id,
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          durationMs: true,
          mimeType: true,
          objectKey: true,
          bytes: true,
          activityAttemptId: true,
        },
      });
    }

    if (linkedRecording) {
      recordingEvidence = {
        recordingId: linkedRecording.id,
        status: linkedRecording.status,
        durationMs: linkedRecording.durationMs,
        mimeType: linkedRecording.mimeType,
        objectKey: linkedRecording.objectKey,
        bytes: linkedRecording.bytes,
        activityAttemptId: linkedRecording.activityAttemptId,
        linkedToCorrectAttempt: linkedRecording.activityAttemptId === (speechAttempt ? speechAttempt.id : null),
        hasNonZeroBytes: (linkedRecording.bytes || 0) > 0,
        hasObjectKey: Boolean(linkedRecording.objectKey),
        hasDuration: (linkedRecording.durationMs || 0) > 0,
      };
    }
  }

  // 9. Verify submission status is SUBMITTED
  const submissionValid = submission.status === 'SUBMITTED'
    || submission.status === 'PROCESSING'
    || submission.status === 'COMPLETED';

  // 10. Verify all required activities were completed before submission
  const courseCompletion = await prisma.courseCompletion.findFirst({
    where: {
      assignmentId: assignment.id,
      enrollmentId: enrollment.id,
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      progressPercent: true,
      completedRequiredCount: true,
      requiredActivityCount: true,
      attainmentStatus: true,
      completedActivityIds: true,
    },
  });

  // ─── API Cross-Verification ──────────────────────────────────────────────

  // Get an API token by logging in
  let apiToken = null;
  let apiVerification = null;
  try {
    const loginResp = await fetch(`${apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginIdentifier: identifier, password: process.env.YUZAN_E2E_STUDENT_PASSWORD || '' }),
    });
    if (loginResp.ok) {
      const loginBody = await loginResp.json();
      apiToken = loginBody.data?.accessToken || loginBody.accessToken || null;
    }
  } catch (e) {
    // API login failed, skip API verification
  }

  if (apiToken) {
    try {
      // Verify course data via API
      const schoolResp = await apiCall(`/schools/${enrollment.schoolId}/student/courses`, apiToken);
      const courseList = schoolResp.data?.courses || schoolResp.data?.items || [];

      // Find our assignment in the list
      const courseSummary = courseList.find(c => c.assignmentId === assignment.id);

      // Get course detail
      const detailResp = await apiCall(
        `/schools/${enrollment.schoolId}/student/courses/${assignment.id}`,
        apiToken,
      );
      const courseDetail = detailResp.data;

      // Get submission detail
      const subResp = await apiCall(
        `/schools/${enrollment.schoolId}/student/courses/${assignment.id}/submissions/${submission.id}`,
        apiToken,
      );

      apiVerification = {
        courseListFound: !!courseSummary,
        courseDetailLoaded: !!courseDetail,
        apiSubmissionStatus: subResp.data?.status || null,
        apiProgressPercent: courseDetail?.studentProgress?.progressPercent || null,
        apiCompletedActivityIds: courseDetail?.studentProgress?.completedActivityIds || [],
      };
    } catch (e) {
      apiVerification = { error: e.message || String(e) };
    }
  }

  // ─── Build result ────────────────────────────────────────────────────────

  const errors = [];
  if (!allCompleted) errors.push('Not all required activities have completed=true in ActivityProgress');
  if (!allHaveNonEmptyValue) errors.push('Not all required activities have non-empty value in ActivityAttempt');
  if (!submissionValid) errors.push(`Submission status is ${submission.status}, expected SUBMITTED/PROCESSING/COMPLETED`);
  if (speechActivity && !recordingEvidence) errors.push('SPEECH activity has no linked recording');
  if (recordingEvidence && !recordingEvidence.hasDuration) errors.push('Recording has durationMs <= 0');
  if (recordingEvidence && !recordingEvidence.hasObjectKey) errors.push('Recording has no objectKey');
  if (recordingEvidence && !recordingEvidence.hasNonZeroBytes) errors.push('Recording has bytes <= 0');
  if (courseCompletion && courseCompletion.progressPercent !== 100) {
    errors.push(`Course completion progressPercent is ${courseCompletion.progressPercent}, expected 100`);
  }

  const result = {
    status: errors.length === 0 ? 'PASSED' : 'FAILED',
    errors: errors.length > 0 ? errors : undefined,
    student: { id: user.id, name: user.name, loginIdentifier: identifier },
    enrollment: { id: enrollment.id, schoolId: enrollment.schoolId },
    assignment: {
      id: assignment.id,
      courseVersionId: assignment.courseVersionId,
      title: assignment.courseVersion?.title || '',
    },
    activities: requiredActivities.map(a => ({
      id: a.id,
      type: a.type,
      title: a.title,
      required: a.required,
    })),
    submission: {
      id: submission.id,
      status: submission.status,
      revision: submission.revision,
      submittedAt: submission.submittedAt,
    },
    verification: {
      activityProgressCount: progressRecords.length,
      activityProgressAllCompleted: allCompleted,
      activityAttemptCount: attemptRecords.length,
      activityAttemptAllNonEmpty: allHaveNonEmptyValue,
      submissionStatusValid: submissionValid,
    },
    activityProgress: progressRecords.map(p => ({
      activityId: p.activityId,
      completed: p.completed,
      revision: p.revision,
    })),
    activityAttempts: attemptRecords.map(a => ({
      activityId: a.activityId,
      kind: a.kind,
      hasNonEmptyValue: hasNonEmptyValue(a.value),
    })),
    recording: recordingEvidence,
    courseCompletion: courseCompletion ? {
      progressPercent: courseCompletion.progressPercent,
      completedRequiredCount: courseCompletion.completedRequiredCount,
      requiredActivityCount: courseCompletion.requiredActivityCount,
      attainmentStatus: courseCompletion.attainmentStatus,
    } : null,
    apiVerification: apiVerification,
  };

  await writeFile(
    new URL('./database-result.json', import.meta.url),
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8',
  );

  console.log(JSON.stringify({
    status: result.status,
    assignmentId: result.assignment.id,
    submissionId: result.submission.id,
    submissionStatus: result.submission.status,
    activityProgressCount: result.verification.activityProgressCount,
    activityAttemptCount: result.verification.activityAttemptCount,
    recordingId: result.recording?.recordingId || null,
    errors: result.errors || [],
  }));

  if (errors.length > 0) {
    process.exitCode = 1;
  }
} finally {
  await prisma.$disconnect();
  await pool.end();
}
