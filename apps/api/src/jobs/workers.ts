import { Worker } from 'bullmq';
import { createRedisConnection } from '../lib/redis';
import { processAiAnalyze } from '../services/ai';
import { QUEUE_NAMES, type AiAnalyzePayload } from './queues';

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
  workers = [aiAnalyze];
  return workers;
}

export async function stopWorkers(): Promise<void> {
  await Promise.all(workers.map((worker) => worker.close()));
  workers = [];
}
