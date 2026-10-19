import {
  contactCreateSchema,
  contactListQuerySchema,
  contactUpdateSchema,
  idSchema,
  type ContactCreateInput,
  type ContactListQuery,
  type ContactUpdateInput,
} from '@lulu/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { requirePermission } from '../middleware/auth';
import { asyncHandler } from '../lib/asyncHandler';
import { created, noContent, ok, paginated } from '../lib/response';
import { requireContext } from '../middleware/requestContext';
import { validate } from '../middleware/validate';
import {
  convertContact,
  createContact,
  deleteContact,
  getContact,
  listContacts,
  updateContact,
} from '../services/contacts';
import { getContactTimeline } from '../services/timeline';

export const contactsRouter = Router();

const params = z.object({ id: idSchema });

function idOf(req: Request): string {
  return (req.params as { id: string }).id;
}

// validate() has already parsed req.body and req.query, so these casts only restore the types.

contactsRouter.get(
  '/',
  validate({ query: contactListQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as ContactListQuery;
    const result = await listContacts(requireContext(req), query);
    paginated(res, result.items, {
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
    });
  }),
);

contactsRouter.post(
  '/',
  validate({ body: contactCreateSchema }),
  asyncHandler(async (req, res) => {
    created(res, await createContact(requireContext(req), req.body as ContactCreateInput));
  }),
);

// Registered before '/:id' so "convert" and "timeline" are not read as ids.
contactsRouter.post(
  '/:id/convert',
  validate({ params }),
  asyncHandler(async (req, res) => {
    ok(res, await convertContact(requireContext(req), idOf(req)));
  }),
);

contactsRouter.get(
  '/:id/timeline',
  validate({ params }),
  asyncHandler(async (req, res) => {
    ok(res, await getContactTimeline(requireContext(req), idOf(req)));
  }),
);

contactsRouter.get(
  '/:id',
  validate({ params }),
  asyncHandler(async (req, res) => {
    ok(res, await getContact(requireContext(req), idOf(req)));
  }),
);

contactsRouter.patch(
  '/:id',
  validate({ params, body: contactUpdateSchema }),
  asyncHandler(async (req, res) => {
    ok(res, await updateContact(requireContext(req), idOf(req), req.body as ContactUpdateInput));
  }),
);

// Members work with contacts but cannot delete them (defaultPermissions).
contactsRouter.delete(
  '/:id',
  requirePermission('contacts', 'delete'),
  validate({ params }),
  asyncHandler(async (req, res) => {
    await deleteContact(requireContext(req), idOf(req));
    noContent(res);
  }),
);
