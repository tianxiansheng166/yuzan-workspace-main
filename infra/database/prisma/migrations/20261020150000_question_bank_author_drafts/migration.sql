ALTER TABLE "QuestionBankItemVersion"
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "authorUserId" UUID;

ALTER TABLE "QuestionBankItemVersion"
  ADD CONSTRAINT "QuestionBankItemVersion_authorUserId_fkey"
  FOREIGN KEY ("authorUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "QuestionBankItemVersion_authorUserId_status_updatedAt_idx"
  ON "QuestionBankItemVersion"("authorUserId", "status", "updatedAt");
