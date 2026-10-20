import {
  ERROR_CODES,
  idSchema,
  importConfirmSchema,
  importMappingInputSchema,
  importResolveSchema,
  type ImportConfirmInput,
} from '@lulu/shared';
import { Router, type ErrorRequestHandler, type Request } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler';
import { AppError } from '../lib/errors';
import { created, ok } from '../lib/response';
import { requirePermission } from '../middleware/auth';
import { requireContext } from '../middleware/requestContext';
import { validate } from '../middleware/validate';
import {
  confirmImport,
  createImport,
  getImport,
  heldRows,
  previewImport,
  resolveHeldRow,
  saveMapping,
} from '../services/imports';

// Contact import (docs/api.md, "Import"). Mounted at /imports after requireAuth in routes/index.ts.
export const importsRouter = Router();

// The file stays in memory: 10,000 rows of contacts is a few MB at most.
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
});

const params = z.object({ id: idSchema });
const rowParams = z.object({ id: idSchema, rowId: idSchema });

function idOf(req: Request): string {
  return (req.params as { id: string }).id;
}

// A file over the size limit can only be over the row limit too; other upload errors mean an unreadable request.
const uploadErrors: ErrorRequestHandler = (err, _req, _res, next) => {
  if (err instanceof multer.MulterError) {
    next(
      err.code === 'LIMIT_FILE_SIZE'
        ? new AppError(ERROR_CODES.IMPORT_TOO_MANY_ROWS, 400)
        : new AppError(ERROR_CODES.IMPORT_FILE_UNREADABLE, 400),
    );
    return;
  }
  next(err);
};

importsRouter.post(
  '/',
  requirePermission('imports', 'create'),
  upload.single('file'),
  uploadErrors,
  asyncHandler(async (req, res) => {
    if (req.file === undefined) throw new AppError(ERROR_CODES.IMPORT_FILE_UNREADABLE, 400);
    created(res, await createImport(requireContext(req), req.file));
  }),
);

importsRouter.get(
  '/:id',
  validate({ params }),
  asyncHandler(async (req, res) => {
    ok(res, await getImport(requireContext(req), idOf(req)));
  }),
);

importsRouter.put(
  '/:id/mapping',
  requirePermission('imports', 'create'),
  validate({ params, body: importMappingInputSchema }),
  asyncHandler(async (req, res) => {
    const { mapping } = req.body as z.infer<typeof importMappingInputSchema>;
    ok(res, await saveMapping(requireContext(req), idOf(req), mapping));
  }),
);

importsRouter.get(
  '/:id/preview',
  validate({ params }),
  asyncHandler(async (req, res) => {
    ok(res, await previewImport(requireContext(req), idOf(req)));
  }),
);

importsRouter.post(
  '/:id/confirm',
  requirePermission('imports', 'create'),
  validate({ params, body: importConfirmSchema }),
  asyncHandler(async (req, res) => {
    ok(res, await confirmImport(requireContext(req), idOf(req), req.body as ImportConfirmInput));
  }),
);

importsRouter.get(
  '/:id/held',
  validate({ params }),
  asyncHandler(async (req, res) => {
    const rows = await heldRows(requireContext(req), idOf(req));
    ok(res, rows, { page: 1, pageSize: Math.max(rows.length, 1), total: rows.length });
  }),
);

// Resolving writes contacts (create or merge), so it needs permission to edit them.
importsRouter.post(
  '/:id/held/:rowId/resolve',
  requirePermission('contacts', 'edit'),
  validate({ params: rowParams, body: importResolveSchema }),
  asyncHandler(async (req, res) => {
    const { id, rowId } = req.params as { id: string; rowId: string };
    const { action } = req.body as z.infer<typeof importResolveSchema>;
    ok(res, await resolveHeldRow(requireContext(req), id, rowId, action));
  }),
);
