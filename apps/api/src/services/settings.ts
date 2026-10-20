import {
  ERROR_CODES,
  aiSettingsSchema,
  consentSettingsSchema,
  customFieldCreateSchema,
  customFieldSchema,
  defaultAiSettings,
  defaultConsentSettings,
  defaultNotificationSettings,
  notificationSettingsSchema,
  permissionActionSchema,
  permissionResourceSchema,
  rolePermissionsSchema,
  type AiSettings,
  type ConsentSettings,
  type CustomField,
  type CustomFieldCreateInput,
  type CustomFieldUpdateInput,
  type NotificationSettings,
  type RolePermissions,
  type Stage,
  type StageCreateInput,
  type StageUpdateInput,
} from '@lulu/shared';
import type { ZodType } from 'zod';
import { scopedDb, type ScopedDb } from '../db/scoped';
import type { CustomField as CustomFieldRow, Prisma } from '../generated/prisma/client';
import { AppError } from '../lib/errors';
import { loadPermissions } from '../middleware/auth';
import type { RequestContext } from '../middleware/requestContext';
import { toSharedStage } from './dealMapper';

// CRM settings (docs/api.md, "Settings"). Schemas and defaults live in packages/shared/src/settings*.ts.

const iso = (date: Date | null): string | null => (date === null ? null : date.toISOString());

// ---------- Key/value settings: consent, notifications, AI switches ----------

type SettingKey = 'consent' | 'notifications' | 'ai';

/** A stored setting, or the shared default when the workspace has not saved one (or it no longer parses). */
async function readSetting<T>(
  ctx: RequestContext,
  key: SettingKey,
  schema: ZodType<T>,
  fallback: T,
): Promise<T> {
  const row = await scopedDb(ctx.workspaceId).setting.findFirst({ where: { key } });
  const parsed = schema.safeParse(row?.value);
  return parsed.success ? parsed.data : structuredClone(fallback);
}

async function writeSetting<T>(
  ctx: RequestContext,
  key: SettingKey,
  schema: ZodType<T>,
  input: unknown,
): Promise<T> {
  const value = schema.parse(input) as Prisma.InputJsonValue;
  const scoped = scopedDb(ctx.workspaceId);
  const existing = await scoped.setting.findFirst({ where: { key }, select: { id: true } });
  if (existing === null) {
    await scoped.setting.create({ data: { workspaceId: ctx.workspaceId, key, value } });
  } else {
    await scoped.setting.update({ where: { id: existing.id }, data: { value } });
  }
  return value as T;
}

export const getConsent = (ctx: RequestContext) =>
  readSetting<ConsentSettings>(ctx, 'consent', consentSettingsSchema, defaultConsentSettings);
export const putConsent = (ctx: RequestContext, input: ConsentSettings) =>
  writeSetting<ConsentSettings>(ctx, 'consent', consentSettingsSchema, input);

export const getNotifications = (ctx: RequestContext) =>
  readSetting<NotificationSettings>(
    ctx,
    'notifications',
    notificationSettingsSchema,
    defaultNotificationSettings,
  );
export const putNotifications = (ctx: RequestContext, input: NotificationSettings) =>
  writeSetting<NotificationSettings>(ctx, 'notifications', notificationSettingsSchema, input);

export const getAiSettings = (ctx: RequestContext) =>
  readSetting<AiSettings>(ctx, 'ai', aiSettingsSchema, defaultAiSettings);
export const putAiSettings = (ctx: RequestContext, input: AiSettings) =>
  writeSetting<AiSettings>(ctx, 'ai', aiSettingsSchema, input);

// ---------- Roles and permissions ----------

/** GET /settings/roles: the effective permissions (stored rows over the shared defaults), as the role guard sees them. */
export const getRoles = (ctx: RequestContext): Promise<RolePermissions> =>
  loadPermissions(ctx.workspaceId);

