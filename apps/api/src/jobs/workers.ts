import { Worker } from 'bullmq';
import { createRedisConnection } from '../lib/redis';
import { processAiAnalyze } from '../services/ai';
import { processImport } from '../services/imports';
import { QUEUE_NAMES, type AiAnalyzePayload, type ImportProcessPayload } from './queues';

// Background workers. They run inside the API process for now (started in server.ts); they can move to
// their own process later without changing the queues. Each job is retried by defaultJobOptions.

let workers: Worker[] = [];

export function startWorkers(): Worker[] {
  if (workers.length > 0) return workers;
  const aiAnalyze = new Worker<AiAnalyzePayload>(
    QUEUE_NAMES.AI_ANALYZE,
    async (job) => {
      await processAiAnalyze(job.data);
    },
    { connection: createRedisConnection() },
  );
  aiAnalyze.on('failed', (job, err) => {
    console.error(`[ai.analyze] job ${job?.id ?? '?'} failed: ${err.message}`);
  });

  const importProcess = new Worker<ImportProcessPayload>(
    QUEUE_NAMES.IMPORT_PROCESS,
    async (job) => {
      await processImport(job.data);
    },
    { connection: createRedisConnection() },
  );
  importProcess.on('failed', (job, err) => {
    console.error(`[import.process] job ${job?.id ?? '?'} failed: ${err.message}`);
  });

  workers = [aiAnalyze, importProcess];
  return workers;
}

export async function stopWorkers(): Promise<void> {
  await Promise.all(workers.map((worker) => worker.close()));
  workers = [];
}
