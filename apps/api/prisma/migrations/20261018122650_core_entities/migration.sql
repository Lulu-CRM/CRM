-- CreateEnum
CREATE TYPE "lifecycle_stage" AS ENUM ('new', 'qualified', 'follow_up', 'customer');

-- CreateEnum
CREATE TYPE "stage_type" AS ENUM ('open', 'won', 'lost');

-- CreateEnum
CREATE TYPE "task_priority" AS ENUM ('high', 'normal', 'low');

-- CreateEnum
CREATE TYPE "note_visibility" AS ENUM ('shared', 'private');

-- CreateEnum
CREATE TYPE "record_type" AS ENUM ('contact', 'company', 'deal');

-- CreateEnum
CREATE TYPE "activity_type" AS ENUM ('email', 'meeting', 'task', 'note', 'ai_signal', 'created', 'stage_changed');

-- CreateEnum
CREATE TYPE "source_module" AS ENUM ('crm', 'email', 'calendar', 'online_presence', 'marketplace');

-- CreateEnum
CREATE TYPE "import_job_status" AS ENUM ('uploaded', 'mapped', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "import_row_status" AS ENUM ('added', 'held', 'skipped');

-- CreateEnum
CREATE TYPE "ai_insight_status" AS ENUM ('suggested', 'accepted', 'dismissed');

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "companyId" TEXT,
    "jobRole" TEXT,
    "source" TEXT,
    "lifecycleStage" "lifecycle_stage" NOT NULL DEFAULT 'new',
    "ownerId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "consentUpdatedAt" TIMESTAMP(3),
    "lastTouchAt" TIMESTAMP(3),
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "industry" TEXT,
    "size" TEXT,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipelines" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stages" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "probability" DECIMAL(5,4) NOT NULL,
    "type" "stage_type" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "probability" DECIMAL(5,4) NOT NULL,
    "expectedCloseAt" TIMESTAMP(3),
    "contactId" TEXT,
    "companyId" TEXT,
    "ownerId" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "priority" "task_priority" NOT NULL DEFAULT 'normal',
    "ownerId" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "recordType" "record_type",
    "recordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "note_visibility" NOT NULL DEFAULT 'shared',
    "authorId" TEXT NOT NULL,
    "recordType" "record_type" NOT NULL,
    "recordId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "activity_type" NOT NULL,
    "recordType" "record_type" NOT NULL,
    "recordId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceModule" "source_module" NOT NULL DEFAULT 'crm',
    "actorId" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "segments" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "import_job_status" NOT NULL DEFAULT 'uploaded',
    "mapping" JSONB,
    "rowsTotal" INTEGER NOT NULL DEFAULT 0,
    "rowsAdded" INTEGER NOT NULL DEFAULT 0,
    "rowsHeld" INTEGER NOT NULL DEFAULT 0,
    "ownerId" TEXT,
    "tag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_rows" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "raw" JSONB NOT NULL,
    "status" "import_row_status" NOT NULL,
    "duplicateOfContactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_insights" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "nextStep" TEXT NOT NULL,
    "dataQualityScore" DECIMAL(5,4) NOT NULL,
    "missingFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ai_insight_status" NOT NULL DEFAULT 'suggested',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ai_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_fields" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "options" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "custom_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "resource" TEXT NOT NULL,
    "actions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacts_workspaceId_idx" ON "contacts"("workspaceId");

-- CreateIndex
CREATE INDEX "contacts_workspaceId_email_idx" ON "contacts"("workspaceId", "email");

-- CreateIndex
CREATE INDEX "contacts_workspaceId_companyId_idx" ON "contacts"("workspaceId", "companyId");

-- CreateIndex
CREATE INDEX "contacts_workspaceId_lastTouchAt_idx" ON "contacts"("workspaceId", "lastTouchAt");

-- CreateIndex
CREATE INDEX "companies_workspaceId_idx" ON "companies"("workspaceId");

-- CreateIndex
CREATE INDEX "pipelines_workspaceId_idx" ON "pipelines"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "pipelines_workspaceId_key_key" ON "pipelines"("workspaceId", "key");

-- CreateIndex
CREATE INDEX "stages_workspaceId_idx" ON "stages"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "stages_pipelineId_key_key" ON "stages"("pipelineId", "key");

-- CreateIndex
CREATE INDEX "deals_workspaceId_idx" ON "deals"("workspaceId");

-- CreateIndex
CREATE INDEX "deals_workspaceId_companyId_idx" ON "deals"("workspaceId", "companyId");

-- CreateIndex
CREATE INDEX "deals_workspaceId_stageId_idx" ON "deals"("workspaceId", "stageId");

-- CreateIndex
CREATE INDEX "tasks_workspaceId_idx" ON "tasks"("workspaceId");

-- CreateIndex
CREATE INDEX "tasks_workspaceId_ownerId_done_dueAt_idx" ON "tasks"("workspaceId", "ownerId", "done", "dueAt");

-- CreateIndex
CREATE INDEX "tasks_workspaceId_recordType_recordId_idx" ON "tasks"("workspaceId", "recordType", "recordId");

-- CreateIndex
CREATE INDEX "notes_workspaceId_idx" ON "notes"("workspaceId");

-- CreateIndex
CREATE INDEX "notes_workspaceId_recordType_recordId_idx" ON "notes"("workspaceId", "recordType", "recordId");

-- CreateIndex
CREATE INDEX "activities_workspaceId_idx" ON "activities"("workspaceId");

-- CreateIndex
CREATE INDEX "activities_workspaceId_recordType_recordId_idx" ON "activities"("workspaceId", "recordType", "recordId");

-- CreateIndex
CREATE INDEX "segments_workspaceId_idx" ON "segments"("workspaceId");

-- CreateIndex
CREATE INDEX "import_jobs_workspaceId_idx" ON "import_jobs"("workspaceId");

-- CreateIndex
CREATE INDEX "import_rows_workspaceId_idx" ON "import_rows"("workspaceId");

-- CreateIndex
CREATE INDEX "import_rows_workspaceId_importJobId_idx" ON "import_rows"("workspaceId", "importJobId");

-- CreateIndex
CREATE INDEX "ai_insights_workspaceId_idx" ON "ai_insights"("workspaceId");

-- CreateIndex
CREATE INDEX "ai_insights_workspaceId_contactId_idx" ON "ai_insights"("workspaceId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "custom_fields_workspaceId_entity_key_key" ON "custom_fields"("workspaceId", "entity", "key");

-- CreateIndex
CREATE UNIQUE INDEX "settings_workspaceId_key_key" ON "settings"("workspaceId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_workspaceId_role_resource_key" ON "permissions"("workspaceId", "role", "resource");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stages" ADD CONSTRAINT "stages_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stages" ADD CONSTRAINT "stages_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "pipelines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segments" ADD CONSTRAINT "segments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "import_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_duplicateOfContactId_fkey" FOREIGN KEY ("duplicateOfContactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_fields" ADD CONSTRAINT "custom_fields_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Trigram search indexes (docs/data-model.md: text search on contact name,
-- contact email and company name). Requires pg_trgm.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "contacts_name_trgm" ON "contacts" USING GIN (lower("name") gin_trgm_ops);
CREATE INDEX "contacts_email_trgm" ON "contacts" USING GIN (lower("email") gin_trgm_ops);
CREATE INDEX "companies_name_trgm" ON "companies" USING GIN (lower("name") gin_trgm_ops);