/** PUT /settings/roles: one Permission row per role and resource. Owners are never stored: they can always do everything. */
export async function putRoles(
  ctx: RequestContext,
  input: RolePermissions,
): Promise<RolePermissions> {
  const permissions = rolePermissionsSchema.parse(input);
  const scoped = scopedDb(ctx.workspaceId);
  await scoped.$transaction(async (tx) => {
    for (const role of ['admin', 'member'] as const) {
      for (const resource of permissionResourceSchema.options) {
        const actions = permissionActionSchema.options.filter((a) =>
          permissions[role]?.[resource]?.includes(a),
        );
        const existing = await tx.permission.findFirst({
          where: { role, resource },
          select: { id: true },
        });
        if (existing === null) {
          await tx.permission.create({
            data: { workspaceId: ctx.workspaceId, role, resource, actions },
          });
        } else {
          await tx.permission.update({ where: { id: existing.id }, data: { actions } });
        }
      }
    }
  });
  return loadPermissions(ctx.workspaceId);
}

// ---------- Custom contact fields ----------

function toSharedField(row: CustomFieldRow): CustomField {
  return customFieldSchema.parse({
    id: row.id,
    workspaceId: row.workspaceId,
    entity: row.entity,
    key: row.key,
    label: row.label,
    type: row.type,
    options: row.options ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: iso(row.deletedAt),
  });
}

async function findField(scoped: ScopedDb, id: string) {
  const row = await scoped.customField.findFirst({ where: { id } });
  if (row === null) throw AppError.notFound(ERROR_CODES.CUSTOM_FIELD_NOT_FOUND);
  return row;
}

