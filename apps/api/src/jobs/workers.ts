import { Worker } from 'bullmq';
import { runAs } from '../lib/actorContext';
import { startOutboxDispatcher, stopOutboxDispatcher } from './outbox';
import { createRedisConnection } from '../lib/redis';
import { processAiAnalyze } from '../services/ai';
import { processCompanyNotes } from '../services/companyNotes';
import { processImport } from '../services/imports';
import {
  QUEUE_NAMES,
  type AiAnalyzePayload,
  type AiCompanyNotesPayload,
  type ImportProcessPayload,
} from './queues';

// Background workers. They run inside the API process for now (started in server.ts); they can move to
// their own process later without changing the queues. Each job is retried by defaultJobOptions.

let workers: Worker[] = [];

export function startWorkers(): Worker[] {
  if (workers.length > 0) return workers;
  const aiAnalyze = new Worker<AiAnalyzePayload>(
    QUEUE_NAMES.AI_ANALYZE,
    async (job) => {
      const { workspaceId, correlationId } = job.data;
      await runAs(
        { actorType: 'ai', workspaceId, ...(correlationId ? { correlationId } : {}) },
        () => processAiAnalyze(job.data),
      );
    },
    { connection: createRedisConnection() },
  );
  aiAnalyze.on('failed', (job, err) => {
    console.error(`[ai.analyze] job ${job?.id ?? '?'} failed: ${err.message}`);
  });

  const importProcess = new Worker<ImportProcessPayload>(
    QUEUE_NAMES.IMPORT_PROCESS,
    async (job) => {
      const { workspaceId, correlationId } = job.data;
      await runAs(
        { actorType: 'system', workspaceId, ...(correlationId ? { correlationId } : {}) },
        () => processImport(job.data),
      );
    },
    { connection: createRedisConnection() },
  );
  importProcess.on('failed', (job, err) => {
    console.error(`[import.process] job ${job?.id ?? '?'} failed: ${err.message}`);
  });

  const companyNotes = new Worker<AiCompanyNotesPayload>(
    QUEUE_NAMES.AI_COMPANY_NOTES,
    async (job) => {
      const { workspaceId, correlationId } = job.data;
      await runAs(
        { actorType: 'ai', workspaceId, ...(correlationId ? { correlationId } : {}) },
        () => processCompanyNotes(job.data),
      );
    },
    { connection: createRedisConnection() },
  );
  companyNotes.on('failed', (job, err) => {
    console.error(`[ai.company_notes] job ${job?.id ?? '?'} failed: ${err.message}`);
  });

  workers = [aiAnalyze, importProcess, companyNotes];
  // Domain events written next to every change (db/audit.ts) are published from here.
  startOutboxDispatcher();
  return workers;
}

export async function stopWorkers(): Promise<void> {
  stopOutboxDispatcher();
  await Promise.all(workers.map((worker) => worker.close()));
  workers = [];
}
