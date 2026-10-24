import type { AiRun, AiText } from '@lulu/shared';
import { env } from '../config/env';
import { scopedDb } from '../db/scoped';
import { enqueueAiCompanyNotes, type AiCompanyNotesPayload } from '../jobs/queues';
import { AppError } from '../lib/errors';
import type { RequestContext } from '../middleware/requestContext';
import { getAiProvider } from './aiProvider';
import { toSharedCompany } from './companyMapper';
import { toSharedContact } from './contactMapper';
import { toSharedDeal, toSharedStage } from './dealMapper';
import { toSharedActivity, toSharedNote, toSharedTask } from './timeline';

// AI notes on a company (Dave, Oct 24, 2026): written by the AI from everything the CRM holds about the
// account, never typed. They run in the background (AGENTS.md rule 6) through the one AI provider
// interface (rule 7). They describe the account and change no business record, so they are saved
// without a confirmation step, like an AI insight is; a person still decides what to do with them.

const ACTIVITY_LIMIT = 50;

async function findCompany(workspaceId: string, id: string) {
  const row = await scopedDb(workspaceId).company.findFirst({ where: { id } });
  if (row === null) throw new AppError('COMPANY_NOT_FOUND', 404);
  return row;
}

/** POST /companies/:id/ai-notes: queues a new version of the notes. */
export async function runCompanyNotes(ctx: RequestContext, companyId: string): Promise<AiRun> {
  await findCompany(ctx.workspaceId, companyId);
  const job = await enqueueAiCompanyNotes({
    companyId,
    workspaceId: ctx.workspaceId,
    requestedById: ctx.userId,
  });
  return { jobId: String(job.id), status: 'queued' };
}

/** The ai.company_notes job: gathers the account's data, asks the provider, saves the notes. */
export async function processCompanyNotes(
  payload: AiCompanyNotesPayload,
  now: Date = new Date(),
): Promise<AiText[]> {
  const scoped = scopedDb(payload.workspaceId);
  const companyRow = await findCompany(payload.workspaceId, payload.companyId);
  const contactRows = await scoped.contact.findMany({
    where: { OR: [{ companyId: companyRow.id }, { companyIds: { has: companyRow.id } }] },
  });
  const contactIds = contactRows.map((c) => c.id);
  const records = [
    { recordType: 'company' as const, recordId: companyRow.id },
    ...(contactIds.length
      ? [{ recordType: 'contact' as const, recordId: { in: contactIds } }]
      : []),
  ];

  const [dealRows, stageRows, taskRows, noteRows, activityRows, requester] = await Promise.all([
    scoped.deal.findMany({
      where: {
        OR: [
          { companyId: companyRow.id },
          ...(contactIds.length ? [{ contactId: { in: contactIds } }] : []),
        ],
      },
    }),
    scoped.stage.findMany({}),
    scoped.task.findMany({ where: { OR: records } }),
    // Private notes never reach the AI.
    scoped.note.findMany({ where: { visibility: 'shared', OR: records } }),
    scoped.activity.findMany({
      where: { OR: records },
      orderBy: { occurredAt: 'desc' },
      take: ACTIVITY_LIMIT,
    }),
    scoped.user.findFirst({ where: { id: payload.requestedById }, select: { language: true } }),
  ]);

  const lines = await getAiProvider(env.AI_PROVIDER).companyNotes({
    company: toSharedCompany(companyRow),
    contacts: contactRows.map(toSharedContact),
    deals: dealRows.map(toSharedDeal),
    stages: stageRows.map(toSharedStage),
    tasks: taskRows.map(toSharedTask),
    notes: noteRows.map(toSharedNote),
    activities: activityRows.map(toSharedActivity),
    now,
    language: requester?.language ?? 'en',
  });

  await scoped.company.update({
    where: { id: companyRow.id },
    data: { aiNotes: lines, aiNotesUpdatedAt: now },
  });
  return lines;
}
