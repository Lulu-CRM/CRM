import {
  ERROR_CODES,
  moveDeal,
  PipelineError,
  summarizeDeals,
  type DealCreateInput,
  type DealListQuery,
  type DealSummary,
  type DealUpdateInput,
} from '@lulu/shared';
import { db } from '../db/prisma';
import { scopedDb, type ScopedDb } from '../db/scoped';
import type { Prisma } from '../generated/prisma/client';
import { AppError } from '../lib/errors';
import type { RequestContext } from '../middleware/requestContext';
import { toSharedDeal, toSharedStage } from './dealMapper';

const SORTABLE = [
  'name',
  'value',
  'probability',
  'expectedCloseAt',
  'closedAt',
  'createdAt',
  'updatedAt',
];

// Specific codes, because the web app translates errors by code (errors.DEAL_NOT_FOUND, ...).
function notFound(): AppError {
  return AppError.notFound(ERROR_CODES.DEAL_NOT_FOUND);
}

function parseSort(sort: string | undefined): Prisma.DealOrderByWithRelationInput {
  const raw = sort ?? '-createdAt';
  const descending = raw.startsWith('-');
  const field = descending ? raw.slice(1) : raw;
  if (!SORTABLE.includes(field)) {
    throw AppError.validation([
      { path: 'sort', code: 'invalid_value', message: 'errors.validation.invalid_value' },
    ]);
  }
  return { [field]: descending ? 'desc' : 'asc' };
}

async function assertExists(path: string, lookup: Promise<unknown>): Promise<void> {
  if ((await lookup) === null) {
    throw AppError.validation([{ path, code: 'custom', message: 'errors.validation.custom' }]);
  }
}

async function assertReferences(
  scoped: ScopedDb,
  input: {
    contactId?: string | null | undefined;
    companyId?: string | null | undefined;
    ownerId?: string | undefined;
  },
): Promise<void> {
  if (input.contactId) {
    await assertExists(
      'contactId',
      scoped.contact.findFirst({ where: { id: input.contactId }, select: { id: true } }),
    );
  }
  if (input.companyId) {
    await assertExists(
      'companyId',
      (scoped as Prisma.TransactionClient).company.findFirst({
        where: { id: input.companyId },
        select: { id: true },
      }),
    );
  }
  if (input.ownerId) {
    await assertExists(
      'ownerId',
      (scoped as Prisma.TransactionClient).user.findFirst({
        where: { id: input.ownerId },
        select: { id: true },
      }),
    );
  }
}

export async function listPipelines(ctx: RequestContext) {
  return scopedDb(ctx.workspaceId).pipeline.findMany({
    include: { stages: { where: { deletedAt: null }, orderBy: { order: 'asc' } } },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
}

export async function listDeals(ctx: RequestContext, query: DealListQuery) {
  const scoped = scopedDb(ctx.workspaceId);
  const where: Prisma.DealWhereInput = {};
  if (query.q !== undefined) where.name = { contains: query.q, mode: 'insensitive' };
  if (query.stageId !== undefined) where.stageId = query.stageId;
  if (query.ownerId !== undefined) where.ownerId = query.ownerId;
  if (query.companyId !== undefined) where.companyId = query.companyId;
  if (query.contactId !== undefined) where.contactId = query.contactId;
  if (query.status !== undefined) where.stage = { type: query.status };

  const [items, total] = await Promise.all([
    scoped.deal.findMany({
      where,
      orderBy: [parseSort(query.sort), { id: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    scoped.deal.count({ where }),
  ]);
  return { items: items.map(toSharedDeal), total };
}

export async function getDeal(ctx: RequestContext, id: string) {
  const deal = await scopedDb(ctx.workspaceId).deal.findFirst({ where: { id } });
  if (deal === null) throw notFound();
  return toSharedDeal(deal);
}

export async function createDeal(ctx: RequestContext, input: DealCreateInput) {
  const scoped = scopedDb(ctx.workspaceId);
  const stage = await scoped.stage.findFirst({ where: { id: input.stageId } });
  if (stage === null) throw new AppError('STAGE_NOT_FOUND', 404);
  await assertReferences(scoped, input);

  const currency =
    input.currency ??
    (await db.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId } })).defaultCurrency;

  const deal = await scoped.deal.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: input.name,
      value: input.value,
      currency,
      stageId: stage.id,
      probability: input.probability ?? stage.probability,
      expectedCloseAt: input.expectedCloseAt ? new Date(input.expectedCloseAt) : null,
      contactId: input.contactId ?? null,
      companyId: input.companyId ?? null,
      ownerId: input.ownerId ?? ctx.userId,
      // A deal created straight into Won or Lost is closed now.
      closedAt: stage.type === 'open' ? null : new Date(),
    },
  });
  return toSharedDeal(deal);
}