export async function listCustomFields(ctx: RequestContext): Promise<CustomField[]> {
  const rows = await scopedDb(ctx.workspaceId).customField.findMany({
    where: { entity: 'contact' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  return rows.map(toSharedField);
}

export async function createCustomField(
  ctx: RequestContext,
  input: CustomFieldCreateInput,
): Promise<CustomField> {
  const field = customFieldCreateSchema.parse(input);
  const scoped = scopedDb(ctx.workspaceId);
  const taken = await scoped.customField.findFirst({
    where: { entity: 'contact', key: field.key },
    select: { id: true },
  });
  if (taken !== null) throw AppError.conflict(ERROR_CODES.CUSTOM_FIELD_KEY_TAKEN);
  // A deleted field still holds its key in the unique index; rename it so the key can be used again.
  const deleted = await scoped.customField.findFirst({
    where: { entity: 'contact', key: field.key, deletedAt: { not: null } },
    select: { id: true },
  });
  if (deleted !== null) {
    await scoped.customField.update({
      where: { id: deleted.id, deletedAt: { not: null } },
      data: { key: `${field.key}__deleted_${deleted.id.slice(0, 8)}` },
    });
  }
  const row = await scoped.customField.create({
    data: {
      workspaceId: ctx.workspaceId,
      entity: 'contact',
      key: field.key,
      label: field.label,
      type: field.type,
      options: field.type === 'select' ? field.options : [],
    },
  });
  return toSharedField(row);
}

/** The key and type never change, so values already stored on contacts keep their meaning. */
export async function updateCustomField(
  ctx: RequestContext,
  id: string,
  input: CustomFieldUpdateInput,
): Promise<CustomField> {
  const scoped = scopedDb(ctx.workspaceId);
  const existing = await findField(scoped, id);
  if (existing.type === 'select' && input.options !== undefined && input.options.length === 0) {
    throw AppError.validation([
      { path: 'options', code: 'custom', message: 'CUSTOM_FIELD_OPTIONS_REQUIRED' },
    ]);
  }
  const row = await scoped.customField.update({
    where: { id },
    data: {
      ...(input.label === undefined ? {} : { label: input.label }),
      ...(input.options === undefined || existing.type !== 'select'
        ? {}
        : { options: input.options }),
    },
  });
  return toSharedField(row);
}

export async function deleteCustomField(ctx: RequestContext, id: string): Promise<void> {
  const scoped = scopedDb(ctx.workspaceId);
  await findField(scoped, id);
  await scoped.customField.delete({ where: { id } });
}

// ---------- Stages ----------

async function pipelineStages(scoped: ScopedDb, pipelineId: string) {
  return scoped.stage.findMany({
    where: { pipelineId },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
  });
}

/** Open stages first in their order, then Won, then Lost, numbered from 0 again. */
async function renumber(tx: ScopedDb, pipelineId: string, openInOrder?: string[]) {
  const stages = await pipelineStages(tx, pipelineId);
  const open = stages.filter((s) => s.type === 'open');
  const ordered = openInOrder
    ? openInOrder.map((id) => open.find((s) => s.id === id)!).filter(Boolean)
    : open;
  const closed = [
    ...stages.filter((s) => s.type === 'won'),
    ...stages.filter((s) => s.type === 'lost'),
  ];
  const all = [...ordered, ...closed];
  for (const [order, stage] of all.entries()) {
    if (stage.order !== order) await tx.stage.update({ where: { id: stage.id }, data: { order } });
  }
}

async function findStage(scoped: ScopedDb, id: string) {
  const stage = await scoped.stage.findFirst({ where: { id } });
  if (stage === null) throw AppError.notFound(ERROR_CODES.STAGE_NOT_FOUND);
  return stage;
}

/** POST /settings/stages: a new open stage after the other open stages; Won and Lost stay last. */
export async function createStage(ctx: RequestContext, input: StageCreateInput): Promise<Stage> {
  const scoped = scopedDb(ctx.workspaceId);
  const pipeline = await scoped.pipeline.findFirst({
    where: { id: input.pipelineId },
    select: { id: true },
  });
  if (pipeline === null) throw AppError.notFound(ERROR_CODES.PIPELINE_NOT_FOUND);
  return scoped.$transaction(async (tx) => {
    const created = await tx.stage.create({
      data: {
        workspaceId: ctx.workspaceId,
        pipelineId: pipeline.id,
        key: null,
        name: input.name,
        probability: input.probability,
        type: 'open',
        order: 1_000_000,
      },
    });
    const open = (await pipelineStages(tx as ScopedDb, pipeline.id)).filter(
      (s) => s.type === 'open' && s.id !== created.id,
    );
    await renumber(tx as ScopedDb, pipeline.id, [...open.map((s) => s.id), created.id]);
    return toSharedStage(await findStage(tx as ScopedDb, created.id));
  });
}

/**
 * PATCH /settings/stages/:id. Renaming a default stage clears its key, so the new name shows in every
 * language. `order` is the position among the open stages. Changing a probability does not change deals.
 */
export async function updateStage(
  ctx: RequestContext,
  id: string,
  input: StageUpdateInput,
): Promise<Stage> {
  const scoped = scopedDb(ctx.workspaceId);
  const stage = await findStage(scoped, id);
  return scoped.$transaction(async (tx) => {
    const renamed = input.name !== undefined && input.name !== stage.name;
    await tx.stage.update({
      where: { id },
      data: {
        ...(renamed ? { name: input.name!, key: null } : {}),
        ...(input.probability === undefined ? {} : { probability: input.probability }),
      },
    });
    if (input.order !== undefined && stage.type === 'open') {
      const others = (await pipelineStages(tx as ScopedDb, stage.pipelineId)).filter(
        (s) => s.type === 'open' && s.id !== id,
      );
      const ids = others.map((s) => s.id);
      ids.splice(Math.min(input.order, ids.length), 0, id);
      await renumber(tx as ScopedDb, stage.pipelineId, ids);
    }
    return toSharedStage(await findStage(tx as ScopedDb, id));
  });
}

/** DELETE /settings/stages/:id. Every pipeline keeps its Won and Lost stage, and a stage with deals cannot go. */
export async function deleteStage(ctx: RequestContext, id: string): Promise<void> {
  const scoped = scopedDb(ctx.workspaceId);
  const stage = await findStage(scoped, id);
  if (stage.type !== 'open') throw AppError.conflict(ERROR_CODES.STAGE_LOCKED);
  if ((await scoped.deal.count({ where: { stageId: id } })) > 0)
    throw AppError.conflict(ERROR_CODES.STAGE_IN_USE);
  await scoped.$transaction(async (tx) => {
    await tx.stage.delete({ where: { id } });
    await renumber(tx as ScopedDb, stage.pipelineId);
  });
}
