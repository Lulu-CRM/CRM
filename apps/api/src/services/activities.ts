import type { Activity, ActivityCreateInput, ActivityListQuery } from '@lulu/shared';
import { scopedDb } from '../db/scoped';
import type { Activity as ActivityRow, Prisma } from '../generated/prisma/client';
import type { RequestContext } from '../middleware/requestContext';
import { assertRecordExists } from './recordLink';

export function toSharedActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    type: row.type,
    recordType: row.recordType,
    recordId: row.recordId,
    occurredAt: row.occurredAt.toISOString(),
    sourceModule: row.sourceModule,
    actorId: row.actorId,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt === null ? null : row.deletedAt.toISOString(),
  };
}

/** GET /activities: newest first. */
export async function listActivities(
  ctx: RequestContext,
  query: ActivityListQuery,
): Promise<{ items: Activity[]; total: number }> {
  const scoped = scopedDb(ctx.workspaceId);
  const where = {
    ...(query.recordType === undefined ? {} : { recordType: query.recordType }),
    ...(query.recordId === undefined ? {} : { recordId: query.recordId }),
    ...(query.type === undefined ? {} : { type: query.type }),
  };
  const [rows, total] = await Promise.all([
    scoped.activity.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    scoped.activity.count({ where }),
  ]);
  return { items: rows.map(toSharedActivity), total };
}

/** POST /activities: logged by hand. The actor is the current user. */
export async function createActivity(
  ctx: RequestContext,
  input: ActivityCreateInput,
): Promise<Activity> {
  const scoped = scopedDb(ctx.workspaceId);
  await assertRecordExists(scoped, input.recordType, input.recordId);
  const row = await scoped.activity.create({
    data: {
      workspaceId: ctx.workspaceId,
      type: input.type,
      recordType: input.recordType,
      recordId: input.recordId,
      occurredAt: input.occurredAt === undefined ? new Date() : new Date(input.occurredAt),
      sourceModule: 'crm',
      actorId: ctx.userId,
      payload: (input.payload ?? {}) as Prisma.InputJsonValue,
    },
  });
  return toSharedActivity(row);
}