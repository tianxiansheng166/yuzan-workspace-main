-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ASSESSMENT_ASSIGNED';

-- DropIndex
DROP INDEX "PrivacyRequest_revokedByUserId_idx";

-- AlterTable
ALTER TABLE "SpeechJob" ALTER COLUMN "targetTextVersion" SET DEFAULT '';
