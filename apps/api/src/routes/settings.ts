import {
  aiSettingsSchema,
  consentSettingsSchema,
  customFieldCreateSchema,
  customFieldUpdateSchema,
  idSchema,
  notificationSettingsSchema,
  rolePermissionsSchema,
  stageCreateSchema,
  stageUpdateSchema,
  type AiSettings,
  type ConsentSettings,
  type CustomFieldCreateInput,
  type CustomFieldUpdateInput,
  type NotificationSettings,
  type RolePermissions,
  type StageCreateInput,
  type StageUpdateInput,
} from '@lulu/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler';
import { created, noContent, ok } from '../lib/response';
import { requirePermission } from '../middleware/auth';
import { requireContext } from '../middleware/requestContext';
import { validate } from '../middleware/validate';
import * as settings from '../services/settings';

// CRM settings (docs/api.md, "Settings"). Mounted at /settings after requireAuth in routes/index.ts.
// Every signed-in user can read them (the contact form needs the custom fields, the AI page its switches,
// and the Settings screens show read-only); changing them needs settings: edit.
export const settingsRouter = Router();

const params = z.object({ id: idSchema });
const canEdit = requirePermission('settings', 'edit');

function idOf(req: Request): string {
  return (req.params as { id: string }).id;
}

// ----- Custom contact fields -----

settingsRouter.get(
  '/custom-fields',
  asyncHandler(async (req, res) => {
    const fields = await settings.listCustomFields(requireContext(req));
    ok(res, fields, { page: 1, pageSize: Math.max(fields.length, 1), total: fields.length });
  }),
);

settingsRouter.post(
  '/custom-fields',
  canEdit,
  validate({ body: customFieldCreateSchema }),
  asyncHandler(async (req, res) => {
    created(
      res,
      await settings.createCustomField(requireContext(req), req.body as CustomFieldCreateInput),
    );
  }),
);

settingsRouter.patch(
  '/custom-fields/:id',
  canEdit,
  validate({ params, body: customFieldUpdateSchema.strict() }),
  asyncHandler(async (req, res) => {
    ok(
      res,
      await settings.updateCustomField(
        requireContext(req),
        idOf(req),
        req.body as CustomFieldUpdateInput,
      ),
    );
  }),
);

settingsRouter.delete(
  '/custom-fields/:id',
  canEdit,
  validate({ params }),
  asyncHandler(async (req, res) => {
    await settings.deleteCustomField(requireContext(req), idOf(req));
    noContent(res);
  }),
);

// ----- Stages (pipelines and their stages are read through GET /pipelines) -----

settingsRouter.post(
  '/stages',
  canEdit,
  validate({ body: stageCreateSchema }),
  asyncHandler(async (req, res) => {
    created(res, await settings.createStage(requireContext(req), req.body as StageCreateInput));
  }),
);

settingsRouter.patch(
  '/stages/:id',
  canEdit,
  validate({ params, body: stageUpdateSchema.strict() }),
  asyncHandler(async (req, res) => {
    ok(
      res,
      await settings.updateStage(requireContext(req), idOf(req), req.body as StageUpdateInput),
    );
  }),
);

settingsRouter.delete(
  '/stages/:id',
  canEdit,
  validate({ params }),
  asyncHandler(async (req, res) => {
    await settings.deleteStage(requireContext(req), idOf(req));
    noContent(res);
  }),
);

// ----- Roles, consent, notifications, AI switches: read by anyone signed in, replaced whole with PUT -----

type Ctx = ReturnType<typeof requireContext>;

function readWrite<T>(
  path: string,
  schema: z.ZodType<T>,
  read: (ctx: Ctx) => Promise<T>,
  write: (ctx: Ctx, input: T) => Promise<T>,
) {
  settingsRouter.get(
    path,
    asyncHandler(async (req, res) => {
      ok(res, await read(requireContext(req)));
    }),
  );
  settingsRouter.put(
    path,
    canEdit,
    validate({ body: schema }),
    asyncHandler(async (req, res) => {
      ok(res, await write(requireContext(req), req.body as T));
    }),
  );
}

readWrite<RolePermissions>('/roles', rolePermissionsSchema, settings.getRoles, settings.putRoles);
readWrite<ConsentSettings>(
  '/consent',
  consentSettingsSchema,
  settings.getConsent,
  settings.putConsent,
);
readWrite<NotificationSettings>(
  '/notifications',
  notificationSettingsSchema,
  settings.getNotifications,
  settings.putNotifications,
);
readWrite<AiSettings>('/ai', aiSettingsSchema, settings.getAiSettings, settings.putAiSettings);
