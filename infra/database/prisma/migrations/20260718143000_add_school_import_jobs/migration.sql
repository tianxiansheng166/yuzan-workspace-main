CREATE TYPE "SchoolImportStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TABLE "SchoolImportJob" (
  "id" UUID NOT NULL,
  "fileHash" TEXT NOT NULL,
  "status" "SchoolImportStatus" NOT NULL DEFAULT 'QUEUED',
  "rowCount" INTEGER NOT NULL DEFAULT 0,
  "successCount" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "rowErrors" JSONB,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "SchoolImportJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SchoolImportJob_fileHash_key" ON "SchoolImportJob"("fileHash");
CREATE INDEX "SchoolImportJob_status_createdAt_idx" ON "SchoolImportJob"("status", "createdAt");
ALTER TABLE "SchoolImportJob" ADD CONSTRAINT "SchoolImportJob_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
