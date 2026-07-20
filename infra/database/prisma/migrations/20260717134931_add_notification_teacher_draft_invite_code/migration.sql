-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TASK_DEADLINE', 'REVIEW_REMINDER', 'SYSTEM', 'COURSE_REVIEW_RESULT');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "RecordingStatus" AS ENUM ('INITIALIZED', 'UPLOADING', 'COMPLETE', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "DraftToolSource" AS ENUM ('MINDMATE', 'MINDGRAPH', 'LESSON_PLAN', 'WORKSHEET');

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "recipientUserId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "actionUrl" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherDraft" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "authorUserId" UUID NOT NULL,
    "toolSource" "DraftToolSource" NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteCode" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 10,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recording" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "submissionId" UUID,
    "status" "RecordingStatus" NOT NULL DEFAULT 'INITIALIZED',
    "partCount" INTEGER NOT NULL DEFAULT 0,
    "uploadedParts" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "durationMs" INTEGER,
    "mimeType" TEXT,
    "objectKey" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordingChunk" (
    "id" UUID NOT NULL,
    "recordingId" UUID NOT NULL,
    "partNumber" INTEGER NOT NULL,
    "objectKey" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "checksumMd5" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecordingChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_schoolId_recipientUserId_readAt_createdAt_idx" ON "Notification"("schoolId", "recipientUserId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_schoolId_recipientUserId_type_idx" ON "Notification"("schoolId", "recipientUserId", "type");

-- CreateIndex
CREATE INDEX "Notification_expiresAt_idx" ON "Notification"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_schoolId_id_key" ON "Notification"("schoolId", "id");

-- CreateIndex
CREATE INDEX "TeacherDraft_schoolId_authorUserId_toolSource_updatedAt_idx" ON "TeacherDraft"("schoolId", "authorUserId", "toolSource", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherDraft_schoolId_id_key" ON "TeacherDraft"("schoolId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_code_key" ON "InviteCode"("code");

-- CreateIndex
CREATE INDEX "InviteCode_code_expiresAt_idx" ON "InviteCode"("code", "expiresAt");

-- CreateIndex
CREATE INDEX "InviteCode_schoolId_expiresAt_idx" ON "InviteCode"("schoolId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_schoolId_id_key" ON "InviteCode"("schoolId", "id");

-- CreateIndex
CREATE INDEX "Recording_schoolId_status_idx" ON "Recording"("schoolId", "status");

-- CreateIndex
CREATE INDEX "Recording_submissionId_idx" ON "Recording"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Recording_schoolId_id_key" ON "Recording"("schoolId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Recording_enrollmentId_idempotencyKey_key" ON "Recording"("enrollmentId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "RecordingChunk_recordingId_idx" ON "RecordingChunk"("recordingId");

-- CreateIndex
CREATE UNIQUE INDEX "RecordingChunk_recordingId_partNumber_key" ON "RecordingChunk"("recordingId", "partNumber");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherDraft" ADD CONSTRAINT "TeacherDraft_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteCode" ADD CONSTRAINT "InviteCode_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_schoolId_enrollmentId_fkey" FOREIGN KEY ("schoolId", "enrollmentId") REFERENCES "Enrollment"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_schoolId_submissionId_fkey" FOREIGN KEY ("schoolId", "submissionId") REFERENCES "Submission"("schoolId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingChunk" ADD CONSTRAINT "RecordingChunk_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE CASCADE ON UPDATE CASCADE;
