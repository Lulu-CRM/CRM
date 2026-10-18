import type { Server } from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { disconnectDb } from './db/prisma';
import { closeQueues } from './jobs/queues';

const app = createApp();

const server: Server = app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down`);
  server.close((err) => {
    void Promise.allSettled([disconnectDb(), closeQueues()]).finally(() => {
      process.exit(err === undefined ? 0 : 1);
    });
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
