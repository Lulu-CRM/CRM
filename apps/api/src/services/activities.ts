import {
  ERROR_CODES,
  type Activity,
  type ActivityCreateInput,
  type ActivityListQuery,
  type ActivityType,
  type ModuleEvent,
} from '@lulu/shared';
import { db } from '../db/prisma';
import { scopedDb } from '../db/scoped';
import type { Prisma } from '../generated/prisma/client';
import { AppError } from '../lib/errors';
import type { RequestContext } from '../middleware/requestContext';
import { assertRecord } from './records';
import { toSharedActivity } from './timeline';

// Activities and events from other modules (docs/api.md, "Tasks, notes, activities" and
// "Events from other modules"). Activities store facts; the web app builds the sentence from type and
// payload through the translation files.

/** GET /activities: the timeline, newest first. */
export async function listActivities(
  ctx: RequestContext,
  query: ActivityListQuery,
): Promise<{ items: Activity[]; total: number }> {
  const scoped = scopedDb(ctx.workspaceId);
  const where: Prisma.ActivityWhereInput = {};
  if (query.recordType !== undefined) where.recordType = query.recordType;
  if (query.recordId !== undefined) where.recordId = query.recordId;
  if (query.type !== undefined) where.type = query.type;

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

/** Moves a contact's lastTouchAt forward to `at`, never back (an old event arriving late changes nothing). */
async function touchContact(
  tx: Prisma.TransactionClient,
  ctx: RequestContext,
  id: string,
  at: Date,
) {
  await tx.contact.updateMany({
    where: {
      id,
      workspaceId: ctx.workspaceId,
      deletedAt: null,
      OR: [{ lastTouchAt: null }, { lastTouchAt: { lt: at } }],
    },
    data: { lastTouchAt: at },
  });
}

/** POST /activities: logged by hand in the CRM. Logging one on a contact counts as a touch. */
export async function createActivity(
  ctx: RequestContext,
  input: ActivityCreateInput,
): Promise<Activity> {
  await assertRecord(scopedDb(ctx.workspaceId), input.recordType, input.recordId);
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
  const row = await db.$transaction(async (tx) => {
    const created = await tx.activity.create({
      data: {
        workspaceId: ctx.workspaceId,
        type: input.type,
        recordType: input.recordType,
        recordId: input.recordId,
        occurredAt,
        sourceModule: 'crm',
        actorId: ctx.userId,
        payload: (input.payload ?? {}) as Prisma.InputJsonValue,
      },
    });
    if (input.recordType === 'contact') await touchContact(tx, ctx, input.recordId, occurredAt);
    return created;
  });
  return toSharedActivity(row);
}

// email.* -> email, calendar.* -> meeting, marketplace.* -> marketplace.
const EVENT_TYPES: Record<string, ActivityType> = {
  email: 'email',
  calendar: 'meeting',
  marketplace: 'marketplace',
};

/**
 * POST /events: another module says something happened with a contact. The CRM finds the contact by
 * email (ignoring case), logs the activity and moves lastTouchAt forward. No matching contact answers
 * CONTACT_NOT_FOUND, so the module knows nothing was recorded.
 */
export async function receiveEvent(ctx: RequestContext, event: ModuleEvent): Promise<Activity> {
  const contact = await scopedDb(ctx.workspaceId).contact.findFirst({
    where: { email: { equals: event.contact.email, mode: 'insensitive' } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  if (contact === null) throw AppError.notFound(ERROR_CODES.CONTACT_NOT_FOUND);

  const occurredAt = new Date(event.occurredAt);
  const row = await db.$transaction(async (tx) => {
    const created = await tx.activity.create({
      data: {
        workspaceId: ctx.workspaceId,
        type: EVENT_TYPES[event.type.split('.')[0]!]!,
        recordType: 'contact',
        recordId: contact.id,
        occurredAt,
        sourceModule: event.sourceModule,
        actorId: null,
        // The module's own event type stays in the payload; its summary is kept for reference only.
        payload: { ...event.payload, event: event.type },
        summary: event.summary,
      },
    });
    await touchContact(tx, ctx, contact.id, occurredAt);
    return created;
  });
  return toSharedActivity(row);
}
