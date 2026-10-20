import { aiAcceptSchema, idSchema, type AiAcceptInput } from '@lulu/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler';
import { noContent, ok } from '../lib/response';
import { requirePermission } from '../middleware/auth';
import { requireContext } from '../middleware/requestContext';
import { validate } from '../middleware/validate';
import { acceptInsight, dismissInsight, latestInsight, runAnalysis } from '../services/ai';

// AI analysis (docs/api.md, "AI analysis"). Mounted after requireAuth in routes/index.ts.
export const aiRouter = Router();

const params = z.object({ id: idSchema });

function idOf(req: Request): string {
  return (req.params as { id: string }).id;
}

aiRouter.post(
  '/contacts/:id/ai-analysis',
  validate({ params }),
  asyncHandler(async (req, res) => {
    ok(res, await runAnalysis(requireContext(req), idOf(req)));
  }),
);

aiRouter.get(
  '/contacts/:id/ai-insights',
  validate({ params }),
  asyncHandler(async (req, res) => {
    ok(res, await latestInsight(requireContext(req), idOf(req)));
  }),
);

// Accepting writes to the contact (a task, a stage), so it needs permission to edit contacts.
aiRouter.post(
  '/ai-insights/:id/accept',
  requirePermission('contacts', 'edit'),
  validate({ params, body: aiAcceptSchema }),
  asyncHandler(async (req, res) => {
    ok(res, await acceptInsight(requireContext(req), idOf(req), req.body as AiAcceptInput));
  }),
);

aiRouter.post(
  '/ai-insights/:id/dismiss',
  validate({ params }),
  asyncHandler(async (req, res) => {
    await dismissInsight(requireContext(req), idOf(req));
    noContent(res);
  }),
);
