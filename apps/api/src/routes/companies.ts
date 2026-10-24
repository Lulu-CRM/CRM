import {
  companyCreateSchema,
  companyListQuerySchema,
  companyUpdateSchema,
  idSchema,
  type CompanyCreateInput,
  type CompanyListQuery,
  type CompanyUpdateInput,
} from '@lulu/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { requirePermission } from '../middleware/auth';
import { asyncHandler } from '../lib/asyncHandler';
import { created, noContent, ok, paginated } from '../lib/response';
import { requireContext } from '../middleware/requestContext';
import { validate } from '../middleware/validate';
import { runCompanyNotes } from '../services/companyNotes';
import {
  createCompany,
  deleteCompany,
  getCompany,
  listCompanies,
  updateCompany,
} from '../services/companies';

export const companiesRouter = Router();

const params = z.object({ id: idSchema });

function idOf(req: Request): string {
  return (req.params as { id: string }).id;
}

// validate() has already parsed req.body and req.query, so these casts only restore the types.

companiesRouter.get(
  '/',
  validate({ query: companyListQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as CompanyListQuery;
    const result = await listCompanies(requireContext(req), query);
    paginated(res, result.items, {
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
    });
  }),
);

companiesRouter.post(
  '/',
  validate({ body: companyCreateSchema }),
  asyncHandler(async (req, res) => {
    created(res, await createCompany(requireContext(req), req.body as CompanyCreateInput));
  }),
);

companiesRouter.get(
  '/:id',
  validate({ params }),
  asyncHandler(async (req, res) => {
    ok(res, await getCompany(requireContext(req), idOf(req)));
  }),
);

companiesRouter.patch(
  '/:id',
  validate({ params, body: companyUpdateSchema }),
  asyncHandler(async (req, res) => {
    ok(res, await updateCompany(requireContext(req), idOf(req), req.body as CompanyUpdateInput));
  }),
);

// Members work with companies but cannot delete them (defaultPermissions).
companiesRouter.delete(
  '/:id',
  requirePermission('companies', 'delete'),
  validate({ params }),
  asyncHandler(async (req, res) => {
    await deleteCompany(requireContext(req), idOf(req));
    noContent(res);
  }),
);

// AI notes are written by the AI (services/companyNotes.ts): this queues a new version.
companiesRouter.post(
  '/:id/ai-notes',
  requirePermission('companies', 'edit'),
  validate({ params }),
  asyncHandler(async (req, res) => {
    ok(res, await runCompanyNotes(requireContext(req), idOf(req)));
  }),
);
