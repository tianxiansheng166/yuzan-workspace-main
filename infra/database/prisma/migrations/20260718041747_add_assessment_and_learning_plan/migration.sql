-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('READING', 'WRITTEN', 'MIXED');

-- CreateEnum
CREATE TYPE "AssessmentSessionStatus" AS ENUM ('CREATED', 'IN_PROGRESS', 'SUBMITTED', 'PROCESSING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssessmentItemStatus" AS ENUM ('PENDING', 'ANSWERED', 'REVIEWED', 'FLAGGED');

-- CreateTable
CREATE TABLE "LearningPlan" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "authorUserId" UUID NOT NULL,
    "planContent" JSONB NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentSession" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "classId" UUID NOT NULL,
    "initiatorUserId" UUID NOT NULL,
    "type" "AssessmentType" NOT NULL,
    "status" "AssessmentSessionStatus" NOT NULL DEFAULT 'CREATED',
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "retestOfSessionId" UUID,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentItem" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "questionId" UUID,
    "recordingId" UUID,
    "prompt" JSONB NOT NULL,
    "itemType" TEXT NOT NULL,
    "status" "AssessmentItemStatus" NOT NULL DEFAULT 'PENDING',
    "sortOrder" INTEGER NOT NULL,
    "maxScore" DOUBLE PRECISION,
    "scoredScore" DOUBLE PRECISION,
    "autoResult" JSONB,
    "reviewerUserId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WrittenAnswer" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "content" JSONB NOT NULL,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "charCount" INTEGER NOT NULL DEFAULT 0,
    "autoSavedAt" TIMESTAMP(3),
    "finalSubmittedAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WrittenAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentReport" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "overallScore" DOUBLE PRECISION,
    "readingScore" DOUBLE PRECISION,
    "writtenScore" DOUBLE PRECISION,
    "summary" JSONB,
    "recommendations" JSONB,
    "dataCompleteness" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3),
    "generatedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceCheckLog" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sessionId" UUID,
    "checkType" TEXT NOT NULL,
    "checkResult" JSONB NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceCheckLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearningPlan_enrollmentId_updatedAt_idx" ON "LearningPlan"("enrollmentId", "updatedAt");

-- CreateIndex
CREATE INDEX "LearningPlan_schoolId_authorUserId_idx" ON "LearningPlan"("schoolId", "authorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningPlan_schoolId_id_key" ON "LearningPlan"("schoolId", "id");

-- CreateIndex
CREATE INDEX "AssessmentSession_schoolId_status_idx" ON "AssessmentSession"("schoolId", "status");

-- CreateIndex
CREATE INDEX "AssessmentSession_enrollmentId_createdAt_idx" ON "AssessmentSession"("enrollmentId", "createdAt");

-- CreateIndex
CREATE INDEX "AssessmentSession_classId_idx" ON "AssessmentSession"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentSession_schoolId_id_key" ON "AssessmentSession"("schoolId", "id");

-- CreateIndex
CREATE INDEX "AssessmentItem_sessionId_status_idx" ON "AssessmentItem"("sessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentItem_sessionId_sortOrder_key" ON "AssessmentItem"("sessionId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "WrittenAnswer_itemId_key" ON "WrittenAnswer"("itemId");

-- CreateIndex
CREATE INDEX "WrittenAnswer_itemId_idx" ON "WrittenAnswer"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentReport_sessionId_key" ON "AssessmentReport"("sessionId");

-- CreateIndex
CREATE INDEX "AssessmentReport_schoolId_generatedAt_idx" ON "AssessmentReport"("schoolId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentReport_schoolId_id_key" ON "AssessmentReport"("schoolId", "id");

-- CreateIndex
CREATE INDEX "DeviceCheckLog_userId_createdAt_idx" ON "DeviceCheckLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DeviceCheckLog_sessionId_idx" ON "DeviceCheckLog"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceCheckLog_schoolId_id_key" ON "DeviceCheckLog"("schoolId", "id");

-- AddForeignKey
ALTER TABLE "LearningPlan" ADD CONSTRAINT "LearningPlan_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentSession" ADD CONSTRAINT "AssessmentSession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentSession" ADD CONSTRAINT "AssessmentSession_schoolId_enrollmentId_fkey" FOREIGN KEY ("schoolId", "enrollmentId") REFERENCES "Enrollment"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentItem" ADD CONSTRAINT "AssessmentItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentItem" ADD CONSTRAINT "AssessmentItem_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentItem" ADD CONSTRAINT "AssessmentItem_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WrittenAnswer" ADD CONSTRAINT "WrittenAnswer_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AssessmentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentReport" ADD CONSTRAINT "AssessmentReport_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentReport" ADD CONSTRAINT "AssessmentReport_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceCheckLog" ADD CONSTRAINT "DeviceCheckLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
