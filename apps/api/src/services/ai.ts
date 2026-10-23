import {
  ERROR_CODES,
  aiAcceptSchema,
  aiInsightSchema,
  type AiAcceptInput,
  type AiInsight,
  type AiInsightContent,
  type AiRun,
} from '@lulu/shared';
import { env } from '../config/env';
import { scopedDb } from '../db/scoped';
import type { AiInsight as AiInsightRow } from '../generated/prisma/client';
import type { AiAnalyzePayload } from '../jobs/queues';
import { enqueueAiAnalyze } from '../jobs/queues';
import { AppError } from '../lib/errors';
import { updateContact } from './contacts';
import { createTask } from './tasks';
import type { RequestContext } from '../middleware/requestContext';
import { toSharedCompany } from './companyMapper';
import { toSharedContact } from './contactMapper';
import { toSharedDeal, toSharedStage } from './dealMapper';
import { getAiProvider } from './aiProvider';
import { toSharedTask } from './timeline';

// AI analysis (docs/api.md, "AI analysis"). Runs as the ai.analyze background job; nothing an insight
// suggests is saved until the user accepts it, and then only what they ticked (AGENTS.md rule 7).

const iso = (date: Date | null): string | null => (date === null ? null : date.toISOString());

/** A stored insight in the shared contract shape; the JSON columns are checked against aiInsightSchema. */
export function toSharedInsight(row: AiInsightRow): AiInsight {
  return aiInsightSchema.parse({
    id: row.id,
    workspaceId: row.workspaceId,
    contactId: row.contactId,
    provider: row.provider,
    summary: row.summary,
    nextStep: row.nextStep,
    suggestedTask: row.suggestedTask ?? null,
    suggestedStage: row.suggestedStage,
    dataQualityScore: row.dataQualityScore.toNumber(),
    missingFields: row.missingFields,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: iso(row.deletedAt),
  });
}

async function findContact(workspaceId: string, contactId: string) {
  const contact = await scopedDb(workspaceId).contact.findFirst({ where: { id: contactId } });
  if (contact === null) throw AppError.notFound(ERROR_CODES.CONTACT_NOT_FOUND);
  return contact;
}

/** POST /contacts/:id/ai-analysis: queue the analysis and answer at once. */
export async function runAnalysis(ctx: RequestContext, contactId: string): Promise<AiRun> {
  await findContact(ctx.workspaceId, contactId);
  const job = await enqueueAiAnalyze({
    contactId,
    workspaceId: ctx.workspaceId,
    requestedById: ctx.userId,
  });
  return { jobId: String(job.id), status: 'queued' };
}

/** The ai.analyze job: read the contact's context, ask the provider, store a suggested insight. */
export async function processAiAnalyze(
  payload: AiAnalyzePayload,
  now: Date = new Date(),
): Promise<AiInsight> {
  const scoped = scopedDb(payload.workspaceId);
  const contactRow = await findContact(payload.workspaceId, payload.contactId);
  const [companyRow, taskRows, dealRows, stageRows, requester] = await Promise.all([
    contactRow.companyId === null
      ? null
      : scoped.company.findFirst({ where: { id: contactRow.companyId } }),
    scoped.task.findMany({ where: { recordType: 'contact', recordId: contactRow.id } }),
    scoped.deal.findMany({ where: { contactId: contactRow.id } }),
    scoped.stage.findMany({}),
    scoped.user.findFirst({ where: { id: payload.requestedById }, select: { language: true } }),
  ]);

  const content: AiInsightContent = await getAiProvider(env.AI_PROVIDER).analyze({
    contact: toSharedContact(contactRow),
    company: companyRow === null ? null : toSharedCompany(companyRow),
    tasks: taskRows.map(toSharedTask),
    deals: dealRows.map(toSharedDeal),
    stages: stageRows.map(toSharedStage),
    now,
    // A model writes in the language of the person who asked.
    language: requester?.language ?? 'en',
  });

  const row = await scoped.aiInsight.create({
    data: {
      workspaceId: payload.workspaceId,
      contactId: contactRow.id,
      provider: content.provider,
      summary: content.summary,
      nextStep: content.nextStep,
      ...(content.suggestedTask === null ? {} : { suggestedTask: content.suggestedTask }),
      suggestedStage: content.suggestedStage,
      dataQualityScore: content.dataQualityScore,
      missingFields: content.missingFields,
      status: 'suggested',
    },
  });
  return toSharedInsight(row);
}

/** GET /contacts/:id/ai-insights: the newest insight for the contact, or null. */
export async function latestInsight(
  ctx: RequestContext,
  contactId: string,
): Promise<AiInsight | null> {
  await findContact(ctx.workspaceId, contactId);
  const row = await scopedDb(ctx.workspaceId).aiInsight.findFirst({
    where: { contactId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  return row === null ? null : toSharedInsight(row);
}

async function openInsight(workspaceId: string, id: string) {
  const row = await scopedDb(workspaceId).aiInsight.findFirst({ where: { id } });
  if (row === null) throw AppError.notFound(ERROR_CODES.AI_INSIGHT_NOT_FOUND);
  if (row.status !== 'suggested') throw AppError.conflict(ERROR_CODES.AI_INSIGHT_CLOSED);
  return row;
}

/**
 * POST /ai-insights/:id/accept: the only way an insight changes a record. Saves only what the user
 * ticked, in one transaction with the status change and an ai_signal activity on the contact.
 */
export async function acceptInsight(
  ctx: RequestContext,
  id: string,
  input: AiAcceptInput,
): Promise<AiInsight> {
  const options = aiAcceptSchema.parse(input);
  const row = await openInsight(ctx.workspaceId, id);
  const insight = toSharedInsight(row);

  return scopedDb(ctx.workspaceId).$transaction(async (tx) => {
    const contact = await tx.contact.findFirst({ where: { id: insight.contactId } });
    if (contact === null) throw AppError.notFound(ERROR_CODES.CONTACT_NOT_FOUND);

    // The same canonical services as the screens (POST /tasks, PATCH /contacts/:id), so every rule
    // they enforce applies here too. They run in this transaction: all of it is saved, or none.
    const saved: string[] = [];
    if (options.createTask && insight.suggestedTask !== null) {
      const task = await createTask(
        ctx,
        {
          title: options.taskTitle!,
          dueAt: insight.suggestedTask.dueAt,
          ...(contact.ownerId ? { ownerId: contact.ownerId } : {}),
          recordType: 'contact',
          recordId: contact.id,
        },
        tx,
      );
      saved.push(`task:${task.id}`);
    }
    if (options.applyStage && insight.suggestedStage !== null) {
      await updateContact(ctx, contact.id, { lifecycleStage: insight.suggestedStage }, tx);
      saved.push(`stage:${insight.suggestedStage}`);
    }

    const updated = await tx.aiInsight.update({ where: { id }, data: { status: 'accepted' } });
    await tx.activity.create({
      data: {
        workspaceId: ctx.workspaceId,
        type: 'ai_signal',
        recordType: 'contact',
        recordId: contact.id,
        sourceModule: 'crm',
        actorId: ctx.userId,
        payload: { insightId: id, action: 'accepted', saved },
      },
    });
    return toSharedInsight(updated);
  });
}

/** POST /ai-insights/:id/dismiss: nothing is saved. */
export async function dismissInsight(ctx: RequestContext, id: string): Promise<void> {
  await openInsight(ctx.workspaceId, id);
  await scopedDb(ctx.workspaceId).aiInsight.update({
    where: { id },
    data: { status: 'dismissed' },
  });
}
