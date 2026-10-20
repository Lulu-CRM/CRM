import {
  idSchema,
  listQuerySchema,
  segmentCreateSchema,
  segmentUpdateSchema,
  type ListQuery,
  type SegmentCreateInput,
  type SegmentUpdateInput,
} from '@lulu/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler';
import { created, noContent, ok, paginated } from '../lib/response';
import { requirePermission } from '../middleware/auth';
import { requireContext } from '../middleware/requestContext';
import { validate } from '../middleware/validate';
import {
  createSegment,
  deleteSegment,
  listSegments,
  segmentContacts,
  updateSegment,
} from '../services/segments';

// Segments (docs/api.md, "Segments"). Mounted at /segments after requireAuth in routes/index.ts.
export const segmentsRouter = Router();

const params = z.object({ id: idSchema });

function idOf(req: Request): string {
  return (req.params as { id: string }).id;
}

segmentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const segments = await listSegments(requireContext(req));
    ok(res, segments, { page: 1, pageSize: Math.max(segments.length, 1), total: segments.length });
  }),
);

segmentsRouter.post(
  '/',
  requirePermission('segments', 'create'),
  validate({ body: segmentCreateSchema }),
  asyncHandler(async (req, res) => {
    created(res, await createSegment(requireContext(req), req.body as SegmentCreateInput));
  }),
);

segmentsRouter.patch(
  '/:id',
  requirePermission('segments', 'edit'),
  validate({ params, body: segmentUpdateSchema }),
  asyncHandler(async (req, res) => {
    ok(res, await updateSegment(requireContext(req), idOf(req), req.body as SegmentUpdateInput));
  }),
);

segmentsRouter.delete(
  '/:id',
  requirePermission('segments', 'delete'),
  validate({ params }),
  asyncHandler(async (req, res) => {
    await deleteSegment(requireContext(req), idOf(req));
    noContent(res);
  }),
);

segmentsRouter.get(
  '/:id/contacts',
  validate({ params, query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as ListQuery;
    const result = await segmentContacts(requireContext(req), idOf(req), query);
    paginated(res, result.items, {
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
    });
  }),
);
