CREATE TABLE "CourseFavorite" (
  "id" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "enrollmentId" UUID NOT NULL,
  "courseVersionId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseFavorite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseFavorite_schoolId_id_key" ON "CourseFavorite"("schoolId", "id");
CREATE UNIQUE INDEX "CourseFavorite_enrollmentId_courseVersionId_key" ON "CourseFavorite"("enrollmentId", "courseVersionId");
CREATE INDEX "CourseFavorite_schoolId_enrollmentId_idx" ON "CourseFavorite"("schoolId", "enrollmentId");
CREATE INDEX "CourseFavorite_courseVersionId_idx" ON "CourseFavorite"("courseVersionId");

ALTER TABLE "CourseFavorite" ADD CONSTRAINT "CourseFavorite_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseFavorite" ADD CONSTRAINT "CourseFavorite_schoolId_enrollmentId_fkey" FOREIGN KEY ("schoolId", "enrollmentId") REFERENCES "Enrollment"("schoolId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseFavorite" ADD CONSTRAINT "CourseFavorite_courseVersionId_fkey" FOREIGN KEY ("courseVersionId") REFERENCES "CourseVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
