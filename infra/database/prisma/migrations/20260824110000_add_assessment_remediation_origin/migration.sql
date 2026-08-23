CREATE TYPE "AssessmentRemediationOrigin" AS ENUM ('SELF_INITIATED', 'TEACHER_ASSIGNED');

ALTER TABLE "AssessmentSession"
ADD COLUMN "remediationOrigin" "AssessmentRemediationOrigin",
ADD COLUMN "remediationFocus" JSONB;

CREATE INDEX "AssessmentSession_schoolId_enrollmentId_retestOfSessionId_remediationOrigin_status_idx"
ON "AssessmentSession"("schoolId", "enrollmentId", "retestOfSessionId", "remediationOrigin", "status");
