import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

const testDatabaseUrl = process.env.GOV003_TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    "GOV003_TEST_DATABASE_URL is required. Example:\n" +
      "GOV003_TEST_DATABASE_URL=postgresql://yuzan:yuzan_dev_only@localhost:5432/yuzan_gov003_sync_verify?schema=public " +
      "pnpm --filter @yuzan/database test:integration",
  );
}

let databaseName;
try {
  databaseName = new URL(testDatabaseUrl).pathname.replace(/^\//, "");
} catch {
  throw new Error("GOV003_TEST_DATABASE_URL is not a valid URL");
}

const safeMarkers = ["gov003", "test", "verify"];
const hasSafeMarker = safeMarkers.some((marker) =>
  databaseName.toLowerCase().includes(marker),
);
if (!hasSafeMarker) {
  throw new Error(
    `Database name "${databaseName}" must include one of: ${safeMarkers.join(", ")}`,
  );
}

function executeSql(sql) {
  return new Promise((resolve) => {
    const proc = spawn(
      "pnpm",
      [
        "--filter",
        "@yuzan/database",
        "exec",
        "prisma",
        "db",
        "execute",
        "--stdin",
      ],
      {
        cwd: repoRoot,
        env: { ...process.env, DATABASE_URL: testDatabaseUrl },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (data) => {
      stdout += data;
    });
    proc.stderr.on("data", (data) => {
      stderr += data;
    });
    proc.on("close", (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });
    proc.stdin.write(sql);
    proc.stdin.end();
  });
}

async function expectSuccess(sql, message) {
  const { exitCode, stderr } = await executeSql(sql);
  assert.equal(exitCode, 0, `${message}\n${stderr}`);
}

async function expectFailure(sql, message) {
  const { exitCode, stderr } = await executeSql(sql);
  assert.notEqual(exitCode, 0, `Expected failure but succeeded: ${message}`);
  return stderr;
}

async function cleanup() {
  const tables = [
    "SyncOperation",
    "SyncJob",
    "ActivityAttempt",
    "Feedback",
    "Submission",
    "AssignmentTarget",
    "Assignment",
    "LearningActivity",
    "Lesson",
    "Unit",
    "CourseVersion",
    "Course",
    "Device",
    "Enrollment",
    "Class",
    "Term",
    "Membership",
    "User",
    "School",
  ];
  for (const table of tables) {
    await executeSql(`DELETE FROM "${table}" CASCADE;`);
  }
}

function buildSchoolSql(id, code) {
  return `INSERT INTO "School" ("id", "code", "name", "timezone", "isActive", "createdAt", "updatedAt") VALUES ('${id}', '${code}', 'Test School', 'Asia/Shanghai', true, NOW(), NOW());`;
}

function buildUserSql(id, loginIdentifier) {
  return `INSERT INTO "User" ("id", "loginIdentifier", "displayName", "passwordHash", "preferredLocale", "status", "createdAt", "updatedAt") VALUES ('${id}', '${loginIdentifier}', 'Test User', 'hash', 'zh-CN', 'ACTIVE', NOW(), NOW());`;
}

function buildMembershipSql(id, schoolId, userId, role = "STUDENT") {
  return `INSERT INTO "Membership" ("id", "schoolId", "userId", "role", "status", "joinedAt") VALUES ('${id}', '${schoolId}', '${userId}', '${role}', 'ACTIVE', NOW());`;
}

function buildTermSql(id, schoolId, name) {
  return `INSERT INTO "Term" ("id", "schoolId", "name", "startsAt", "endsAt", "isActive", "createdAt") VALUES ('${id}', '${schoolId}', '${name}', NOW(), NOW() + INTERVAL '1 day', false, NOW());`;
}

function buildClassSql(id, schoolId, termId, name) {
  return `INSERT INTO "Class" ("id", "schoolId", "termId", "name", "grade", "createdAt", "updatedAt") VALUES ('${id}', '${schoolId}', '${termId}', '${name}', 'G1', NOW(), NOW());`;
}

function buildEnrollmentSql(id, schoolId, classId, userId, role = "STUDENT") {
  return `INSERT INTO "Enrollment" ("id", "schoolId", "classId", "userId", "role", "status", "joinedAt") VALUES ('${id}', '${schoolId}', '${classId}', '${userId}', '${role}', 'ACTIVE', NOW());`;
}

function buildCourseSql(id, schoolId, authorUserId, stableKey) {
  return `INSERT INTO "Course" ("id", "schoolId", "authorUserId", "stableKey", "title", "createdAt", "updatedAt") VALUES ('${id}', '${schoolId}', '${authorUserId}', '${stableKey}', 'Test Course', NOW(), NOW());`;
}

function buildCourseVersionSql(id, schoolId, courseId) {
  return `INSERT INTO "CourseVersion" ("id", "schoolId", "courseId", "version", "status", "title", "locale", "createdAt", "updatedAt") VALUES ('${id}', '${schoolId}', '${courseId}', 1, 'DRAFT', 'Test Version', 'zh-CN', NOW(), NOW());`;
}

function buildUnitSql(id, courseVersionId) {
  return `INSERT INTO "Unit" ("id", "courseVersionId", "title", "sortOrder") VALUES ('${id}', '${courseVersionId}', 'Test Unit', 1);`;
}

function buildLessonSql(id, unitId) {
  return `INSERT INTO "Lesson" ("id", "unitId", "title", "sortOrder") VALUES ('${id}', '${unitId}', 'Test Lesson', 1);`;
}

function buildLearningActivitySql(id, lessonId) {
  return `INSERT INTO "LearningActivity" ("id", "lessonId", "type", "title", "sortOrder", "required") VALUES ('${id}', '${lessonId}', 'TEXT', 'Test Activity', 1, true);`;
}

function buildAssignmentSql(id, schoolId, courseVersionId, createdByUserId) {
  return `INSERT INTO "Assignment" ("id", "schoolId", "courseVersionId", "createdByUserId", "title", "status", "startsAt", "dueAt", "revision", "createdAt", "updatedAt") VALUES ('${id}', '${schoolId}', '${courseVersionId}', '${createdByUserId}', 'Test Assignment', 'DRAFT', NOW(), NOW() + INTERVAL '1 day', 1, NOW(), NOW());`;
}

function buildDeviceSql(id, schoolId) {
  return `INSERT INTO "Device" ("id", "schoolId", "label", "createdAt") VALUES ('${id}', '${schoolId}', 'Test Device', NOW());`;
}

function buildSyncJobSql(id, schoolId, deviceId, clientOperationId) {
  return `INSERT INTO "SyncJob" ("id", "schoolId", "deviceId", "clientOperationId", "status", "createdAt", "updatedAt") VALUES ('${id}', '${schoolId}', '${deviceId}', '${clientOperationId}', 'QUEUED', NOW(), NOW());`;
}

function buildSyncOperationSql(
  id,
  schoolId,
  deviceId,
  syncJobId,
  actorUserId,
  operationId,
) {
  return `INSERT INTO "SyncOperation" ("id", "schoolId", "deviceId", "syncJobId", "actorUserId", "operationId", "entityType", "entityId", "action", "payloadHash", "status", "createdAt") VALUES ('${id}', '${schoolId}', '${deviceId}', '${syncJobId}', '${actorUserId}', '${operationId}', 'SUBMISSION', '${randomUUID()}', 'CREATE', 'hash', 'QUEUED', NOW());`;
}

function buildSubmissionSql(
  id,
  schoolId,
  assignmentId,
  enrollmentId,
  attemptNo,
  idempotencyKey,
) {
  return `INSERT INTO "Submission" ("id", "schoolId", "assignmentId", "enrollmentId", "attemptNo", "status", "idempotencyKey", "revision", "createdAt", "updatedAt") VALUES ('${id}', '${schoolId}', '${assignmentId}', '${enrollmentId}', ${attemptNo}, 'IN_PROGRESS', '${idempotencyKey}', 1, NOW(), NOW());`;
}

function buildAssignmentTargetSql(
  id,
  schoolId,
  assignmentId,
  targetType,
  classId,
  enrollmentId,
) {
  const classIdValue = classId ? `'${classId}'` : "NULL";
  const enrollmentIdValue = enrollmentId ? `'${enrollmentId}'` : "NULL";
  return `INSERT INTO "AssignmentTarget" ("id", "schoolId", "assignmentId", "targetType", "classId", "enrollmentId", "createdAt") VALUES ('${id}', '${schoolId}', '${assignmentId}', '${targetType}', ${classIdValue}, ${enrollmentIdValue}, NOW());`;
}

describe("GOV-003 database behavior", () => {
  before(cleanup);

  describe("SyncJob / SyncOperation relation", () => {
    it("creates a valid SyncJob", async () => {
      const schoolId = randomUUID();
      const userId = randomUUID();
      const membershipId = randomUUID();
      const deviceId = randomUUID();
      const jobId = randomUUID();
      await expectSuccess(
        [
          buildSchoolSql(schoolId, `school-${randomUUID()}`),
          buildUserSql(userId, `user-${randomUUID()}`),
          buildMembershipSql(membershipId, schoolId, userId, "STUDENT"),
          buildDeviceSql(deviceId, schoolId),
          buildSyncJobSql(jobId, schoolId, deviceId, randomUUID()),
        ].join("\n"),
        "valid SyncJob should be created",
      );
    });

    it("creates two SyncOperations under the same SyncJob", async () => {
      const schoolId = randomUUID();
      const userId = randomUUID();
      const membershipId = randomUUID();
      const deviceId = randomUUID();
      const jobId = randomUUID();
      await expectSuccess(
        [
          buildSchoolSql(schoolId, `school-${randomUUID()}`),
          buildUserSql(userId, `user-${randomUUID()}`),
          buildMembershipSql(membershipId, schoolId, userId, "STUDENT"),
          buildDeviceSql(deviceId, schoolId),
          buildSyncJobSql(jobId, schoolId, deviceId, randomUUID()),
          buildSyncOperationSql(
            randomUUID(),
            schoolId,
            deviceId,
            jobId,
            userId,
            randomUUID(),
          ),
          buildSyncOperationSql(
            randomUUID(),
            schoolId,
            deviceId,
            jobId,
            userId,
            randomUUID(),
          ),
        ].join("\n"),
        "two SyncOperations under same Job should be created",
      );
    });

    it("can query SyncJob from SyncOperation", async () => {
      const schoolId = randomUUID();
      const userId = randomUUID();
      const membershipId = randomUUID();
      const deviceId = randomUUID();
      const jobId = randomUUID();
      const opId = randomUUID();
      await expectSuccess(
        [
          buildSchoolSql(schoolId, `school-${randomUUID()}`),
          buildUserSql(userId, `user-${randomUUID()}`),
          buildMembershipSql(membershipId, schoolId, userId, "STUDENT"),
          buildDeviceSql(deviceId, schoolId),
          buildSyncJobSql(jobId, schoolId, deviceId, randomUUID()),
          buildSyncOperationSql(
            opId,
            schoolId,
            deviceId,
            jobId,
            userId,
            randomUUID(),
          ),
          `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "SyncOperation" op
    JOIN "SyncJob" job ON op."syncJobId" = job."id"
    WHERE op."id" = '${opId}' AND job."id" = '${jobId}'
      AND op."schoolId" = job."schoolId" AND op."deviceId" = job."deviceId"
  ) THEN
    RAISE EXCEPTION 'Cannot resolve SyncJob from SyncOperation';
  END IF;
END $$;`,
        ].join("\n"),
        "SyncOperation should resolve its SyncJob",
      );
    });

    it("rejects SyncOperation with unknown syncJobId", async () => {
      const schoolId = randomUUID();
      const userId = randomUUID();
      const membershipId = randomUUID();
      const deviceId = randomUUID();
      const stderr = await expectFailure(
        [
          buildSchoolSql(schoolId, `school-${randomUUID()}`),
          buildUserSql(userId, `user-${randomUUID()}`),
          buildMembershipSql(membershipId, schoolId, userId, "STUDENT"),
          buildDeviceSql(deviceId, schoolId),
          buildSyncOperationSql(
            randomUUID(),
            schoolId,
            deviceId,
            randomUUID(),
            userId,
            randomUUID(),
          ),
        ].join("\n"),
        "unknown syncJobId should be rejected",
      );
      assert.match(stderr, /foreign key/i);
    });

    it("rejects SyncOperation with mismatched schoolId", async () => {
      const schoolA = randomUUID();
      const schoolB = randomUUID();
      const userA = randomUUID();
      const userB = randomUUID();
      const membershipA = randomUUID();
      const membershipB = randomUUID();
      const deviceA = randomUUID();
      const deviceB = randomUUID();
      const jobA = randomUUID();
      const stderr = await expectFailure(
        [
          buildSchoolSql(schoolA, `school-${randomUUID()}`),
          buildSchoolSql(schoolB, `school-${randomUUID()}`),
          buildUserSql(userA, `user-${randomUUID()}`),
          buildUserSql(userB, `user-${randomUUID()}`),
          buildMembershipSql(membershipA, schoolA, userA, "STUDENT"),
          buildMembershipSql(membershipB, schoolB, userB, "STUDENT"),
          buildDeviceSql(deviceA, schoolA),
          buildDeviceSql(deviceB, schoolB),
          buildSyncJobSql(jobA, schoolA, deviceA, randomUUID()),
          buildSyncOperationSql(
            randomUUID(),
            schoolB,
            deviceB,
            jobA,
            userB,
            randomUUID(),
          ),
        ].join("\n"),
        "mismatched schoolId should be rejected",
      );
      assert.match(stderr, /foreign key/i);
    });

    it("rejects SyncOperation with mismatched deviceId", async () => {
      const schoolId = randomUUID();
      const userId = randomUUID();
      const membershipId = randomUUID();
      const deviceA = randomUUID();
      const deviceB = randomUUID();
      const jobA = randomUUID();
      const stderr = await expectFailure(
        [
          buildSchoolSql(schoolId, `school-${randomUUID()}`),
          buildUserSql(userId, `user-${randomUUID()}`),
          buildMembershipSql(membershipId, schoolId, userId, "STUDENT"),
          buildDeviceSql(deviceA, schoolId),
          buildDeviceSql(deviceB, schoolId),
          buildSyncJobSql(jobA, schoolId, deviceA, randomUUID()),
          buildSyncOperationSql(
            randomUUID(),
            schoolId,
            deviceB,
            jobA,
            userId,
            randomUUID(),
          ),
        ].join("\n"),
        "mismatched deviceId should be rejected",
      );
      assert.match(stderr, /foreign key/i);
    });

    it("rejects duplicate operationId within same school and actor", async () => {
      const schoolId = randomUUID();
      const userId = randomUUID();
      const membershipId = randomUUID();
      const deviceId = randomUUID();
      const jobId = randomUUID();
      const operationId = randomUUID();
      const stderr = await expectFailure(
        [
          buildSchoolSql(schoolId, `school-${randomUUID()}`),
          buildUserSql(userId, `user-${randomUUID()}`),
          buildMembershipSql(membershipId, schoolId, userId, "STUDENT"),
          buildDeviceSql(deviceId, schoolId),
          buildSyncJobSql(jobId, schoolId, deviceId, randomUUID()),
          buildSyncOperationSql(
            randomUUID(),
            schoolId,
            deviceId,
            jobId,
            userId,
            operationId,
          ),
          buildSyncOperationSql(
            randomUUID(),
            schoolId,
            deviceId,
            jobId,
            userId,
            operationId,
          ),
        ].join("\n"),
        "duplicate operationId should be rejected",
      );
      assert.match(stderr, /unique constraint/i);
    });

    it("allows same operationId across different schools", async () => {
      const schoolA = randomUUID();
      const schoolB = randomUUID();
      const userA = randomUUID();
      const userB = randomUUID();
      const membershipA = randomUUID();
      const membershipB = randomUUID();
      const deviceA = randomUUID();
      const deviceB = randomUUID();
      const jobA = randomUUID();
      const jobB = randomUUID();
      const operationId = randomUUID();
      await expectSuccess(
        [
          buildSchoolSql(schoolA, `school-${randomUUID()}`),
          buildSchoolSql(schoolB, `school-${randomUUID()}`),
          buildUserSql(userA, `user-a-${randomUUID()}`),
          buildUserSql(userB, `user-b-${randomUUID()}`),
          buildMembershipSql(membershipA, schoolA, userA, "STUDENT"),
          buildMembershipSql(membershipB, schoolB, userB, "STUDENT"),
          buildDeviceSql(deviceA, schoolA),
          buildDeviceSql(deviceB, schoolB),
          buildSyncJobSql(jobA, schoolA, deviceA, randomUUID()),
          buildSyncJobSql(jobB, schoolB, deviceB, randomUUID()),
          buildSyncOperationSql(
            randomUUID(),
            schoolA,
            deviceA,
            jobA,
            userA,
            operationId,
          ),
          buildSyncOperationSql(
            randomUUID(),
            schoolB,
            deviceB,
            jobB,
            userB,
            operationId,
          ),
        ].join("\n"),
        "same operationId across schools should be allowed",
      );
    });

    it("cascades delete SyncJob to SyncOperations", async () => {
      const schoolId = randomUUID();
      const userId = randomUUID();
      const membershipId = randomUUID();
      const deviceId = randomUUID();
      const jobId = randomUUID();
      const opId = randomUUID();
      await expectSuccess(
        [
          buildSchoolSql(schoolId, `school-${randomUUID()}`),
          buildUserSql(userId, `user-${randomUUID()}`),
          buildMembershipSql(membershipId, schoolId, userId, "STUDENT"),
          buildDeviceSql(deviceId, schoolId),
          buildSyncJobSql(jobId, schoolId, deviceId, randomUUID()),
          buildSyncOperationSql(
            opId,
            schoolId,
            deviceId,
            jobId,
            userId,
            randomUUID(),
          ),
          `DELETE FROM "SyncJob" WHERE "id" = '${jobId}';`,
          `DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "SyncOperation" WHERE "id" = '${opId}') THEN
    RAISE EXCEPTION 'SyncOperation was not cascade-deleted';
  END IF;
END $$;`,
        ].join("\n"),
        "deleting SyncJob should cascade delete SyncOperations",
      );
    });
  });

  describe("Submission constraints", () => {
    async function setupSubmissionContext() {
      const schoolId = randomUUID();
      const teacherId = randomUUID();
      const studentId = randomUUID();
      const teacherMembershipId = randomUUID();
      const studentMembershipId = randomUUID();
      const termId = randomUUID();
      const classId = randomUUID();
      const enrollmentId = randomUUID();
      const courseId = randomUUID();
      const versionId = randomUUID();
      const unitId = randomUUID();
      const lessonId = randomUUID();
      const activityId = randomUUID();
      const assignmentId = randomUUID();
      const sql = [
        buildSchoolSql(schoolId, `school-${randomUUID()}`),
        buildUserSql(teacherId, `teacher-${randomUUID()}`),
        buildUserSql(studentId, `student-${randomUUID()}`),
        buildMembershipSql(teacherMembershipId, schoolId, teacherId, "TEACHER"),
        buildMembershipSql(studentMembershipId, schoolId, studentId, "STUDENT"),
        buildTermSql(termId, schoolId, `term-${randomUUID()}`),
        buildClassSql(classId, schoolId, termId, `class-${randomUUID()}`),
        buildEnrollmentSql(
          enrollmentId,
          schoolId,
          classId,
          studentId,
          "STUDENT",
        ),
        buildCourseSql(courseId, schoolId, teacherId, `course-${randomUUID()}`),
        buildCourseVersionSql(versionId, schoolId, courseId),
        buildUnitSql(unitId, versionId),
        buildLessonSql(lessonId, unitId),
        buildLearningActivitySql(activityId, lessonId),
        buildAssignmentSql(assignmentId, schoolId, versionId, teacherId),
      ].join("\n");
      await expectSuccess(sql, "setup submission context");
      return { schoolId, assignmentId, enrollmentId };
    }

    it("rejects Submission without idempotencyKey", async () => {
      const { schoolId, assignmentId, enrollmentId } =
        await setupSubmissionContext();
      const stderr = await expectFailure(
        `INSERT INTO "Submission" ("id", "schoolId", "assignmentId", "enrollmentId", "attemptNo", "status", "revision", "createdAt", "updatedAt") VALUES ('${randomUUID()}', '${schoolId}', '${assignmentId}', '${enrollmentId}', 1, 'IN_PROGRESS', 1, NOW(), NOW());`,
        "Submission without idempotencyKey should be rejected",
      );
      assert.match(stderr, /null value|NOT NULL|Failing row contains/i);
    });

    it("rejects duplicate idempotencyKey for same enrollment", async () => {
      const { schoolId, assignmentId, enrollmentId } =
        await setupSubmissionContext();
      const key = randomUUID();
      const stderr = await expectFailure(
        [
          buildSubmissionSql(
            randomUUID(),
            schoolId,
            assignmentId,
            enrollmentId,
            1,
            key,
          ),
          buildSubmissionSql(
            randomUUID(),
            schoolId,
            assignmentId,
            enrollmentId,
            2,
            key,
          ),
        ].join("\n"),
        "duplicate idempotencyKey should be rejected",
      );
      assert.match(stderr, /unique constraint/i);
    });

    it("allows different idempotencyKeys for same enrollment", async () => {
      const { schoolId, assignmentId, enrollmentId } =
        await setupSubmissionContext();
      await expectSuccess(
        [
          buildSubmissionSql(
            randomUUID(),
            schoolId,
            assignmentId,
            enrollmentId,
            1,
            randomUUID(),
          ),
          buildSubmissionSql(
            randomUUID(),
            schoolId,
            assignmentId,
            enrollmentId,
            2,
            randomUUID(),
          ),
        ].join("\n"),
        "different idempotencyKeys should be allowed",
      );
    });

    it("rejects duplicate attemptNo for same assignment and enrollment", async () => {
      const { schoolId, assignmentId, enrollmentId } =
        await setupSubmissionContext();
      const stderr = await expectFailure(
        [
          buildSubmissionSql(
            randomUUID(),
            schoolId,
            assignmentId,
            enrollmentId,
            1,
            randomUUID(),
          ),
          buildSubmissionSql(
            randomUUID(),
            schoolId,
            assignmentId,
            enrollmentId,
            1,
            randomUUID(),
          ),
        ].join("\n"),
        "duplicate attemptNo should be rejected",
      );
      assert.match(stderr, /unique constraint/i);
    });
  });

  describe("AssignmentTarget CHECK constraint", () => {
    async function setupTargetContext() {
      const schoolId = randomUUID();
      const teacherId = randomUUID();
      const studentId = randomUUID();
      const teacherMembershipId = randomUUID();
      const studentMembershipId = randomUUID();
      const termId = randomUUID();
      const classId = randomUUID();
      const enrollmentId = randomUUID();
      const courseId = randomUUID();
      const versionId = randomUUID();
      const assignmentId = randomUUID();
      const sql = [
        buildSchoolSql(schoolId, `school-${randomUUID()}`),
        buildUserSql(teacherId, `teacher-${randomUUID()}`),
        buildUserSql(studentId, `student-${randomUUID()}`),
        buildMembershipSql(teacherMembershipId, schoolId, teacherId, "TEACHER"),
        buildMembershipSql(studentMembershipId, schoolId, studentId, "STUDENT"),
        buildTermSql(termId, schoolId, `term-${randomUUID()}`),
        buildClassSql(classId, schoolId, termId, `class-${randomUUID()}`),
        buildEnrollmentSql(
          enrollmentId,
          schoolId,
          classId,
          studentId,
          "STUDENT",
        ),
        buildCourseSql(courseId, schoolId, teacherId, `course-${randomUUID()}`),
        buildCourseVersionSql(versionId, schoolId, courseId),
        buildAssignmentSql(assignmentId, schoolId, versionId, teacherId),
      ].join("\n");
      await expectSuccess(sql, "setup target context");
      return { schoolId, classId, enrollmentId, assignmentId };
    }

    it("allows valid CLASS target", async () => {
      const { schoolId, classId, assignmentId } = await setupTargetContext();
      await expectSuccess(
        buildAssignmentTargetSql(
          randomUUID(),
          schoolId,
          assignmentId,
          "CLASS",
          classId,
          null,
        ),
        "valid CLASS target should be allowed",
      );
    });

    it("allows valid STUDENT target", async () => {
      const { schoolId, enrollmentId, assignmentId } =
        await setupTargetContext();
      await expectSuccess(
        buildAssignmentTargetSql(
          randomUUID(),
          schoolId,
          assignmentId,
          "STUDENT",
          null,
          enrollmentId,
        ),
        "valid STUDENT target should be allowed",
      );
    });

    it("rejects target with both classId and enrollmentId empty", async () => {
      const { schoolId, assignmentId } = await setupTargetContext();
      const stderr = await expectFailure(
        buildAssignmentTargetSql(
          randomUUID(),
          schoolId,
          assignmentId,
          "CLASS",
          null,
          null,
        ),
        "target with both ids empty should be rejected",
      );
      assert.match(stderr, /check constraint/i);
    });

    it("rejects target with both classId and enrollmentId set", async () => {
      const { schoolId, classId, enrollmentId, assignmentId } =
        await setupTargetContext();
      const stderr = await expectFailure(
        buildAssignmentTargetSql(
          randomUUID(),
          schoolId,
          assignmentId,
          "CLASS",
          classId,
          enrollmentId,
        ),
        "target with both ids set should be rejected",
      );
      assert.match(stderr, /check constraint/i);
    });

    it("rejects CLASS target with enrollmentId instead of classId", async () => {
      const { schoolId, enrollmentId, assignmentId } =
        await setupTargetContext();
      const stderr = await expectFailure(
        buildAssignmentTargetSql(
          randomUUID(),
          schoolId,
          assignmentId,
          "CLASS",
          null,
          enrollmentId,
        ),
        "CLASS target with enrollmentId should be rejected",
      );
      assert.match(stderr, /check constraint/i);
    });
  });
});
