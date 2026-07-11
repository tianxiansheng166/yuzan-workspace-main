-- Add bilingual teacher/student notes, JSON instruction, and per-reference
-- resource metadata for curriculum activity persistence.

ALTER TABLE "LearningActivity" ALTER COLUMN "instruction" TYPE JSONB USING NULL;
ALTER TABLE "LearningActivity" ADD COLUMN "teacherNotes" JSONB;
ALTER TABLE "LearningActivity" ADD COLUMN "studentNotes" JSONB;

ALTER TABLE "ActivityResource" ADD COLUMN "meta" JSONB;
