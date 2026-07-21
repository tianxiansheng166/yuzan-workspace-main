-- A teacher invitation is deliberately distinct from InviteCode: it grants a
-- student a single class enrollment, while InviteCode remains account onboarding.
CREATE TABLE "TeacherInvitation" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "classId" UUID NOT NULL,
    "teacherUserId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 30,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeacherInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeacherInvitation_code_key" ON "TeacherInvitation"("code");
CREATE UNIQUE INDEX "TeacherInvitation_schoolId_id_key" ON "TeacherInvitation"("schoolId", "id");
CREATE INDEX "TeacherInvitation_schoolId_teacherUserId_createdAt_idx" ON "TeacherInvitation"("schoolId", "teacherUserId", "createdAt");
CREATE INDEX "TeacherInvitation_schoolId_classId_expiresAt_idx" ON "TeacherInvitation"("schoolId", "classId", "expiresAt");

ALTER TABLE "TeacherInvitation" ADD CONSTRAINT "TeacherInvitation_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherInvitation" ADD CONSTRAINT "TeacherInvitation_schoolId_classId_fkey"
  FOREIGN KEY ("schoolId", "classId") REFERENCES "Class"("schoolId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
