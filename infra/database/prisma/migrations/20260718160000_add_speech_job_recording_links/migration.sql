-- AlterTable: SpeechJob - add recording/assessment links and make old FK optional
ALTER TABLE "SpeechJob" ALTER COLUMN "submissionId" DROP NOT NULL;
ALTER TABLE "SpeechJob" ALTER COLUMN "audioAssetId" DROP NOT NULL;
ALTER TABLE "SpeechJob" ADD COLUMN "recordingId" UUID;
ALTER TABLE "SpeechJob" ADD COLUMN "assessmentItemId" UUID;
ALTER TABLE "SpeechJob" ADD COLUMN "schoolId" UUID;
ALTER TABLE "SpeechJob" ADD COLUMN "targetText" TEXT;
ALTER TABLE "SpeechJob" ADD COLUMN "scorerVersion" TEXT;
ALTER TABLE "SpeechJob" ADD COLUMN "maxRetries" INTEGER NOT NULL DEFAULT 3;

-- AlterTable: AssessmentItem - add reviewerComment
ALTER TABLE "AssessmentItem" ADD COLUMN "reviewerComment" TEXT;

-- CreateIndex: SpeechJob new indexes
CREATE INDEX "SpeechJob_recordingId_idx" ON "SpeechJob"("recordingId");
CREATE INDEX "SpeechJob_assessmentItemId_idx" ON "SpeechJob"("assessmentItemId");

-- AddForeignKey: SpeechJob new foreign keys
ALTER TABLE "SpeechJob" ADD CONSTRAINT "SpeechJob_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpeechJob" ADD CONSTRAINT "SpeechJob_assessmentItemId_fkey" FOREIGN KEY ("assessmentItemId") REFERENCES "AssessmentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
