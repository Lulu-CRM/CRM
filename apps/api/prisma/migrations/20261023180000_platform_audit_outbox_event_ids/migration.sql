-- Platform alignment (Oct 23, 2026): audit log, domain-event outbox, and the sender's event id on
-- activities so POST /events records an event once. New tables and one nullable column only.
-- CreateEnum
CREATE TYPE "audit_actor_type" AS ENUM ('user', 'ai', 'system');

-- CreateEnum
CREATE TYPE "outbox_status" AS ENUM ('pending', 'dispatched', 'failed');

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "externalEventId" TEXT;

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorType" "audit_actor_type" NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "changes" JSONB NOT NULL DEFAULT '{}',
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT,
    "actorType" "audit_actor_type" NOT NULL,
    "actorId" TEXT,
    "correlationId" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "outbox_status" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "dispatchedAt" TIMESTAMP(3),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_workspaceId_createdAt_idx" ON "audit_logs"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_workspaceId_entityType_entityId_idx" ON "audit_logs"("workspaceId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "outbox_events_status_occurredAt_idx" ON "outbox_events"("status", "occurredAt");

-- CreateIndex
CREATE INDEX "outbox_events_workspaceId_occurredAt_idx" ON "outbox_events"("workspaceId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "activities_workspaceId_sourceModule_externalEventId_key" ON "activities"("workspaceId", "sourceModule", "externalEventId");

