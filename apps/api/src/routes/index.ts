import { Router } from 'express';
import { authRouter } from './auth';
import { createHealthHandler } from './health';
import { meRouter } from './me';
import { usersRouter } from './users';

export const apiRouter = Router();

apiRouter.get('/health', createHealthHandler());
apiRouter.use(authRouter);
apiRouter.use(meRouter);
apiRouter.use(usersRouter);
