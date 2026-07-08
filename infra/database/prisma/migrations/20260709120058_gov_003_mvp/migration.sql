-- CreateEnum
CREATE TYPE "AssignmentTargetType" AS ENUM ('CLASS', 'STUDENT');

-- CreateEnum
CREATE TYPE "ContentPackageStatus" AS ENUM ('PENDING', 'BUILDING', 'READY', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SyncCursorEntityType" AS ENUM ('ASSIGNMENT', 'SUBMISSION', 'PROGRESS', 'CONTENT_PACKAGE', 'FEEDBACK');

-- DropForeignKey
ALTER TABLE "Answer" DROP CONSTRAINT "Answer_activityId_fkey";

-- DropForeignKey
ALTER TABLE "Answer" DROP CONSTRAINT "Answer_submissionId_fkey";

-- DropForeignKey
ALTER TABLE "Assignment" DROP CONSTRAINT "Assignment_classId_fkey";

-- DropForeignKey
ALTER TABLE "Assignment" DROP CONSTRAINT "Assignment_courseVersionId_fkey";

-- DropForeignKey
ALTER TABLE "AudioAsset" DROP CONSTRAINT "AudioAsset_answerId_fkey";

-- DropForeignKey
ALTER TABLE "Class" DROP CONSTRAINT "Class_termId_fkey";

-- DropForeignKey
ALTER TABLE "CourseVersion" DROP CONSTRAINT "CourseVersion_courseId_fkey";

-- DropForeignKey
ALTER TABLE "Enrollment" DROP CONSTRAINT "Enrollment_classId_fkey";

-- DropForeignKey
ALTER TABLE "Feedback" DROP CONSTRAINT "Feedback_submissionId_fkey";

-- DropForeignKey
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_assignmentId_fkey";

-- DropForeignKey
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_studentId_fkey";

-- DropForeignKey
ALTER TABLE "SyncOperation" DROP CONSTRAINT "SyncOperation_deviceId_fkey";

-- DropIndex
DROP INDEX "ActivityProgress_activityId_studentId_key";

-- DropIndex
DROP INDEX "ActivityProgress_studentId_updatedAt_idx";

-- DropIndex
DROP INDEX "Assignment_schoolId_classId_status_idx";

-- DropIndex
DROP INDEX "AudioAsset_answerId_key";

-- DropIndex
DROP INDEX "Submission_assignmentId_studentId_attemptNo_key";

-- DropIndex
DROP INDEX "Submission_studentId_idempotencyKey_key";

-- DropIndex
DROP INDEX "SyncOperation_actorUserId_operationId_key";

-- DropIndex
DROP INDEX "SyncOperation_deviceId_status_createdAt_idx";

-- AlterTable
ALTER TABLE "ActivityProgress" DROP COLUMN "studentId",
ADD COLUMN     "enrollmentId" UUID NOT NULL,
ADD COLUMN     "schoolId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "Assignment" DROP COLUMN "classId",
ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AudioAsset" DROP COLUMN "answerId",
ADD COLUMN     "attemptId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN "summary",
ADD COLUMN     "afterSummary" JSONB,
ADD COLUMN     "beforeSummary" JSONB;

-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "campusId" UUID;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CourseVersion" ADD COLUMN     "schoolId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "campusId" UUID,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "membershipId" UUID;

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "schoolId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "schoolId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "Resource" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Submission" DROP COLUMN "studentId",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "enrollmentId" UUID NOT NULL,
ADD COLUMN     "schoolId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "SyncOperation" ADD COLUMN     "schoolId" UUID NOT NULL,
ADD COLUMN     "syncJobId" UUID NOT NULL;

-- DropTable
DROP TABLE "Answer";

-- CreateTable
CREATE TABLE "Campus" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "timezone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentTarget" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "targetType" "AssignmentTargetType" NOT NULL,
    "classId" UUID,
    "enrollmentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentTarget_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AssignmentTarget_target_check" CHECK (
        ("targetType" = 'CLASS' AND "classId" IS NOT NULL AND "enrollmentId" IS NULL) OR
        ("targetType" = 'STUDENT' AND "enrollmentId" IS NOT NULL AND "classId" IS NULL)
    )
);

