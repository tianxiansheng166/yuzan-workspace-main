-- Promote VOLUNTEER to a first-class membership role.
ALTER TYPE "MembershipRole" ADD VALUE IF NOT EXISTS 'VOLUNTEER';

CREATE TABLE "VolunteerProfile" (
  "id" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "status" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "experience" TEXT,
  "qualifications" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "qualifiedAt" TIMESTAMP(3),
  "suspendedReason" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VolunteerProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VolunteerServiceTask" (
  "id" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "serviceType" TEXT NOT NULL,
  "classId" UUID,
  "studentScope" TEXT NOT NULL,
  "supervisorTeacherId" UUID NOT NULL,
  "requiredQualification" TEXT NOT NULL,
  "assignedVolunteerId" UUID,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VolunteerServiceTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VolunteerIncident" (
  "id" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "immediateAction" TEXT,
  "studentRef" TEXT,
  "assignedReviewerId" UUID,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "resolution" TEXT,
  "reportedBy" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VolunteerIncident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainingProgram" (
  "id" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "objectives" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "locale" TEXT NOT NULL DEFAULT 'zh-CN',
  "dialect" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrainingProgram_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainingModule" (
  "id" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "programId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "durationMinutes" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrainingModule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainingEnrollment" (
  "id" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "programId" UUID NOT NULL,
  "volunteerUserId" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ENROLLED',
  "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "examReady" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrainingEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainingProgress" (
  "id" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "enrollmentId" UUID NOT NULL,
  "moduleId" UUID NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "score" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrainingProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainingExam" (
  "id" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "programId" UUID NOT NULL,
  "enrollmentId" UUID NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "passingScore" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrainingExam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainingExamAttempt" (
  "id" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "examId" UUID NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "passed" BOOLEAN NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrainingExamAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportPairing" (
  "id" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "studentUserId" UUID NOT NULL,
  "volunteerUserId" UUID NOT NULL,
  "supervisorTeacherId" UUID NOT NULL,
  "consentStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "goal" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_CONSENT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportPairing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportSession" (
  "id" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "pairingId" UUID NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "summary" TEXT,
  "nextStep" TEXT,
  "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
  "teacherReviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VolunteerProfile_schoolId_id_key" ON "VolunteerProfile"("schoolId", "id");
CREATE UNIQUE INDEX "VolunteerProfile_schoolId_userId_key" ON "VolunteerProfile"("schoolId", "userId");
CREATE INDEX "VolunteerProfile_schoolId_status_appliedAt_idx" ON "VolunteerProfile"("schoolId", "status", "appliedAt");
CREATE UNIQUE INDEX "VolunteerServiceTask_schoolId_id_key" ON "VolunteerServiceTask"("schoolId", "id");
CREATE INDEX "VolunteerServiceTask_schoolId_assignedVolunteerId_status_idx" ON "VolunteerServiceTask"("schoolId", "assignedVolunteerId", "status");
CREATE UNIQUE INDEX "VolunteerIncident_schoolId_id_key" ON "VolunteerIncident"("schoolId", "id");
CREATE INDEX "VolunteerIncident_schoolId_severity_status_createdAt_idx" ON "VolunteerIncident"("schoolId", "severity", "status", "createdAt");
CREATE UNIQUE INDEX "TrainingProgram_schoolId_id_key" ON "TrainingProgram"("schoolId", "id");
CREATE INDEX "TrainingProgram_schoolId_status_createdAt_idx" ON "TrainingProgram"("schoolId", "status", "createdAt");
CREATE UNIQUE INDEX "TrainingModule_schoolId_id_key" ON "TrainingModule"("schoolId", "id");
CREATE UNIQUE INDEX "TrainingModule_schoolId_programId_sortOrder_key" ON "TrainingModule"("schoolId", "programId", "sortOrder");
CREATE INDEX "TrainingModule_schoolId_programId_idx" ON "TrainingModule"("schoolId", "programId");
CREATE UNIQUE INDEX "TrainingEnrollment_schoolId_id_key" ON "TrainingEnrollment"("schoolId", "id");
CREATE UNIQUE INDEX "TrainingEnrollment_schoolId_programId_volunteerUserId_key" ON "TrainingEnrollment"("schoolId", "programId", "volunteerUserId");
CREATE INDEX "TrainingEnrollment_schoolId_volunteerUserId_status_idx" ON "TrainingEnrollment"("schoolId", "volunteerUserId", "status");
CREATE UNIQUE INDEX "TrainingProgress_schoolId_enrollmentId_moduleId_key" ON "TrainingProgress"("schoolId", "enrollmentId", "moduleId");
CREATE INDEX "TrainingProgress_schoolId_enrollmentId_idx" ON "TrainingProgress"("schoolId", "enrollmentId");
CREATE UNIQUE INDEX "TrainingExam_schoolId_id_key" ON "TrainingExam"("schoolId", "id");
CREATE INDEX "TrainingExam_schoolId_enrollmentId_status_idx" ON "TrainingExam"("schoolId", "enrollmentId", "status");
CREATE UNIQUE INDEX "TrainingExamAttempt_schoolId_id_key" ON "TrainingExamAttempt"("schoolId", "id");
CREATE INDEX "TrainingExamAttempt_schoolId_examId_submittedAt_idx" ON "TrainingExamAttempt"("schoolId", "examId", "submittedAt");
CREATE UNIQUE INDEX "SupportPairing_schoolId_id_key" ON "SupportPairing"("schoolId", "id");
CREATE INDEX "SupportPairing_schoolId_volunteerUserId_status_idx" ON "SupportPairing"("schoolId", "volunteerUserId", "status");
CREATE INDEX "SupportPairing_schoolId_studentUserId_status_idx" ON "SupportPairing"("schoolId", "studentUserId", "status");
CREATE UNIQUE INDEX "SupportSession_schoolId_id_key" ON "SupportSession"("schoolId", "id");
CREATE INDEX "SupportSession_schoolId_pairingId_scheduledAt_idx" ON "SupportSession"("schoolId", "pairingId", "scheduledAt");

ALTER TABLE "VolunteerProfile" ADD CONSTRAINT "VolunteerProfile_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VolunteerProfile" ADD CONSTRAINT "VolunteerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VolunteerServiceTask" ADD CONSTRAINT "VolunteerServiceTask_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VolunteerIncident" ADD CONSTRAINT "VolunteerIncident_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingProgram" ADD CONSTRAINT "TrainingProgram_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingModule" ADD CONSTRAINT "TrainingModule_schoolId_programId_fkey" FOREIGN KEY ("schoolId", "programId") REFERENCES "TrainingProgram"("schoolId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingEnrollment" ADD CONSTRAINT "TrainingEnrollment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingEnrollment" ADD CONSTRAINT "TrainingEnrollment_schoolId_programId_fkey" FOREIGN KEY ("schoolId", "programId") REFERENCES "TrainingProgram"("schoolId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingEnrollment" ADD CONSTRAINT "TrainingEnrollment_volunteerUserId_fkey" FOREIGN KEY ("volunteerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingProgress" ADD CONSTRAINT "TrainingProgress_schoolId_enrollmentId_fkey" FOREIGN KEY ("schoolId", "enrollmentId") REFERENCES "TrainingEnrollment"("schoolId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingProgress" ADD CONSTRAINT "TrainingProgress_schoolId_moduleId_fkey" FOREIGN KEY ("schoolId", "moduleId") REFERENCES "TrainingModule"("schoolId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingExam" ADD CONSTRAINT "TrainingExam_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingExam" ADD CONSTRAINT "TrainingExam_schoolId_programId_fkey" FOREIGN KEY ("schoolId", "programId") REFERENCES "TrainingProgram"("schoolId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingExam" ADD CONSTRAINT "TrainingExam_schoolId_enrollmentId_fkey" FOREIGN KEY ("schoolId", "enrollmentId") REFERENCES "TrainingEnrollment"("schoolId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingExamAttempt" ADD CONSTRAINT "TrainingExamAttempt_schoolId_examId_fkey" FOREIGN KEY ("schoolId", "examId") REFERENCES "TrainingExam"("schoolId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportPairing" ADD CONSTRAINT "SupportPairing_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportSession" ADD CONSTRAINT "SupportSession_schoolId_pairingId_fkey" FOREIGN KEY ("schoolId", "pairingId") REFERENCES "SupportPairing"("schoolId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
