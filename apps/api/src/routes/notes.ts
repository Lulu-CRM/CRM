import {
  idParamSchema,
  noteCreateSchema,
  noteListQuerySchema,
  noteUpdateSchema,
  type NoteCreateInput,
  type NoteListQuery,
  type NoteUpdateInput,
} from '@lulu/shared';
import { Router, type Request } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { created, noContent, ok, paginated } from '../lib/response';
import { requirePermission } from '../middleware/auth';
import { requireContext } from '../middleware/requestContext';
import { validate } from '../middleware/validate';
import { createNote, deleteNote, listNotes, updateNote } from '../services/notes';

export const notesRouter = Router();
const idOf = (req: Request) => (req.params as { id: string }).id;

notesRouter.get(
  '/',
  validate({ query: noteListQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as NoteListQuery;
    const r = await listNotes(requireContext(req), query);
    paginated(res, r.items, { page: query.page, pageSize: query.pageSize, total: r.total });
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
  validate({ params: idParamSchema, body: noteUpdateSchema }),
  asyncHandler(async (req, res) => {
    ok(res, await updateNote(requireContext(req), idOf(req), req.body as NoteUpdateInput));
  }),
);

notesRouter.delete(
  '/:id',
  requirePermission('notes', 'delete'),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await deleteNote(requireContext(req), idOf(req));
    noContent(res);
  }),
);
