import { buildOverview, type Overview } from '@lulu/shared';
import { db } from '../db/prisma';
import { scopedDb } from '../db/scoped';
import type { RequestContext } from '../middleware/requestContext';
import { toSharedCompany } from './companyMapper';
import { toSharedContact } from './contactMapper';
import { toSharedDeal, toSharedStage } from './dealMapper';
import { toSharedActivity, toSharedTask } from './timeline';

// GET /overview (docs/api.md, "Overview"). The numbers come from buildOverview in packages/shared, the
// same function the web app's mock uses, so the page shows the same thing on sample and real data.

const DAY_MS = 24 * 60 * 60 * 1000;
// buildOverview counts AI signals of the last 30 days; load a day more so the edge is covered.
const ACTIVITY_WINDOW_DAYS = 31;
const RECENT_ACTIVITY = 5;

export async function getOverview(ctx: RequestContext, now: Date = new Date()): Promise<Overview> {
  const scoped = scopedDb(ctx.workspaceId);
  const since = new Date(now.getTime() - ACTIVITY_WINDOW_DAYS * DAY_MS);

  const [
    workspace,
    contacts,
    deletedContacts,
    companies,
    deals,
    stages,
    tasks,
    windowActivity,
    latestActivity,
  ] = await Promise.all([
    db.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId } }),
    scoped.contact.findMany({}),
    // Deleted contacts still counted a month ago, for the change against last month.
    scoped.contact.findMany({ where: { deletedAt: { not: null } } }),
    scoped.company.findMany({}),
    scoped.deal.findMany({}),
    // The default pipeline's stages: the snapshot shows one pipeline.
    scoped.stage.findMany({ where: { pipeline: { isDefault: true } }, orderBy: { order: 'asc' } }),
    scoped.task.findMany({ where: { done: false } }),
    scoped.activity.findMany({ where: { occurredAt: { gte: since } } }),
    scoped.activity.findMany({ orderBy: { occurredAt: 'desc' }, take: RECENT_ACTIVITY }),
  ]);

  // The newest activities may be older than the window; keep each row once.
  const activities = new Map([...windowActivity, ...latestActivity].map((row) => [row.id, row]));

  return buildOverview(
    {
      contacts: [...contacts, ...deletedContacts].map(toSharedContact),
      companies: companies.map(toSharedCompany),
      deals: deals.map(toSharedDeal),
      stages: stages.map(toSharedStage),
      tasks: tasks.map(toSharedTask),
      activities: [...activities.values()].map(toSharedActivity),
      currency: workspace.defaultCurrency,
    },
    now,
    // "Due today" uses UTC until workspaces have a time zone (docs/data-model.md).
    'UTC',
  );
}
