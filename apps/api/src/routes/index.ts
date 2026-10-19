import { Router } from 'express';
import { dealsRouter } from './deals';
import { createHealthHandler } from './health';
import { pipelinesRouter } from './pipelines';

export const apiRouter = Router();

apiRouter.get('/health', createHealthHandler());
apiRouter.use('/pipelines', pipelinesRouter);
apiRouter.use('/deals', dealsRouter);