-- CreateTable
CREATE TABLE "ContentPackage" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "courseVersionId" UUID NOT NULL,
    "deviceId" UUID,
    "status" "ContentPackageStatus" NOT NULL DEFAULT 'PENDING',
    "manifest" JSONB,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityAttempt" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "activityId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "value" JSONB,
    "autoResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "clientOperationId" UUID NOT NULL,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'QUEUED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "summary" JSONB,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncCursor" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "entityType" "SyncCursorEntityType" NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "lastEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncCursor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Campus_schoolId_isActive_idx" ON "Campus"("schoolId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Campus_schoolId_id_key" ON "Campus"("schoolId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Campus_schoolId_name_key" ON "Campus"("schoolId", "name");

-- CreateIndex
CREATE INDEX "AssignmentTarget_schoolId_idx" ON "AssignmentTarget"("schoolId");

-- CreateIndex
CREATE INDEX "AssignmentTarget_assignmentId_idx" ON "AssignmentTarget"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentTarget_schoolId_id_key" ON "AssignmentTarget"("schoolId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentTarget_assignmentId_classId_key" ON "AssignmentTarget"("assignmentId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentTarget_assignmentId_enrollmentId_key" ON "AssignmentTarget"("assignmentId", "enrollmentId");

-- CreateIndex
CREATE INDEX "ContentPackage_schoolId_status_idx" ON "ContentPackage"("schoolId", "status");

-- CreateIndex
CREATE INDEX "ContentPackage_deviceId_status_idx" ON "ContentPackage"("deviceId", "status");

-- CreateIndex
CREATE INDEX "ContentPackage_courseVersionId_idx" ON "ContentPackage"("courseVersionId");

-- CreateIndex
CREATE INDEX "ActivityAttempt_schoolId_submissionId_idx" ON "ActivityAttempt"("schoolId", "submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityAttempt_schoolId_id_key" ON "ActivityAttempt"("schoolId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityAttempt_submissionId_activityId_key" ON "ActivityAttempt"("submissionId", "activityId");

-- CreateIndex
CREATE INDEX "SyncJob_schoolId_status_idx" ON "SyncJob"("schoolId", "status");

-- CreateIndex
CREATE INDEX "SyncJob_deviceId_status_createdAt_idx" ON "SyncJob"("deviceId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncJob_schoolId_deviceId_id_key" ON "SyncJob"("schoolId", "deviceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SyncJob_schoolId_deviceId_clientOperationId_key" ON "SyncJob"("schoolId", "deviceId", "clientOperationId");

-- CreateIndex
CREATE INDEX "SyncCursor_schoolId_deviceId_idx" ON "SyncCursor"("schoolId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncCursor_deviceId_entityType_key" ON "SyncCursor"("deviceId", "entityType");

-- CreateIndex
CREATE INDEX "ActivityProgress_enrollmentId_updatedAt_idx" ON "ActivityProgress"("enrollmentId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityProgress_activityId_enrollmentId_key" ON "ActivityProgress"("activityId", "enrollmentId");

-- CreateIndex
CREATE INDEX "Assignment_schoolId_status_idx" ON "Assignment"("schoolId", "status");

-- CreateIndex
CREATE INDEX "Assignment_deletedAt_idx" ON "Assignment"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_schoolId_id_key" ON "Assignment"("schoolId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AudioAsset_attemptId_key" ON "AudioAsset"("attemptId");

-- CreateIndex
CREATE INDEX "AuditLog_resourceType_resourceId_idx" ON "AuditLog"("resourceType", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Class_schoolId_id_key" ON "Class"("schoolId", "id");

-- CreateIndex
CREATE INDEX "Course_deletedAt_idx" ON "Course"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Course_schoolId_id_key" ON "Course"("schoolId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CourseVersion_schoolId_id_key" ON "CourseVersion"("schoolId", "id");

-- CreateIndex
CREATE INDEX "Device_deletedAt_idx" ON "Device"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Device_schoolId_id_key" ON "Device"("schoolId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_schoolId_id_key" ON "Enrollment"("schoolId", "id");

-- CreateIndex
CREATE INDEX "Feedback_schoolId_releasedAt_idx" ON "Feedback"("schoolId", "releasedAt");

-- CreateIndex
CREATE INDEX "Feedback_deletedAt_idx" ON "Feedback"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_schoolId_id_key" ON "Membership"("schoolId", "id");

-- CreateIndex
CREATE INDEX "Resource_deletedAt_idx" ON "Resource"("deletedAt");

-- CreateIndex
CREATE INDEX "School_deletedAt_idx" ON "School"("deletedAt");

-- CreateIndex
CREATE INDEX "Submission_schoolId_status_idx" ON "Submission"("schoolId", "status");

-- CreateIndex
CREATE INDEX "Submission_deletedAt_idx" ON "Submission"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_schoolId_id_key" ON "Submission"("schoolId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_assignmentId_enrollmentId_attemptNo_key" ON "Submission"("assignmentId", "enrollmentId", "attemptNo");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_enrollmentId_idempotencyKey_key" ON "Submission"("enrollmentId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "SyncOperation_schoolId_deviceId_status_createdAt_idx" ON "SyncOperation"("schoolId", "deviceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SyncOperation_syncJobId_idx" ON "SyncOperation"("syncJobId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncOperation_schoolId_actorUserId_operationId_key" ON "SyncOperation"("schoolId", "actorUserId", "operationId");

-- CreateIndex
CREATE UNIQUE INDEX "Term_schoolId_id_key" ON "Term"("schoolId", "id");

-- AddForeignKey
ALTER TABLE "Campus" ADD CONSTRAINT "Campus_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_schoolId_termId_fkey" FOREIGN KEY ("schoolId", "termId") REFERENCES "Term"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_schoolId_campusId_fkey" FOREIGN KEY ("schoolId", "campusId") REFERENCES "Campus"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_schoolId_classId_fkey" FOREIGN KEY ("schoolId", "classId") REFERENCES "Class"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseVersion" ADD CONSTRAINT "CourseVersion_schoolId_courseId_fkey" FOREIGN KEY ("schoolId", "courseId") REFERENCES "Course"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_schoolId_courseVersionId_fkey" FOREIGN KEY ("schoolId", "courseVersionId") REFERENCES "CourseVersion"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentTarget" ADD CONSTRAINT "AssignmentTarget_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentTarget" ADD CONSTRAINT "AssignmentTarget_schoolId_assignmentId_fkey" FOREIGN KEY ("schoolId", "assignmentId") REFERENCES "Assignment"("schoolId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentTarget" ADD CONSTRAINT "AssignmentTarget_schoolId_classId_fkey" FOREIGN KEY ("schoolId", "classId") REFERENCES "Class"("schoolId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentTarget" ADD CONSTRAINT "AssignmentTarget_schoolId_enrollmentId_fkey" FOREIGN KEY ("schoolId", "enrollmentId") REFERENCES "Enrollment"("schoolId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPackage" ADD CONSTRAINT "ContentPackage_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPackage" ADD CONSTRAINT "ContentPackage_schoolId_courseVersionId_fkey" FOREIGN KEY ("schoolId", "courseVersionId") REFERENCES "CourseVersion"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPackage" ADD CONSTRAINT "ContentPackage_schoolId_deviceId_fkey" FOREIGN KEY ("schoolId", "deviceId") REFERENCES "Device"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityProgress" ADD CONSTRAINT "ActivityProgress_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityProgress" ADD CONSTRAINT "ActivityProgress_schoolId_enrollmentId_fkey" FOREIGN KEY ("schoolId", "enrollmentId") REFERENCES "Enrollment"("schoolId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAttempt" ADD CONSTRAINT "ActivityAttempt_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAttempt" ADD CONSTRAINT "ActivityAttempt_schoolId_submissionId_fkey" FOREIGN KEY ("schoolId", "submissionId") REFERENCES "Submission"("schoolId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAttempt" ADD CONSTRAINT "ActivityAttempt_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "LearningActivity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_schoolId_assignmentId_fkey" FOREIGN KEY ("schoolId", "assignmentId") REFERENCES "Assignment"("schoolId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_schoolId_enrollmentId_fkey" FOREIGN KEY ("schoolId", "enrollmentId") REFERENCES "Enrollment"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_schoolId_deviceId_fkey" FOREIGN KEY ("schoolId", "deviceId") REFERENCES "Device"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_schoolId_submissionId_fkey" FOREIGN KEY ("schoolId", "submissionId") REFERENCES "Submission"("schoolId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_schoolId_campusId_fkey" FOREIGN KEY ("schoolId", "campusId") REFERENCES "Campus"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_schoolId_membershipId_fkey" FOREIGN KEY ("schoolId", "membershipId") REFERENCES "Membership"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudioAsset" ADD CONSTRAINT "AudioAsset_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ActivityAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncOperation" ADD CONSTRAINT "SyncOperation_schoolId_deviceId_syncJobId_fkey" FOREIGN KEY ("schoolId", "deviceId", "syncJobId") REFERENCES "SyncJob"("schoolId", "deviceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_schoolId_deviceId_fkey" FOREIGN KEY ("schoolId", "deviceId") REFERENCES "Device"("schoolId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncCursor" ADD CONSTRAINT "SyncCursor_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncCursor" ADD CONSTRAINT "SyncCursor_schoolId_deviceId_fkey" FOREIGN KEY ("schoolId", "deviceId") REFERENCES "Device"("schoolId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
