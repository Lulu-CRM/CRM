import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { activitiesRouter, eventsRouter } from './activities';
import { aiRouter } from './ai';
import { authRouter, loginRouter } from './auth';
import { companiesRouter } from './companies';
import { contactsRouter } from './contacts';
import { dealsRouter } from './deals';
import { importsRouter } from './imports';
import { overviewRouter } from './overview';
import { segmentsRouter } from './segments';
import { tasksRouter } from './tasks';
import { settingsRouter } from './settings';
import { createHealthHandler } from './health';
import { meRouter } from './me';
import { notesRouter } from './notes';
import { pipelinesRouter } from './pipelines';
import { usersRouter } from './users';

export const apiRouter = Router();

apiRouter.get('/health', createHealthHandler());

// Public: the only route that does not need a token. Everything below is
// guarded by requireAuth, so a new router never ships unauthenticated.
apiRouter.use(loginRouter);
apiRouter.use(requireAuth);
apiRouter.use(authRouter);
apiRouter.use(meRouter);
apiRouter.use(usersRouter);
// AI routes live under /contacts/:id/... and /ai-insights/..., so they mount at the root.
apiRouter.use(aiRouter);
apiRouter.use('/companies', companiesRouter);
apiRouter.use('/contacts', contactsRouter);
apiRouter.use('/pipelines', pipelinesRouter);
apiRouter.use('/deals', dealsRouter);
apiRouter.use('/imports', importsRouter);
apiRouter.use('/overview', overviewRouter);
apiRouter.use('/settings', settingsRouter);
apiRouter.use('/segments', segmentsRouter);
apiRouter.use('/tasks', tasksRouter);
apiRouter.use('/notes', notesRouter);
apiRouter.use('/activities', activitiesRouter);
apiRouter.use('/events', eventsRouter);
