import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { ok } from '../lib/response';
import { requireContext } from '../middleware/requestContext';
import { listPipelines } from '../services/deals';

export const pipelinesRouter = Router();

pipelinesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    ok(res, await listPipelines(requireContext(req)));
  }),
);
