import { Router } from 'express';
import { healthHandler } from './health';

export const apiRouter = Router();

apiRouter.get('/health', healthHandler);
