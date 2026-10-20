import {
  ERROR_CODES,
  type Note,
  type NoteCreateInput,
  type NoteListQuery,
  type NoteUpdateInput,
} from '@lulu/shared';
import { scopedDb, type ScopedDb } from '../db/scoped';
import type { Note as NoteRow, Prisma } from '../generated/prisma/client';
import { AppError } from '../lib/errors';
import type { RequestContext } from '../middleware/requestContext';
import { assertRecordExists } from './recordLink';

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
    deletedAt: row.deletedAt === null ? null : row.deletedAt.toISOString(),
  };
}

// Private notes of other people are invisible for every role (canSeeNote in note-logic.ts).
const visibleTo = (userId: string) => ({
  OR: [{ visibility: 'shared' as const }, { authorId: userId }],
});

async function findNote(scoped: ScopedDb, ctx: RequestContext, id: string) {
  const row = await scoped.note.findFirst({ where: { id, ...visibleTo(ctx.userId) } });
  if (row === null) throw AppError.notFound(ERROR_CODES.NOTE_NOT_FOUND);
  return row;
}

export async function listNotes(
  ctx: RequestContext,
  query: NoteListQuery,
): Promise<{ items: Note[]; total: number }> {
  const scoped = scopedDb(ctx.workspaceId);
  const where = {
    AND: [
      visibleTo(ctx.userId),
      ...(query.q === undefined
        ? []
        : [
            {
              OR: [
                { title: { contains: query.q, mode: 'insensitive' as const } },
                { body: { contains: query.q, mode: 'insensitive' as const } },
              ],
            },
          ]),
    ],
    ...(query.visibility === undefined ? {} : { visibility: query.visibility }),
    ...(query.recordType === undefined ? {} : { recordType: query.recordType }),
    ...(query.recordId === undefined ? {} : { recordId: query.recordId }),
  };
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
  await assertRecordExists(scoped, input.recordType, input.recordId);
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
  await findNote(scoped, ctx, id);
  await assertRecordExists(scoped, input.recordType, input.recordId);
  const data: Prisma.NoteUncheckedUpdateInput = {
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.body === undefined ? {} : { body: input.body }),
    ...(input.visibility === undefined ? {} : { visibility: input.visibility }),
  };
  // The schema guarantees both link fields come together: both set, or both null to unlink.
  if (input.recordType !== undefined) {
    data.recordType = input.recordType;
    data.recordId = input.recordId ?? null;
  }
  const row = await scoped.note.update({ where: { id }, data });
  return toSharedNote(row);
}

export async function deleteNote(ctx: RequestContext, id: string): Promise<void> {
  const scoped = scopedDb(ctx.workspaceId);
  await findNote(scoped, ctx, id);
  await scoped.note.delete({ where: { id } });
}