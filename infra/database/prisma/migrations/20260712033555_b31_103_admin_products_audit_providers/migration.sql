-- CreateEnum
CREATE TYPE "ProductPlanTier" AS ENUM ('INCLUSIVE', 'PROFESSIONAL', 'FLAGSHIP');

-- CreateEnum
CREATE TYPE "RecommendationRuleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AssessmentMaterialType" AS ENUM ('READING', 'WRITTEN_FORM', 'DIMENSION');

-- CreateEnum
CREATE TYPE "AssessmentMaterialStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AssessmentLinkStatus" AS ENUM ('ACTIVE', 'DISABLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DeletionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('SPEECH', 'LLM', 'TRANSLATION', 'EMBEDDING', 'OTHER');

-- CreateEnum
CREATE TYPE "ProviderHealthStatus" AS ENUM ('UNKNOWN', 'HEALTHY', 'DEGRADED', 'DOWN');

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "planId" UUID;

-- CreateTable
CREATE TABLE "ProductPlan" (
    "id" UUID NOT NULL,
    "tier" "ProductPlanTier" NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "priceMinCents" INTEGER NOT NULL DEFAULT 0,
    "priceMaxCents" INTEGER NOT NULL DEFAULT 0,
    "discountFactor" INTEGER NOT NULL DEFAULT 10000,
    "serviceItems" JSONB,
    "fundingSource" TEXT,
    "publicVersion" INTEGER NOT NULL DEFAULT 1,
    "contractVersion" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPlanVersion" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "displayName" TEXT NOT NULL,
    "priceMinCents" INTEGER NOT NULL DEFAULT 0,
    "priceMaxCents" INTEGER NOT NULL DEFAULT 0,
    "discountFactor" INTEGER NOT NULL DEFAULT 10000,
    "serviceItems" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductPlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationRule" (
    "id" UUID NOT NULL,
    "issueCode" TEXT NOT NULL,
    "dimensionCode" TEXT NOT NULL,
    "severityMin" INTEGER NOT NULL,
    "severityMax" INTEGER NOT NULL,
    "courseVersionId" UUID NOT NULL,
    "priority" INTEGER NOT NULL,
    "sessions" INTEGER NOT NULL DEFAULT 1,
    "reasonTemplate" TEXT,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "RecommendationRuleStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecommendationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentMaterial" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "type" "AssessmentMaterialType" NOT NULL,
    "content" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "AssessmentMaterialStatus" NOT NULL DEFAULT 'DRAFT',
    "previewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentLink" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "AssessmentLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "regeneratedFromId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionPolicy" (
    "id" UUID NOT NULL,
    "resourceType" TEXT NOT NULL,
    "retentionDays" INTEGER NOT NULL,
    "description" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentVersion" (
    "id" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "contentUrl" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataDeletionRequest" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "schoolId" UUID,
    "status" "DeletionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataDeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemProvider" (
    "id" UUID NOT NULL,
    "type" "ProviderType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "endpointAlias" TEXT,
    "model" TEXT,
    "healthStatus" "ProviderHealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "configured" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemProviderSecret" (
    "id" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "secretKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemProviderSecret_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductPlan_tier_isActive_idx" ON "ProductPlan"("tier", "isActive");

-- CreateIndex
CREATE INDEX "ProductPlan_effectiveFrom_effectiveUntil_idx" ON "ProductPlan"("effectiveFrom", "effectiveUntil");

-- CreateIndex
CREATE INDEX "ProductPlanVersion_planId_publishedAt_idx" ON "ProductPlanVersion"("planId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPlanVersion_planId_version_key" ON "ProductPlanVersion"("planId", "version");

-- CreateIndex
CREATE INDEX "RecommendationRule_issueCode_dimensionCode_status_idx" ON "RecommendationRule"("issueCode", "dimensionCode", "status");

-- CreateIndex
CREATE INDEX "RecommendationRule_status_priority_idx" ON "RecommendationRule"("status", "priority");

-- CreateIndex
CREATE INDEX "RecommendationRule_validFrom_validUntil_idx" ON "RecommendationRule"("validFrom", "validUntil");

-- CreateIndex
CREATE INDEX "AssessmentMaterial_schoolId_type_status_idx" ON "AssessmentMaterial"("schoolId", "type", "status");

-- CreateIndex
CREATE INDEX "AssessmentMaterial_schoolId_status_idx" ON "AssessmentMaterial"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentLink_tokenHash_key" ON "AssessmentLink"("tokenHash");

-- CreateIndex
CREATE INDEX "AssessmentLink_schoolId_assignmentId_idx" ON "AssessmentLink"("schoolId", "assignmentId");

-- CreateIndex
CREATE INDEX "AssessmentLink_schoolId_status_idx" ON "AssessmentLink"("schoolId", "status");

-- CreateIndex
CREATE INDEX "AssessmentLink_tokenHash_idx" ON "AssessmentLink"("tokenHash");

-- CreateIndex
CREATE INDEX "AssessmentLink_expiresAt_idx" ON "AssessmentLink"("expiresAt");

-- CreateIndex
CREATE INDEX "RetentionPolicy_effectiveFrom_idx" ON "RetentionPolicy"("effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "RetentionPolicy_resourceType_key" ON "RetentionPolicy"("resourceType");

-- CreateIndex
CREATE INDEX "ConsentVersion_purpose_effectiveFrom_idx" ON "ConsentVersion"("purpose", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentVersion_purpose_version_key" ON "ConsentVersion"("purpose", "version");

-- CreateIndex
CREATE INDEX "DataDeletionRequest_userId_status_idx" ON "DataDeletionRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "DataDeletionRequest_schoolId_status_idx" ON "DataDeletionRequest"("schoolId", "status");

-- CreateIndex
CREATE INDEX "DataDeletionRequest_status_requestedAt_idx" ON "DataDeletionRequest"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "SystemProvider_type_enabled_idx" ON "SystemProvider"("type", "enabled");

-- CreateIndex
CREATE INDEX "SystemProvider_healthStatus_idx" ON "SystemProvider"("healthStatus");

-- CreateIndex
CREATE INDEX "SystemProviderSecret_providerId_idx" ON "SystemProviderSecret"("providerId");

-- CreateIndex
CREATE INDEX "School_planId_idx" ON "School"("planId");

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ProductPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPlanVersion" ADD CONSTRAINT "ProductPlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ProductPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemProviderSecret" ADD CONSTRAINT "SystemProviderSecret_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "SystemProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
