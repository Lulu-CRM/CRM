import {
  ERROR_CODES,
  type Note,
  type NoteCreateInput,
  type NoteListQuery,
  type NoteUpdateInput,
} from '@lulu/shared';
import { scopedDb, type ScopedDb } from '../db/scoped';
import type { Prisma } from '../generated/prisma/client';
import { AppError } from '../lib/errors';
import type { RequestContext } from '../middleware/requestContext';
import { assertRecord } from './records';
import { toSharedNote } from './timeline';

// Notes (docs/api.md, "Tasks, notes, activities"). Private notes are only for their author, for every
// role: they are left out of lists, and asking for someone else's answers NOTE_NOT_FOUND (canSeeNote).

const visibleTo = (userId: string): Prisma.NoteWhereInput => ({
  OR: [{ visibility: 'shared' }, { authorId: userId }],
});

async function findVisible(scoped: ScopedDb, ctx: RequestContext, id: string) {
  const row = await scoped.note.findFirst({ where: { id, ...visibleTo(ctx.userId) } });
  if (row === null) throw AppError.notFound(ERROR_CODES.NOTE_NOT_FOUND);
  return row;
}

/** GET /notes: most recently edited first. */
export async function listNotes(
  ctx: RequestContext,
  query: NoteListQuery,
): Promise<{ items: Note[]; total: number }> {
  const scoped = scopedDb(ctx.workspaceId);
  const where: Prisma.NoteWhereInput = { AND: [visibleTo(ctx.userId)] };
  if (query.q !== undefined) {
    (where.AND as Prisma.NoteWhereInput[]).push({
      OR: [
        { title: { contains: query.q, mode: 'insensitive' } },
        { body: { contains: query.q, mode: 'insensitive' } },
      ],
    });
  }
  if (query.visibility !== undefined) where.visibility = query.visibility;
  if (query.recordType !== undefined) where.recordType = query.recordType;
  if (query.recordId !== undefined) where.recordId = query.recordId;

  const [rows, total] = await Promise.all([
    scoped.note.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    scoped.note.count({ where }),
  ]);
  return { items: rows.map(toSharedNote), total };
}

export async function createNote(ctx: RequestContext, input: NoteCreateInput): Promise<Note> {
  const scoped = scopedDb(ctx.workspaceId);
  await assertRecord(scoped, input.recordType, input.recordId);
  const row = await scoped.note.create({
    data: {
      workspaceId: ctx.workspaceId,
      title: input.title,
      body: input.body ?? '',
      visibility: input.visibility ?? 'shared',
      authorId: ctx.userId,
      recordType: input.recordType ?? null,
      recordId: input.recordId ?? null,
    },
  });
  return toSharedNote(row);
}

export async function updateNote(
  ctx: RequestContext,
  id: string,
  input: NoteUpdateInput,
): Promise<Note> {
  const scoped = scopedDb(ctx.workspaceId);
  await findVisible(scoped, ctx, id);
  await assertRecord(scoped, input.recordType, input.recordId);
  const row = await scoped.note.update({
    where: { id },
    data: {
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.body === undefined ? {} : { body: input.body }),
      ...(input.visibility === undefined ? {} : { visibility: input.visibility }),
      ...(input.recordType === undefined ? {} : { recordType: input.recordType }),
      ...(input.recordId === undefined ? {} : { recordId: input.recordId }),
    },
  });
  return toSharedNote(row);
}

export async function deleteNote(ctx: RequestContext, id: string): Promise<void> {
  const scoped = scopedDb(ctx.workspaceId);
  await findVisible(scoped, ctx, id);
  await scoped.note.delete({ where: { id } });
}
