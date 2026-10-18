import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { requestId } from './middleware/requestId';
import { requestLog } from './middleware/requestLog';
import './middleware/requestContext';
import { apiRouter } from './routes';
import { createHealthHandler, liveHandler } from './routes/health';

export function createApp(): Express {
  const app = express();

  app.use(requestId);
  app.use(requestLog);
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', createHealthHandler());
  app.get('/health/live', liveHandler);
  app.use('/api/v1', apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
