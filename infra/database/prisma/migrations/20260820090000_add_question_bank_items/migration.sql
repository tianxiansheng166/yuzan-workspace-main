-- Question Bank v1 is independent from course Question and Practice content.
-- Only deliverySpec is copied to AssessmentItem; scoringSpec remains available
-- through the backend-only QuestionBankItemVersion relation.
CREATE TYPE "QuestionBankItemVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

CREATE TABLE "QuestionBankItem" (
  "id" UUID NOT NULL,
  "schoolId" UUID,
  "stableKey" TEXT NOT NULL,
  "domain" TEXT,
  "questionType" TEXT,
  "level" TEXT,
  "abilityCategory" TEXT,
  "gradeBand" TEXT,
  "difficulty" TEXT,
  "itemType" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuestionBankItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuestionBankItemVersion" (
  "id" UUID NOT NULL,
  "itemId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "deliverySpec" JSONB NOT NULL,
  "scoringSpec" JSONB NOT NULL,
  "status" "QuestionBankItemVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuestionBankItemVersion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PracticeItemRef" ADD COLUMN "questionVersionId" UUID;
ALTER TABLE "AssessmentItem" ADD COLUMN "questionVersionId" UUID;

CREATE UNIQUE INDEX "QuestionBankItem_stableKey_key"
  ON "QuestionBankItem"("stableKey");
CREATE UNIQUE INDEX "QuestionBankItemVersion_itemId_version_key"
  ON "QuestionBankItemVersion"("itemId", "version");
CREATE INDEX "QuestionBankItem_schoolId_domain_questionType_idx"
  ON "QuestionBankItem"("schoolId", "domain", "questionType");
CREATE INDEX "QuestionBankItem_gradeBand_difficulty_itemType_idx"
  ON "QuestionBankItem"("gradeBand", "difficulty", "itemType");
CREATE INDEX "QuestionBankItemVersion_status_publishedAt_idx"
  ON "QuestionBankItemVersion"("status", "publishedAt");
CREATE INDEX "PracticeItemRef_questionVersionId_idx"
  ON "PracticeItemRef"("questionVersionId");
CREATE INDEX "AssessmentItem_questionVersionId_idx"
  ON "AssessmentItem"("questionVersionId");

ALTER TABLE "QuestionBankItem"
  ADD CONSTRAINT "QuestionBankItem_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestionBankItemVersion"
  ADD CONSTRAINT "QuestionBankItemVersion_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "QuestionBankItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeItemRef"
  ADD CONSTRAINT "PracticeItemRef_questionVersionId_fkey"
  FOREIGN KEY ("questionVersionId") REFERENCES "QuestionBankItemVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentItem"
  ADD CONSTRAINT "AssessmentItem_questionVersionId_fkey"
  FOREIGN KEY ("questionVersionId") REFERENCES "QuestionBankItemVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
