import { Router } from 'express';
import { createHealthHandler } from './health';

export const apiRouter = Router();

apiRouter.get('/health', createHealthHandler());
