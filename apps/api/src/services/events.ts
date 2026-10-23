import { ERROR_CODES, type Activity, type ActivityType, type ModuleEvent } from '@lulu/shared';
import { scopedDb } from '../db/scoped';
import { Prisma } from '../generated/prisma/client';
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

/**
 * POST /events: finds the contact by email (ignoring case), logs an activity, updates lastTouchAt.
 * With an eventId, the same event sent again returns the activity already recorded (`duplicate`)
 * and changes nothing, so a sender can safely retry.
 */
export async function recordModuleEvent(
  ctx: RequestContext,
  input: ModuleEvent,
): Promise<{ activity: Activity; duplicate: boolean }> {
  const scoped = scopedDb(ctx.workspaceId);
  const earlier = () =>
    input.eventId === undefined
      ? Promise.resolve(null)
      : scoped.activity.findFirst({
          where: { sourceModule: input.sourceModule, externalEventId: input.eventId },
        });
  const seen = await earlier();
  if (seen !== null) return { activity: toSharedActivity(seen), duplicate: true };

  const contact = await scoped.contact.findFirst({
    where: { email: { equals: input.contact.email, mode: 'insensitive' } },
  });
  if (contact === null) throw AppError.notFound(ERROR_CODES.CONTACT_NOT_FOUND);

  const found = contact;
  const occurredAt = new Date(input.occurredAt);
  const save = () =>
    scoped.$transaction(async (tx) => {
      const activity = await tx.activity.create({
        data: {
          workspaceId: ctx.workspaceId,
          type: TYPE_BY_PREFIX[input.type.split('.')[0]!]!,
          recordType: 'contact',
          recordId: found.id,
          occurredAt,
          sourceModule: input.sourceModule,
          actorId: null,
          summary: input.summary,
          payload: { ...input.payload, eventType: input.type },
          externalEventId: input.eventId ?? null,
        },
      });
      if (found.lastTouchAt === null || found.lastTouchAt < occurredAt) {
        await tx.contact.update({ where: { id: found.id }, data: { lastTouchAt: occurredAt } });
      }
      return activity;
    });

  try {
    return { activity: toSharedActivity(await save()), duplicate: false };
  } catch (error) {
    // The same event arrived twice at once: the unique index let one through; return that one.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const winner = await earlier();
      if (winner !== null) return { activity: toSharedActivity(winner), duplicate: true };
    }
    throw error;
  }
}
