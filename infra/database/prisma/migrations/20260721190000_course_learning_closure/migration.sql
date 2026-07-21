ALTER TABLE "CourseVersion"
  ADD COLUMN "capabilityTheme" TEXT,
  ADD COLUMN "difficulty" TEXT,
  ADD COLUMN "estimatedMinutes" INTEGER,
  ADD COLUMN "coverAsset" TEXT,
  ADD COLUMN "deviceRequirements" JSONB;

ALTER TABLE "Assignment"
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'TEACHER_ASSIGNED';

ALTER TABLE "Recording"
  ADD COLUMN "activityAttemptId" UUID;

ALTER TABLE "AssessmentSession"
  ADD COLUMN "courseActivityId" UUID,
  ADD COLUMN "courseSubmissionId" UUID;

CREATE TABLE "StudentActivityNote" (
  "id" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "enrollmentId" UUID NOT NULL,
  "activityId" UUID NOT NULL,
  "content" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentActivityNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseActivityPractice" (
  "id" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "activityId" UUID NOT NULL,
  "practiceDefinitionId" UUID NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseActivityPractice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Recording_activityAttemptId_key" ON "Recording"("activityAttemptId");
CREATE INDEX "AssessmentSession_courseActivityId_courseSubmissionId_status_idx" ON "AssessmentSession"("courseActivityId", "courseSubmissionId", "status");
CREATE UNIQUE INDEX "StudentActivityNote_schoolId_id_key" ON "StudentActivityNote"("schoolId", "id");
CREATE UNIQUE INDEX "StudentActivityNote_enrollmentId_activityId_key" ON "StudentActivityNote"("enrollmentId", "activityId");
CREATE INDEX "StudentActivityNote_schoolId_enrollmentId_updatedAt_idx" ON "StudentActivityNote"("schoolId", "enrollmentId", "updatedAt");
CREATE UNIQUE INDEX "CourseActivityPractice_activityId_key" ON "CourseActivityPractice"("activityId");
CREATE UNIQUE INDEX "CourseActivityPractice_schoolId_id_key" ON "CourseActivityPractice"("schoolId", "id");
CREATE INDEX "CourseActivityPractice_schoolId_practiceDefinitionId_idx" ON "CourseActivityPractice"("schoolId", "practiceDefinitionId");

ALTER TABLE "Recording" ADD CONSTRAINT "Recording_activityAttemptId_fkey" FOREIGN KEY ("activityAttemptId") REFERENCES "ActivityAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssessmentSession" ADD CONSTRAINT "AssessmentSession_courseActivityId_fkey" FOREIGN KEY ("courseActivityId") REFERENCES "LearningActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssessmentSession" ADD CONSTRAINT "AssessmentSession_courseSubmissionId_fkey" FOREIGN KEY ("courseSubmissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentActivityNote" ADD CONSTRAINT "StudentActivityNote_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentActivityNote" ADD CONSTRAINT "StudentActivityNote_schoolId_enrollmentId_fkey" FOREIGN KEY ("schoolId", "enrollmentId") REFERENCES "Enrollment"("schoolId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentActivityNote" ADD CONSTRAINT "StudentActivityNote_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "LearningActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseActivityPractice" ADD CONSTRAINT "CourseActivityPractice_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseActivityPractice" ADD CONSTRAINT "CourseActivityPractice_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "LearningActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseActivityPractice" ADD CONSTRAINT "CourseActivityPractice_practiceDefinitionId_fkey" FOREIGN KEY ("practiceDefinitionId") REFERENCES "PracticeDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
