import { ERROR_CODES, type Activity, type ActivityType, type ModuleEvent } from '@lulu/shared';
import { scopedDb } from '../db/scoped';
import { AppError } from '../lib/errors';
import type { RequestContext } from '../middleware/requestContext';
import { toSharedActivity } from './timeline';

// The activity type comes from the event type's prefix (email.*, calendar.*, marketplace.*); the
// original event type is kept in the payload (`eventType`). The summary is one language only, so it
// is stored in `summary` for reference; the UI builds the line from the type through translations.
const TYPE_BY_PREFIX: Record<string, ActivityType> = {
  email: 'email',
  calendar: 'meeting',
  marketplace: 'marketplace',
};

/** POST /events: finds the contact by email (ignoring case), logs an activity, updates lastTouchAt. */
export async function recordModuleEvent(
  ctx: RequestContext,
  input: ModuleEvent,
): Promise<Activity> {
  const scoped = scopedDb(ctx.workspaceId);
  const contact = await scoped.contact.findFirst({
    where: { email: { equals: input.contact.email, mode: 'insensitive' } },
  });
  if (contact === null) throw AppError.notFound(ERROR_CODES.CONTACT_NOT_FOUND);

  const occurredAt = new Date(input.occurredAt);
  const row = await scoped.$transaction(async (tx) => {
    const activity = await tx.activity.create({
      data: {
        workspaceId: ctx.workspaceId,
        type: TYPE_BY_PREFIX[input.type.split('.')[0]!]!,
        recordType: 'contact',
        recordId: contact.id,
        occurredAt,
        sourceModule: input.sourceModule,
        actorId: null,
        summary: input.summary,
        payload: { ...input.payload, eventType: input.type },
      },
    });
    if (contact.lastTouchAt === null || contact.lastTouchAt < occurredAt) {
      await tx.contact.update({ where: { id: contact.id }, data: { lastTouchAt: occurredAt } });
    }
    return activity;
  });
  return toSharedActivity(row);
}
