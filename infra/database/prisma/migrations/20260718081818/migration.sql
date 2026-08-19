-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ASSESSMENT_ASSIGNED';

-- DropIndex
DROP INDEX IF EXISTS "PrivacyRequest_revokedByUserId_idx";

-- AlterTable
ALTER TABLE "SpeechJob" ALTER COLUMN "targetTextVersion" SET DEFAULT '';
