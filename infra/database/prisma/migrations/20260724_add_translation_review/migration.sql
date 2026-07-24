-- CreateTable
CREATE TABLE "translation_jobs" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "source_language" TEXT NOT NULL,
    "target_language" TEXT NOT NULL,
    "source_text_hash" TEXT NOT NULL,
    "source_text_encrypted" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "machine_result" TEXT,
    "revised_result" TEXT,
    "review_status" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "glossary_version" INTEGER NOT NULL DEFAULT 1,
    "provider" TEXT,
    "provider_request_id" TEXT,
    "provider_model" TEXT,
    "provider_latency_ms" INTEGER,
    "error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "translation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translation_glossary" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "source_language" TEXT NOT NULL,
    "target_language" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "translation_glossary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "translation_jobs_school_id_created_by_user_id_idx" ON "translation_jobs"("school_id", "created_by_user_id");

-- CreateIndex
CREATE INDEX "translation_jobs_school_id_status_idx" ON "translation_jobs"("school_id", "status");

-- CreateIndex
CREATE INDEX "translation_glossary_school_id_version_idx" ON "translation_glossary"("school_id", "version");
