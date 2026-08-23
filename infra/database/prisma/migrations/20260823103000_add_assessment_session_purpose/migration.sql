CREATE TYPE "AssessmentSessionPurpose" AS ENUM ('STANDARD', 'REMEDIATION');

ALTER TABLE "AssessmentSession"
ADD COLUMN "purpose" "AssessmentSessionPurpose" NOT NULL DEFAULT 'STANDARD';

CREATE INDEX "AssessmentSession_schoolId_enrollmentId_retestOfSessionId_purpose_status_idx"
ON "AssessmentSession"("schoolId", "enrollmentId", "retestOfSessionId", "purpose", "status");
