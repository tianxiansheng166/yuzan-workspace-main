-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('STUDENT_GROWTH', 'CLASS_SUMMARY', 'SCHOOL_OVERVIEW');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'GENERATING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "SyncBatchStatus" AS ENUM ('ACCEPTED', 'DUPLICATE', 'CONFLICT', 'REJECTED', 'PERMISSION_CHANGED');

-- AlterEnum
ALTER TYPE "SyncCursorEntityType" ADD VALUE 'REPORT';

-- CreateTable
CREATE TABLE "Report" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "type" "ReportType" NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "filters" JSONB,
    "dataCompleteness" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "providerDisclosure" TEXT NOT NULL DEFAULT '',
    "generatedAt" TIMESTAMP(3),
    "generatedByUserId" UUID,
    "enrollmentId" UUID,
    "classId" UUID,
    "data" JSONB,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfflineContentPackage" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "courseVersionId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "checksum" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "byteSize" BIGINT NOT NULL DEFAULT 0,
    "downloadRequired" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfflineContentPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncBatch" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "clientBatchId" TEXT NOT NULL,
    "status" "SyncBatchStatus" NOT NULL DEFAULT 'ACCEPTED',
    "operationCount" INTEGER NOT NULL DEFAULT 0,
    "acceptedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "conflictCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "permissionChanged" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Report_schoolId_type_status_idx" ON "Report"("schoolId", "type", "status");

-- CreateIndex
CREATE INDEX "Report_schoolId_periodStart_periodEnd_idx" ON "Report"("schoolId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "Report_enrollmentId_idx" ON "Report"("enrollmentId");

-- CreateIndex
CREATE INDEX "Report_classId_idx" ON "Report"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_schoolId_id_key" ON "Report"("schoolId", "id");

-- CreateIndex
CREATE INDEX "OfflineContentPackage_schoolId_courseVersionId_version_idx" ON "OfflineContentPackage"("schoolId", "courseVersionId", "version");

-- CreateIndex
CREATE INDEX "OfflineContentPackage_schoolId_expiresAt_idx" ON "OfflineContentPackage"("schoolId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OfflineContentPackage_schoolId_id_key" ON "OfflineContentPackage"("schoolId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SyncBatch_clientBatchId_key" ON "SyncBatch"("clientBatchId");

-- CreateIndex
CREATE INDEX "SyncBatch_schoolId_deviceId_status_idx" ON "SyncBatch"("schoolId", "deviceId", "status");

-- CreateIndex
CREATE INDEX "SyncBatch_schoolId_createdAt_idx" ON "SyncBatch"("schoolId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncBatch_schoolId_id_key" ON "SyncBatch"("schoolId", "id");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineContentPackage" ADD CONSTRAINT "OfflineContentPackage_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineContentPackage" ADD CONSTRAINT "OfflineContentPackage_schoolId_courseVersionId_fkey" FOREIGN KEY ("schoolId", "courseVersionId") REFERENCES "CourseVersion"("schoolId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncBatch" ADD CONSTRAINT "SyncBatch_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
