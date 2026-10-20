import {
  activityCreateSchema,
  activityListQuerySchema,
  type ActivityCreateInput,
  type ActivityListQuery,
} from '@lulu/shared';
import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { created, paginated } from '../lib/response';
import { requirePermission } from '../middleware/auth';
import { requireContext } from '../middleware/requestContext';
import { validate } from '../middleware/validate';
import { createActivity, listActivities } from '../services/activities';

export const activitiesRouter = Router();

activitiesRouter.get(
  '/',
  validate({ query: activityListQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as ActivityListQuery;
    const r = await listActivities(requireContext(req), query);
    paginated(res, r.items, { page: query.page, pageSize: query.pageSize, total: r.total });
  }),
);

// There is no "activities" permission resource, so logging by hand uses notes/create.
activitiesRouter.post(
  '/',
  requirePermission('notes', 'create'),
  validate({ body: activityCreateSchema }),
  asyncHandler(async (req, res) => {
    created(res, await createActivity(requireContext(req), req.body as ActivityCreateInput));
  }),
);