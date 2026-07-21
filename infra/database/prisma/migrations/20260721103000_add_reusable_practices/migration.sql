-- Reusable practice content is intentionally separated from AssessmentSession.
-- Published content is copied into AssessmentItem when an attempt is created.
CREATE TYPE "PracticeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "PracticeVisibility" AS ENUM ('SYSTEM', 'SCHOOL');
CREATE TYPE "PracticeDeliveryMode" AS ENUM ('ASSIGNMENT', 'SELF_PRACTICE');
CREATE TYPE "PracticeDeliveryStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED');

CREATE TABLE "PracticeDefinition" (
  "id" UUID NOT NULL,
  "schoolId" UUID,
  "visibility" "PracticeVisibility" NOT NULL DEFAULT 'SCHOOL',
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "coverAsset" TEXT,
  "difficulty" TEXT NOT NULL,
  "estimatedMinutes" INTEGER NOT NULL,
  "status" "PracticeStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PracticeDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PracticeVersion" (
  "id" UUID NOT NULL,
  "definitionId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "PracticeStatus" NOT NULL DEFAULT 'DRAFT',
  "contentHash" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PracticeVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PracticeSection" (
  "id" UUID NOT NULL,
  "versionId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL,
  "estimatedMinutes" INTEGER NOT NULL,
  CONSTRAINT "PracticeSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PracticeItemRef" (
  "id" UUID NOT NULL,
  "sectionId" UUID NOT NULL,
  "questionId" UUID,
  "itemType" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "config" JSONB NOT NULL,
  CONSTRAINT "PracticeItemRef_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PracticeDelivery" (
  "id" UUID NOT NULL,
  "practiceVersionId" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "classId" UUID,
  "studentId" UUID,
  "mode" "PracticeDeliveryMode" NOT NULL,
  "deadline" TIMESTAMP(3),
  "reRecordPolicy" JSONB NOT NULL,
  "mobilePolicy" JSONB NOT NULL,
  "status" "PracticeDeliveryStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PracticeDelivery_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AssessmentSession" ADD COLUMN "practiceDefinitionId" UUID;
ALTER TABLE "AssessmentSession" ADD COLUMN "practiceVersionId" UUID;
ALTER TABLE "AssessmentSession" ADD COLUMN "deliveryId" UUID;
ALTER TABLE "AssessmentItem" ADD COLUMN "sectionTitle" TEXT;
ALTER TABLE "AssessmentItem" ADD COLUMN "sectionOrder" INTEGER;
ALTER TABLE "AssessmentItem" ADD COLUMN "itemConfig" JSONB;

CREATE UNIQUE INDEX "PracticeVersion_definitionId_version_key" ON "PracticeVersion"("definitionId", "version");
CREATE UNIQUE INDEX "PracticeSection_versionId_sortOrder_key" ON "PracticeSection"("versionId", "sortOrder");
CREATE UNIQUE INDEX "PracticeItemRef_sectionId_sortOrder_key" ON "PracticeItemRef"("sectionId", "sortOrder");
CREATE INDEX "PracticeDefinition_schoolId_status_idx" ON "PracticeDefinition"("schoolId", "status");
CREATE INDEX "PracticeDefinition_visibility_status_idx" ON "PracticeDefinition"("visibility", "status");
CREATE INDEX "PracticeVersion_definitionId_status_publishedAt_idx" ON "PracticeVersion"("definitionId", "status", "publishedAt");
CREATE INDEX "PracticeItemRef_questionId_idx" ON "PracticeItemRef"("questionId");
CREATE INDEX "PracticeDelivery_schoolId_status_mode_idx" ON "PracticeDelivery"("schoolId", "status", "mode");
CREATE INDEX "PracticeDelivery_schoolId_classId_studentId_idx" ON "PracticeDelivery"("schoolId", "classId", "studentId");
CREATE INDEX "AssessmentSession_practiceDefinitionId_enrollmentId_status_idx" ON "AssessmentSession"("practiceDefinitionId", "enrollmentId", "status");
CREATE INDEX "AssessmentSession_deliveryId_status_idx" ON "AssessmentSession"("deliveryId", "status");

ALTER TABLE "PracticeDefinition" ADD CONSTRAINT "PracticeDefinition_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeVersion" ADD CONSTRAINT "PracticeVersion_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "PracticeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeSection" ADD CONSTRAINT "PracticeSection_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "PracticeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeItemRef" ADD CONSTRAINT "PracticeItemRef_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "PracticeSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeDelivery" ADD CONSTRAINT "PracticeDelivery_practiceVersionId_fkey" FOREIGN KEY ("practiceVersionId") REFERENCES "PracticeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PracticeDelivery" ADD CONSTRAINT "PracticeDelivery_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentSession" ADD CONSTRAINT "AssessmentSession_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "PracticeDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;
