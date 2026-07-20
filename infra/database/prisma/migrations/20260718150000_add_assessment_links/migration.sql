CREATE TYPE "AssessmentLinkStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');
CREATE TABLE "AssessmentLink" (
  "id" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "assessmentKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "tokenPreview" TEXT NOT NULL,
  "status" "AssessmentLinkStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "maxUses" INTEGER NOT NULL DEFAULT 1,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "createdByUserId" UUID NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssessmentLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AssessmentLink_tokenHash_key" ON "AssessmentLink"("tokenHash");
CREATE INDEX "AssessmentLink_schoolId_status_expiresAt_idx" ON "AssessmentLink"("schoolId", "status", "expiresAt");
CREATE INDEX "AssessmentLink_schoolId_targetType_targetId_idx" ON "AssessmentLink"("schoolId", "targetType", "targetId");
ALTER TABLE "AssessmentLink" ADD CONSTRAINT "AssessmentLink_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentLink" ADD CONSTRAINT "AssessmentLink_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AssessmentLinkAccess" (
  "id" UUID NOT NULL,
  "linkId" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "outcome" TEXT NOT NULL,
  "sessionId" UUID,
  "ipHash" TEXT,
  "userAgentHash" TEXT,
  "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentLinkAccess_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AssessmentLinkAccess_schoolId_accessedAt_idx" ON "AssessmentLinkAccess"("schoolId", "accessedAt");
CREATE INDEX "AssessmentLinkAccess_linkId_accessedAt_idx" ON "AssessmentLinkAccess"("linkId", "accessedAt");
ALTER TABLE "AssessmentLinkAccess" ADD CONSTRAINT "AssessmentLinkAccess_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "AssessmentLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentLinkAccess" ADD CONSTRAINT "AssessmentLinkAccess_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
