import {
  idSchema,
  noteCreateSchema,
  noteListQuerySchema,
  noteUpdateSchema,
  type NoteCreateInput,
  type NoteListQuery,
  type NoteUpdateInput,
} from '@lulu/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler';
import { created, noContent, ok, paginated } from '../lib/response';
import { requirePermission } from '../middleware/auth';
import { requireContext } from '../middleware/requestContext';
import { validate } from '../middleware/validate';
import { createNote, deleteNote, listNotes, updateNote } from '../services/notes';

// Notes (docs/api.md, "Tasks, notes, activities"). Mounted at /notes after requireAuth.
export const notesRouter = Router();

const params = z.object({ id: idSchema });
const idOf = (req: Request) => (req.params as { id: string }).id;

notesRouter.get(
  '/',
  validate({ query: noteListQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as NoteListQuery;
    const result = await listNotes(requireContext(req), query);
    paginated(res, result.items, {
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
    });
  }),
);

notesRouter.post(
  '/',
  requirePermission('notes', 'create'),
  validate({ body: noteCreateSchema }),
  asyncHandler(async (req, res) => {
    created(res, await createNote(requireContext(req), req.body as NoteCreateInput));
  }),
);

notesRouter.patch(
  '/:id',
  requirePermission('notes', 'edit'),
  validate({ params, body: noteUpdateSchema }),
  asyncHandler(async (req, res) => {
    ok(res, await updateNote(requireContext(req), idOf(req), req.body as NoteUpdateInput));
  }),
);

notesRouter.delete(
  '/:id',
  requirePermission('notes', 'delete'),
  validate({ params }),
  asyncHandler(async (req, res) => {
    await deleteNote(requireContext(req), idOf(req));
    noContent(res);
  }),
);
