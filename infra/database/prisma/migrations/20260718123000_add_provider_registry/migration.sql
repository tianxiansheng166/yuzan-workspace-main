-- CreateEnum
CREATE TYPE "ProviderCategory" AS ENUM ('SPEECH', 'TRANSLATION', 'AI', 'STORAGE');
CREATE TYPE "ProviderStatus" AS ENUM ('ENABLED', 'DISABLED', 'DEGRADED');
CREATE TYPE "ProviderHealthStatus" AS ENUM ('HEALTHY', 'UNHEALTHY', 'MISCONFIGURED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "ProviderConfig" (
    "id" UUID NOT NULL,
    "category" "ProviderCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "endpoint" TEXT,
    "secretRef" TEXT,
    "status" "ProviderStatus" NOT NULL DEFAULT 'DISABLED',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProviderConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderHealthCheck" (
    "id" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "status" "ProviderHealthStatus" NOT NULL,
    "latencyMs" INTEGER,
    "errorCode" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProviderHealthCheck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderConfig_category_name_key" ON "ProviderConfig"("category", "name");
CREATE INDEX "ProviderConfig_category_status_idx" ON "ProviderConfig"("category", "status");
CREATE INDEX "ProviderHealthCheck_providerId_checkedAt_idx" ON "ProviderHealthCheck"("providerId", "checkedAt");

ALTER TABLE "ProviderConfig" ADD CONSTRAINT "ProviderConfig_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProviderHealthCheck" ADD CONSTRAINT "ProviderHealthCheck_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