export async function updateDeal(ctx: RequestContext, id: string, input: DealUpdateInput) {
  const scoped = scopedDb(ctx.workspaceId);
  const existing = await scoped.deal.findFirst({ where: { id } });
  if (existing === null) throw notFound();
  await assertReferences(scoped, input);

  const deal = await scoped.deal.update({
    where: { id },
    data: {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.value === undefined ? {} : { value: input.value }),
      ...(input.currency === undefined ? {} : { currency: input.currency }),
      ...(input.probability === undefined ? {} : { probability: input.probability }),
      ...(input.contactId === undefined ? {} : { contactId: input.contactId }),
      ...(input.companyId === undefined ? {} : { companyId: input.companyId }),
      ...(input.ownerId === undefined ? {} : { ownerId: input.ownerId }),
      ...(input.expectedCloseAt === undefined
        ? {}
        : {
            expectedCloseAt:
              input.expectedCloseAt === null ? null : new Date(input.expectedCloseAt),
          }),
    },
  });
  return toSharedDeal(deal);
}

export async function deleteDeal(ctx: RequestContext, id: string): Promise<void> {
  const scoped = scopedDb(ctx.workspaceId);
  const existing = await scoped.deal.findFirst({ where: { id } });
  if (existing === null) throw notFound();
  await scoped.deal.delete({ where: { id } });
}

export async function moveDealToStage(ctx: RequestContext, id: string, toStageId: string) {
  const scoped = scopedDb(ctx.workspaceId);

  return scoped.$transaction(async (tx) => {
    const row = await tx.deal.findFirst({ where: { id } });
    if (row === null) throw notFound();

    // All of the workspace's stages, so a stage in another pipeline is reported as
    // STAGE_IN_OTHER_PIPELINE and a stage from another workspace as STAGE_NOT_FOUND.
    const stages = (await tx.stage.findMany({})).map(toSharedStage);

    let moved;
    try {
      moved = moveDeal(toSharedDeal(row), toStageId, stages);
    } catch (err) {
      if (err instanceof PipelineError) {
        throw err.code === 'STAGE_NOT_FOUND'
          ? new AppError('STAGE_NOT_FOUND', 404)
          : new AppError('STAGE_IN_OTHER_PIPELINE', 400);
      }
      throw err;
    }

    if (moved.stageId === row.stageId) return toSharedDeal(row);

    const updated = await tx.deal.update({
      where: { id },
      data: {
        stageId: moved.stageId,
        probability: moved.probability,
        closedAt: moved.closedAt === null ? null : new Date(moved.closedAt),
      },
    });
    await tx.activity.create({
      data: {
        workspaceId: ctx.workspaceId,
        type: 'stage_changed',
        recordType: 'deal',
        recordId: id,
        sourceModule: 'crm',
        actorId: ctx.userId,
        payload: { fromStageId: row.stageId, toStageId: moved.stageId },
      },
    });
    return toSharedDeal(updated);
  });
}

export async function getDealSummary(
  ctx: RequestContext,
  pipelineId: string | undefined,
): Promise<DealSummary> {
  const scoped = scopedDb(ctx.workspaceId);
  const pipeline = await scoped.pipeline.findFirst({
    where: pipelineId === undefined ? { isDefault: true } : { id: pipelineId },
  });
  if (pipeline === null) throw AppError.notFound(ERROR_CODES.PIPELINE_NOT_FOUND);

  const [workspace, stageRows] = await Promise.all([
    db.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId } }),
    scoped.stage.findMany({ where: { pipelineId: pipeline.id } }),
  ]);
  const dealRows = await scoped.deal.findMany({
    where: { stageId: { in: stageRows.map((stage) => stage.id) } },
  });

  return summarizeDeals(
    dealRows.map(toSharedDeal),
    stageRows.map(toSharedStage),
    workspace.defaultCurrency,
  );
}
