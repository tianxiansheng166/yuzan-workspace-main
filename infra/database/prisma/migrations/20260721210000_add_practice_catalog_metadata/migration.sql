ALTER TABLE "PracticeDefinition"
  ADD COLUMN "gradeBand" TEXT NOT NULL DEFAULT '七年级',
  ADD COLUMN "abilityCategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "cultureTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "catalogType" TEXT NOT NULL DEFAULT 'COMPREHENSIVE',
  ADD COLUMN "requiresRecording" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "instantFeedback" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "PracticeDefinition_gradeBand_difficulty_idx"
  ON "PracticeDefinition"("gradeBand", "difficulty");

CREATE TABLE "PracticeFavorite" (
  "id" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "definitionId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PracticeFavorite_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PracticeFavorite_definitionId_fkey"
    FOREIGN KEY ("definitionId") REFERENCES "PracticeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PracticeFavorite_schoolId_studentId_definitionId_key"
  ON "PracticeFavorite"("schoolId", "studentId", "definitionId");
CREATE INDEX "PracticeFavorite_schoolId_studentId_createdAt_idx"
  ON "PracticeFavorite"("schoolId", "studentId", "createdAt");
