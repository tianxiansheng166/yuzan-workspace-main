CREATE TYPE "PilotFeedbackCategory" AS ENUM ('CONTENT', 'MEDIA', 'RECORDING', 'SCORING', 'USABILITY', 'TECHNICAL', 'OTHER');
CREATE TYPE "PilotFeedbackStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

CREATE TABLE "PilotFeedback" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "reporterUserId" UUID NOT NULL,
  "reporterRole" "MembershipRole" NOT NULL,
  "category" "PilotFeedbackCategory" NOT NULL,
  "status" "PilotFeedbackStatus" NOT NULL DEFAULT 'OPEN',
  "message" VARCHAR(1000) NOT NULL,
  "pageContext" VARCHAR(500),
  "sessionId" UUID,
  "assessmentItemId" UUID,
  "questionVersionId" UUID,
  "handledByUserId" UUID,
  "resolutionNote" VARCHAR(1000),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PilotFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PilotFeedback_schoolId_status_createdAt_idx" ON "PilotFeedback"("schoolId", "status", "createdAt");
CREATE INDEX "PilotFeedback_schoolId_reporterUserId_createdAt_idx" ON "PilotFeedback"("schoolId", "reporterUserId", "createdAt");
CREATE INDEX "PilotFeedback_schoolId_category_createdAt_idx" ON "PilotFeedback"("schoolId", "category", "createdAt");

ALTER TABLE "PilotFeedback" ADD CONSTRAINT "PilotFeedback_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PilotFeedback" ADD CONSTRAINT "PilotFeedback_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PilotFeedback" ADD CONSTRAINT "PilotFeedback_handledByUserId_fkey" FOREIGN KEY ("handledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PilotFeedback" ADD CONSTRAINT "PilotFeedback_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PilotFeedback" ADD CONSTRAINT "PilotFeedback_assessmentItemId_fkey" FOREIGN KEY ("assessmentItemId") REFERENCES "AssessmentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PilotFeedback" ADD CONSTRAINT "PilotFeedback_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionBankItemVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
