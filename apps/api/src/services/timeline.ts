import { canSeeNote, type Activity, type Note, type Task, type TimelineItem } from '@lulu/shared';
import { ERROR_CODES } from '@lulu/shared';
import { scopedDb } from '../db/scoped';
import type {
  Activity as ActivityRow,
  Note as NoteRow,
  Task as TaskRow,
} from '../generated/prisma/client';
import { AppError } from '../lib/errors';
import type { RequestContext } from '../middleware/requestContext';

const iso = (date: Date | null): string | null => (date === null ? null : date.toISOString());

// Row -> shared DTOs for the timeline. Exported so the notes/tasks/activities endpoints
// (backend task 5) can reuse the same mapping.

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
    payload: row.payload as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: iso(row.deletedAt),
  };
}

export function toSharedNote(row: NoteRow): Note {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    title: row.title,
    body: row.body,
    visibility: row.visibility,
    authorId: row.authorId,
    recordType: row.recordType,
    recordId: row.recordId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: iso(row.deletedAt),
  };
}

export function toSharedTask(row: TaskRow): Task {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    title: row.title,
    dueAt: iso(row.dueAt),
    priority: row.priority,
    // The database allows a null owner, the shared schema does not.
    ownerId: row.ownerId ?? '',
    done: row.done,
    doneAt: iso(row.doneAt),
    recordType: row.recordType,
    recordId: row.recordId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: iso(row.deletedAt),
  };
}

// GET /contacts/:id/timeline: activities, notes and open tasks for this contact,
// newest first by `at` (docs/api.md, "Contacts"). Private notes only for their author.
export async function getContactTimeline(
  ctx: RequestContext,
  contactId: string,
): Promise<TimelineItem[]> {
  const scoped = scopedDb(ctx.workspaceId);
  const contact = await scoped.contact.findFirst({
    where: { id: contactId },
    select: { id: true },
  });
  if (contact === null) {
    throw AppError.notFound(ERROR_CODES.CONTACT_NOT_FOUND);
  }

  const [activityRows, noteRows, taskRows] = await Promise.all([
    scoped.activity.findMany({
      where: { recordType: 'contact', recordId: contactId },
      orderBy: { occurredAt: 'desc' },
    }),
    scoped.note.findMany({ where: { recordType: 'contact', recordId: contactId } }),
    scoped.task.findMany({ where: { recordType: 'contact', recordId: contactId, done: false } }),
  ]);

  const items: TimelineItem[] = [
    ...activityRows.map((row) => ({
      kind: 'activity' as const,
      at: row.occurredAt.toISOString(),
      activity: toSharedActivity(row),
    })),
    ...noteRows
      .map(toSharedNote)
      .filter((note) => canSeeNote(note, ctx.userId))
      .map((note) => ({ kind: 'note' as const, at: note.createdAt, note })),
    ...taskRows.map((row) => ({
      kind: 'task' as const,
      at: row.createdAt.toISOString(),
      task: toSharedTask(row),
    })),
  ];

  items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return items;
}
