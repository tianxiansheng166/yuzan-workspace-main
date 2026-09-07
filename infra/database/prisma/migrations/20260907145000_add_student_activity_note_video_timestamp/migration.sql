ALTER TABLE "StudentActivityNote"
  ADD COLUMN "videoTimestamp" DOUBLE PRECISION;

CREATE INDEX "StudentActivityNote_schoolId_enrollmentId_activityId_videoTimestamp_idx"
  ON "StudentActivityNote"("schoolId", "enrollmentId", "activityId", "videoTimestamp");
