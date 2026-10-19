
import {
  dealCreateSchema,
  dealListQuerySchema,
  dealMoveSchema,
  dealSummaryQuerySchema,
  dealUpdateSchema,
  idSchema,
  type DealCreateInput,
  type DealListQuery,
  type DealMoveInput,
  type DealSummaryQuery,
  type DealUpdateInput,
} from '@lulu/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler';
import { created, noContent, ok, paginated } from '../lib/response';
import { validate } from '../middleware/validate';
import { requireContext } from '../middleware/requestContext';
import {
  createDeal,
  deleteDeal,
  getDeal,
  getDealSummary,
  listDeals,
  moveDealToStage,
  updateDeal,
} from '../services/deals';

export const dealsRouter = Router();

const params = z.object({ id: idSchema });

function idOf(req: Request): string {
  return (req.params as { id: string }).id;
}

// validate() has already parsed req.body and req.query, so these casts only restore the types.

// Registered before '/:id' so "summary" is not read as an id.
dealsRouter.get(
  '/summary',
  validate({ query: dealSummaryQuerySchema }),
  asyncHandler(async (req, res) => {
    const { pipelineId } = req.query as unknown as DealSummaryQuery;
    ok(res, await getDealSummary(requireContext(req), pipelineId));
  }),
);

dealsRouter.get(
  '/',
  validate({ query: dealListQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as DealListQuery;
    const result = await listDeals(requireContext(req), query);
    paginated(res, result.items, {
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
    });
  }),
);

dealsRouter.post(
  '/',
  validate({ body: dealCreateSchema }),
  asyncHandler(async (req, res) => {
    created(res, await createDeal(requireContext(req), req.body as DealCreateInput));
  }),
);

dealsRouter.get(
  '/:id',
  validate({ params }),
  asyncHandler(async (req, res) => {
    ok(res, await getDeal(requireContext(req), idOf(req)));
  }),
);

// strict(): a stageId in the body is a 400, not silently ignored. Stages change only through /move.
dealsRouter.patch(
  '/:id',
  validate({ params, body: dealUpdateSchema.strict() }),
  asyncHandler(async (req, res) => {
    ok(res, await updateDeal(requireContext(req), idOf(req), req.body as DealUpdateInput));
  }),
);

dealsRouter.post(
  '/:id/move',
  validate({ params, body: dealMoveSchema }),
  asyncHandler(async (req, res) => {
    const { stageId } = req.body as DealMoveInput;
    ok(res, await moveDealToStage(requireContext(req), idOf(req), stageId));
  }),
);

dealsRouter.delete(
  '/:id',
  validate({ params }),
  asyncHandler(async (req, res) => {
    await deleteDeal(requireContext(req), idOf(req));
    noContent(res);
  }),
);
