CREATE TYPE "DataPolicyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');
CREATE TYPE "RetentionJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "DataPolicyVersion" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "resourceType" TEXT NOT NULL,
  "retentionDays" INTEGER NOT NULL,
  "status" "DataPolicyStatus" NOT NULL DEFAULT 'DRAFT',
  "rules" JSONB,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DataPolicyVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DataPolicyVersion_name_version_key" ON "DataPolicyVersion"("name", "version");
CREATE INDEX "DataPolicyVersion_resourceType_status_idx" ON "DataPolicyVersion"("resourceType", "status");
ALTER TABLE "DataPolicyVersion" ADD CONSTRAINT "DataPolicyVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PrivacyRetentionJob" (
  "id" UUID NOT NULL,
  "policyId" UUID NOT NULL,
  "schoolId" UUID,
  "cutoffAt" TIMESTAMP(3) NOT NULL,
  "status" "RetentionJobStatus" NOT NULL DEFAULT 'QUEUED',
  "dryRun" BOOLEAN NOT NULL DEFAULT TRUE,
  "scannedCount" INTEGER NOT NULL DEFAULT 0,
  "redactedCount" INTEGER NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  "createdByUserId" UUID NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrivacyRetentionJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PrivacyRetentionJob_schoolId_status_cutoffAt_idx" ON "PrivacyRetentionJob"("schoolId", "status", "cutoffAt");
CREATE INDEX "PrivacyRetentionJob_policyId_createdAt_idx" ON "PrivacyRetentionJob"("policyId", "createdAt");
ALTER TABLE "PrivacyRetentionJob" ADD CONSTRAINT "PrivacyRetentionJob_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "DataPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrivacyRetentionJob" ADD CONSTRAINT "PrivacyRetentionJob_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrivacyRetentionJob" ADD CONSTRAINT "PrivacyRetentionJob_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
