import {
  ERROR_CODES,
  setTaskDone,
  type Task,
  type TaskCreateInput,
  type TaskListQuery,
  type TaskUpdateInput,
} from '@lulu/shared';
import { db } from '../db/prisma';
import { scopedDb } from '../db/scoped';
import type { Prisma } from '../generated/prisma/client';
import { AppError } from '../lib/errors';
import type { RequestContext } from '../middleware/requestContext';
import { assertRecord, assertUser } from './records';
import { toSharedTask } from './timeline';

// Tasks (docs/api.md, "Tasks, notes, activities").

const notFound = () => AppError.notFound(ERROR_CODES.TASK_NOT_FOUND);

/** GET /tasks: open tasks first by due date (undated last), then done ones, like the Activities page. */
export async function listTasks(
  ctx: RequestContext,
  query: TaskListQuery,
): Promise<{ items: Task[]; total: number }> {
  const scoped = scopedDb(ctx.workspaceId);
  const where: Prisma.TaskWhereInput = {};
  if (query.q !== undefined) where.title = { contains: query.q, mode: 'insensitive' };
  if (query.ownerId !== undefined) where.ownerId = query.ownerId;
  if (query.done !== undefined) where.done = query.done;
  if (query.dueBefore !== undefined) where.dueAt = { lt: new Date(query.dueBefore) };
  if (query.recordType !== undefined) where.recordType = query.recordType;
  if (query.recordId !== undefined) where.recordId = query.recordId;

  const [rows, total] = await Promise.all([
    scoped.task.findMany({
      where,
      orderBy: [{ done: 'asc' }, { dueAt: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    scoped.task.count({ where }),
  ]);
  return { items: rows.map(toSharedTask), total };
}

export async function createTask(ctx: RequestContext, input: TaskCreateInput): Promise<Task> {
  const scoped = scopedDb(ctx.workspaceId);
  await assertUser(scoped, 'ownerId', input.ownerId);
  await assertRecord(scoped, input.recordType, input.recordId);
  const row = await scoped.task.create({
    data: {
      workspaceId: ctx.workspaceId,
      title: input.title,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      priority: input.priority ?? 'normal',
      ownerId: input.ownerId ?? ctx.userId,
      recordType: input.recordType ?? null,
      recordId: input.recordId ?? null,
    },
  });
  return toSharedTask(row);
}

/** PATCH /tasks/:id. Ticking or unticking sets doneAt and logs a `task` activity (setTaskDone in shared). */
export async function updateTask(
  ctx: RequestContext,
  id: string,
  input: TaskUpdateInput,
): Promise<Task> {
  const scoped = scopedDb(ctx.workspaceId);
  const existing = await scoped.task.findFirst({ where: { id } });
  if (existing === null) throw notFound();
  await assertUser(scoped, 'ownerId', input.ownerId);

  const done =
    input.done === undefined
      ? null
      : setTaskDone(toSharedTask(existing), input.done, ctx.userId, new Date());

  const data: Prisma.TaskUncheckedUpdateInput = {
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.dueAt === undefined
      ? {}
      : { dueAt: input.dueAt === null ? null : new Date(input.dueAt) }),
    ...(input.priority === undefined ? {} : { priority: input.priority }),
    ...(input.ownerId === undefined ? {} : { ownerId: input.ownerId }),
    ...(done?.activity
      ? {
          done: done.task.done,
          doneAt: done.task.doneAt === null ? null : new Date(done.task.doneAt),
        }
      : {}),
  };

  // The task and its activity are saved together.
  const row = await db.$transaction(async (tx) => {
    const updated = await tx.task.update({ where: { id: existing.id }, data });
    if (done?.activity) {
      const activity = done.activity;
      await tx.activity.create({
        data: {
          workspaceId: ctx.workspaceId,
          type: activity.type,
          recordType: activity.recordType,
          recordId: activity.recordId,
          occurredAt: new Date(activity.occurredAt),
          sourceModule: activity.sourceModule,
          actorId: activity.actorId,
          payload: activity.payload as Prisma.InputJsonValue,
        },
      });
    }
    return updated;
  });
  return toSharedTask(row);
}

export async function deleteTask(ctx: RequestContext, id: string): Promise<void> {
  const scoped = scopedDb(ctx.workspaceId);
  if ((await scoped.task.findFirst({ where: { id } })) === null) throw notFound();
  await scoped.task.delete({ where: { id } });
}
