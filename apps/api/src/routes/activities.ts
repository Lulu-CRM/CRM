import {
  activityCreateSchema,
  activityListQuerySchema,
  moduleEventSchema,
  type ActivityCreateInput,
  type ActivityListQuery,
  type ModuleEvent,
} from '@lulu/shared';
import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { created, paginated } from '../lib/response';
import { requireContext } from '../middleware/requestContext';
import { validate } from '../middleware/validate';
import { createActivity, listActivities, receiveEvent } from '../services/activities';

// Activities (mounted at /activities) and events from other modules (mounted at /events), after
// requireAuth. Any signed-in user may log an activity: there is no separate activities permission.
export const activitiesRouter = Router();
export const eventsRouter = Router();

activitiesRouter.get(
  '/',
  validate({ query: activityListQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as ActivityListQuery;
    const result = await listActivities(requireContext(req), query);
    paginated(res, result.items, {
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
    });
  }),
);

activitiesRouter.post(
  '/',
  validate({ body: activityCreateSchema }),
  asyncHandler(async (req, res) => {
    created(res, await createActivity(requireContext(req), req.body as ActivityCreateInput));
  }),
);

eventsRouter.post(
  '/',
  validate({ body: moduleEventSchema }),
  asyncHandler(async (req, res) => {
    created(res, await receiveEvent(requireContext(req), req.body as ModuleEvent));
  }),
);
