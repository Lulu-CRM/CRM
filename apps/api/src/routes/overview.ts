import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { ok } from '../lib/response';
import { requireContext } from '../middleware/requestContext';
import { getOverview } from '../services/overview';

// GET /overview (docs/api.md, "Overview"). Mounted after requireAuth in routes/index.ts.
export const overviewRouter = Router();

overviewRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    ok(res, await getOverview(requireContext(req)));
  }),
);
