import { moduleEventSchema, type ModuleEvent } from '@lulu/shared';
import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { created, ok } from '../lib/response';
import { requirePermission } from '../middleware/auth';
import { requireContext } from '../middleware/requestContext';
import { validate } from '../middleware/validate';
import { recordModuleEvent } from '../services/events';

export const eventsRouter = Router();

eventsRouter.post(
  '/',
  requirePermission('contacts', 'edit'),
  validate({ body: moduleEventSchema }),
  asyncHandler(async (req, res) => {
    // 201 for a new event, 200 when this eventId was already recorded.
    const result = await recordModuleEvent(requireContext(req), req.body as ModuleEvent);
    (result.duplicate ? ok : created)(res, result.activity);
  }),
);
