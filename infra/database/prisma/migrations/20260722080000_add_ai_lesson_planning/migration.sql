-- AlterTable: Add AI generation job and lesson plan draft reverse relations to "School"
-- (Prisma will handle the reverse relation automatically via the @@unique and @@index)

-- CreateEnum
CREATE TYPE "AiWorkflowStatus" AS ENUM ('ACTIVE', 'DISABLED', 'DEPRECATED');
CREATE TYPE "AiPromptStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "AiJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'PROVIDER_NOT_CONFIGURED', 'PROVIDER_UNAVAILABLE', 'OUTPUT_SCHEMA_INVALID', 'TIMEOUT');
CREATE TYPE "LessonPlanDraftStatus" AS ENUM ('NEEDS_REVIEW', 'APPROVED');
CREATE TYPE "LessonPlanRevisionSource" AS ENUM ('AI_GENERATION', 'TEACHER_EDIT', 'TEACHER_APPROVE');

-- CreateTable
CREATE TABLE "AiWorkflowDefinition" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" TEXT NOT NULL DEFAULT 'flowise',
    "externalFlowId" TEXT,
    "workflowKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "status" "AiWorkflowStatus" NOT NULL DEFAULT 'ACTIVE',
    "inputSchemaVersion" TEXT,
    "outputSchemaVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiWorkflowDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiPromptVersion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflowKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "systemPromptHash" TEXT NOT NULL,
    "templateSnapshot" JSONB,
    "status" "AiPromptStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiPromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiGenerationJob" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "schoolId" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "workflowDefinitionId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "AiJobStatus" NOT NULL DEFAULT 'QUEUED',
    "inputSnapshot" JSONB,
    "outputSnapshot" JSONB,
    "errorCode" TEXT,
    "providerRequestId" TEXT,
    "tokenUsage" JSONB,
    "latencyMs" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiGenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonPlanDraft" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "schoolId" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "courseVersionId" UUID,
    "lessonId" UUID,
    "generationJobId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" "LessonPlanDraftStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonPlanDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonPlanRevision" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "draftId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "source" "LessonPlanRevisionSource" NOT NULL,
    "editorUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonPlanRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiWorkflowDefinition_workflowKey_key" ON "AiWorkflowDefinition"("workflowKey");
CREATE INDEX "AiWorkflowDefinition_workflowKey_status_idx" ON "AiWorkflowDefinition"("workflowKey", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AiPromptVersion_workflowKey_version_key" ON "AiPromptVersion"("workflowKey", "version");
CREATE INDEX "AiPromptVersion_workflowKey_status_idx" ON "AiPromptVersion"("workflowKey", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AiGenerationJob_idempotencyKey_key" ON "AiGenerationJob"("idempotencyKey");
CREATE UNIQUE INDEX "AiGenerationJob_schoolId_id_key" ON "AiGenerationJob"("schoolId", "id");
CREATE INDEX "AiGenerationJob_schoolId_teacherId_status_createdAt_idx" ON "AiGenerationJob"("schoolId", "teacherId", "status", "createdAt");
CREATE INDEX "AiGenerationJob_status_createdAt_idx" ON "AiGenerationJob"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LessonPlanDraft_generationJobId_key" ON "LessonPlanDraft"("generationJobId");
CREATE UNIQUE INDEX "LessonPlanDraft_schoolId_id_key" ON "LessonPlanDraft"("schoolId", "id");
CREATE INDEX "LessonPlanDraft_schoolId_teacherId_status_updatedAt_idx" ON "LessonPlanDraft"("schoolId", "teacherId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LessonPlanRevision_draftId_revision_key" ON "LessonPlanRevision"("draftId", "revision");
CREATE INDEX "LessonPlanRevision_draftId_createdAt_idx" ON "LessonPlanRevision"("draftId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiPromptVersion" ADD CONSTRAINT "AiPromptVersion_workflowKey_fkey" FOREIGN KEY ("workflowKey") REFERENCES "AiWorkflowDefinition"("workflowKey") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiGenerationJob" ADD CONSTRAINT "AiGenerationJob_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiGenerationJob" ADD CONSTRAINT "AiGenerationJob_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiGenerationJob" ADD CONSTRAINT "AiGenerationJob_workflowDefinitionId_fkey" FOREIGN KEY ("workflowDefinitionId") REFERENCES "AiWorkflowDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LessonPlanDraft" ADD CONSTRAINT "LessonPlanDraft_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonPlanDraft" ADD CONSTRAINT "LessonPlanDraft_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LessonPlanDraft" ADD CONSTRAINT "LessonPlanDraft_generationJobId_fkey" FOREIGN KEY ("generationJobId") REFERENCES "AiGenerationJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LessonPlanRevision" ADD CONSTRAINT "LessonPlanRevision_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "LessonPlanDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
