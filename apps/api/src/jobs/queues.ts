import { Queue, type JobsOptions } from 'bullmq';
import { createRedisConnection, disconnectRedis } from '../lib/redis';

export const QUEUE_NAMES = {
  IMPORT_PROCESS: 'import.process',
  AI_ANALYZE: 'ai.analyze',
  SEGMENTS_REFRESH: 'segments.refresh',
  NOTIFICATIONS_SEND: 'notifications.send',
} as const;

export interface ImportProcessPayload {
  importJobId: string;
  workspaceId: string;
}

export interface AiAnalyzePayload {
  contactId: string;
  workspaceId: string;
  requestedById: string;
}

export interface SegmentsRefreshPayload {
  workspaceId: string;
  segmentId?: string;
}

export interface NotificationPayload {
  workspaceId: string;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
}

export const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};

export const importProcessQueue = new Queue<ImportProcessPayload>(QUEUE_NAMES.IMPORT_PROCESS, {
  connection: createRedisConnection(),
  defaultJobOptions,
});

export const aiAnalyzeQueue = new Queue<AiAnalyzePayload>(QUEUE_NAMES.AI_ANALYZE, {
  connection: createRedisConnection(),
  defaultJobOptions,
});

export const segmentsRefreshQueue = new Queue<SegmentsRefreshPayload>(
  QUEUE_NAMES.SEGMENTS_REFRESH,
  {
    connection: createRedisConnection(),
    defaultJobOptions,
  },
);

export const notificationsSendQueue = new Queue<NotificationPayload>(
  QUEUE_NAMES.NOTIFICATIONS_SEND,
  {
    connection: createRedisConnection(),
    defaultJobOptions,
  },
);

export async function enqueueImportProcess(payload: ImportProcessPayload) {
  return importProcessQueue.add('process', payload);
}

export async function enqueueAiAnalyze(payload: AiAnalyzePayload) {
  return aiAnalyzeQueue.add('analyze', payload);
}

export async function enqueueSegmentsRefresh(payload: SegmentsRefreshPayload) {
  return segmentsRefreshQueue.add('refresh', payload);
}

export async function enqueueNotification(payload: NotificationPayload) {
  return notificationsSendQueue.add('send', payload);
}

export async function closeQueues(): Promise<void> {
  await Promise.all([
    importProcessQueue.close(),
    aiAnalyzeQueue.close(),
    segmentsRefreshQueue.close(),
    notificationsSendQueue.close(),
  ]);
  await disconnectRedis();
}
