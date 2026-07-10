-- Session rows are ephemeral authentication tokens. The old two-row-in-one-table
-- shape is being replaced by an explicit SessionPair + Session relationship.
-- Dropping the old rows forces users to re-login, which is safe and avoids a
-- partial/inconsistent migration of token hashes that were paired by a
-- client-side deterministic UUID algorithm.
TRUNCATE TABLE "Session";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropIndex
DROP INDEX "Session_refreshHash_key";

-- DropIndex
DROP INDEX "Session_userId_expiresAt_idx";

-- AlterTable
ALTER TABLE "Session" DROP COLUMN "activeSchoolId",
DROP COLUMN "lastUsedAt",
DROP COLUMN "refreshHash",
DROP COLUMN "revokedAt",
DROP COLUMN "userId",
ADD COLUMN     "pairId" UUID NOT NULL,
ADD COLUMN     "tokenHash" TEXT NOT NULL,
ADD COLUMN     "type" VARCHAR(10) NOT NULL;

-- CreateTable
CREATE TABLE "SessionPair" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "predecessorPairId" UUID,
    "activeSchoolId" UUID,
    "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionPair_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionPair_userId_refreshExpiresAt_idx" ON "SessionPair"("userId", "refreshExpiresAt");

-- CreateIndex
CREATE INDEX "SessionPair_familyId_idx" ON "SessionPair"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionPair_familyId_predecessorPairId_key" ON "SessionPair"("familyId", "predecessorPairId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Session_pairId_type_key" ON "Session"("pairId", "type");

-- AddForeignKey
ALTER TABLE "SessionPair" ADD CONSTRAINT "SessionPair_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPair" ADD CONSTRAINT "SessionPair_predecessorPairId_fkey" FOREIGN KEY ("predecessorPairId") REFERENCES "SessionPair"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "SessionPair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

