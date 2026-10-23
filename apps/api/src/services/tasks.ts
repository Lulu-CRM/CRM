import {
  ERROR_CODES,
  type Task,
  type TaskCreateInput,
  type TaskListQuery,
  type TaskUpdateInput,
} from '@lulu/shared';
import { scopedDb, type DbTx, type ScopedDb } from '../db/scoped';
import type { Prisma } from '../generated/prisma/client';
import { AppError } from '../lib/errors';
import type { RequestContext } from '../middleware/requestContext';
import { assertRecordExists, recordNotFound } from './recordLink';
import { toSharedTask } from './timeline';

async function findTask(scoped: ScopedDb, id: string) {
  const row = await scoped.task.findFirst({ where: { id } });
  if (row === null) throw AppError.notFound(ERROR_CODES.TASK_NOT_FOUND);
  return row;
}

async function assertOwnerExists(scoped: DbTx, ownerId: string | undefined) {
  if (ownerId === undefined) return;
  const owner = await scoped.user.findFirst({ where: { id: ownerId } });
  if (owner === null) throw recordNotFound();
}

/** GET /tasks: open tasks by due date (undated last), then done tasks, most recently finished first. */
export async function listTasks(
  ctx: RequestContext,
  query: TaskListQuery,
): Promise<{ items: Task[]; total: number }> {
  const scoped = scopedDb(ctx.workspaceId);
  const where = {
    ...(query.ownerId === undefined ? {} : { ownerId: query.ownerId }),
    ...(query.done === undefined ? {} : { done: query.done }),
    ...(query.recordType === undefined ? {} : { recordType: query.recordType }),
    ...(query.recordId === undefined ? {} : { recordId: query.recordId }),
    ...(query.q === undefined
      ? {}
      : { title: { contains: query.q, mode: 'insensitive' as const } }),
    ...(query.dueBefore === undefined ? {} : { dueAt: { lte: new Date(query.dueBefore) } }),
  };
  const [rows, total] = await Promise.all([
    scoped.task.findMany({
      where,
      orderBy: [
        { done: 'asc' },
        { dueAt: { sort: 'asc', nulls: 'last' } },
        { doneAt: 'desc' },
        { id: 'asc' },
      ],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    scoped.task.count({ where }),
  ]);
  return { items: rows.map(toSharedTask), total };
}

/** POST /tasks. `tx` runs it inside a caller's transaction (AI acceptance uses the same path). */
export async function createTask(
  ctx: RequestContext,
  input: TaskCreateInput,
  tx?: DbTx,
): Promise<Task> {
  const scoped: DbTx = tx ?? scopedDb(ctx.workspaceId);
  await assertRecordExists(scoped, input.recordType, input.recordId);
  await assertOwnerExists(scoped, input.ownerId);
  const row = await scoped.task.create({
    data: {
      workspaceId: ctx.workspaceId,
      title: input.title,
      dueAt: input.dueAt == null ? null : new Date(input.dueAt),
      priority: input.priority ?? 'normal',
      ownerId: input.ownerId ?? ctx.userId,
      recordType: input.recordType ?? null,
      recordId: input.recordId ?? null,
    },
  });
  return toSharedTask(row);
}

/** PATCH /tasks/:id. Changing `done` sets doneAt and logs a `task` activity, in one transaction. */
export async function updateTask(
  ctx: RequestContext,
  id: string,
  input: TaskUpdateInput,
): Promise<Task> {
  const scoped = scopedDb(ctx.workspaceId);
  const existing = await findTask(scoped, id);
  await assertOwnerExists(scoped, input.ownerId);
  const doneChanged = input.done !== undefined && input.done !== existing.done;
  const now = new Date();

  const row = await scoped.$transaction(async (tx) => {
    // Prepare update data with correct types
    const updateData: Prisma.TaskUncheckedUpdateInput = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.dueAt !== undefined
        ? { dueAt: input.dueAt === null ? null : new Date(input.dueAt) }
        : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.ownerId !== undefined ? { ownerId: input.ownerId ?? null } : {}),
      ...(doneChanged ? { done: input.done === true, doneAt: input.done ? now : null } : {}),
    };
    const updated = await tx.task.update({
      where: { id },
      data: updateData,
    });
    if (doneChanged) {
      await tx.activity.create({
        data: {
          workspaceId: ctx.workspaceId,
          type: 'task',
          recordType: existing.recordType,
          recordId: existing.recordId,
          occurredAt: now,
          sourceModule: 'crm',
          actorId: ctx.userId,
          payload: { taskId: id, action: input.done ? 'completed' : 'reopened' },
        },
      });
    }
    return updated;
  });
  return toSharedTask(row);
}

export async function deleteTask(ctx: RequestContext, id: string): Promise<void> {
  const scoped = scopedDb(ctx.workspaceId);
  await findTask(scoped, id);
  await scoped.task.delete({ where: { id } });
}
