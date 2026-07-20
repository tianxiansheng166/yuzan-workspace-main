ALTER TABLE "PrivacyRequest"
  ADD COLUMN "executionSnapshot" JSONB,
  ADD COLUMN "revokedAt" TIMESTAMP(3),
  ADD COLUMN "revokedByUserId" UUID;

CREATE INDEX "PrivacyRequest_revokedByUserId_idx" ON "PrivacyRequest"("revokedByUserId");

ALTER TABLE "PrivacyRequest"
  ADD CONSTRAINT "PrivacyRequest_revokedByUserId_fkey"
  FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
