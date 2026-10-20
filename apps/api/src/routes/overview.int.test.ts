import { randomUUID } from 'node:crypto';
import { overviewSchema, type Overview } from '@lulu/shared';
import express from 'express';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { db } from '../db/prisma';
import { errorHandler } from '../middleware/errorHandler';
import type { RequestContext } from '../middleware/requestContext';
import { overviewRouter } from './overview';

const DAY_MS = 24 * 60 * 60 * 1000;
const workspaces: string[] = [];
let current: RequestContext;

const app = express();
app.use((req, _res, next) => {
  req.ctx = current;
  next();
});
app.use('/overview', overviewRouter);
app.use(errorHandler);

function body<T>(response: { body: unknown }): T {
  return (response.body as { data: T }).data;
}

const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);
// Date-only due dates are stored at 12:00 UTC (docs/data-model.md).
const dueInDays = (days: number) => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days, 12));
};

/**
 * A workspace with: 3 live contacts (2 older than a month) and 1 deleted last week, 2 open deals in
 * EUR and 1 won deal, tasks due today, overdue, next week and in a month, and 2 AI signals.
 */
async function workspace() {
  const ws = await db.workspace.create({
    data: { name: `overview-${randomUUID()}`, defaultCurrency: 'EUR' },
  });
  workspaces.push(ws.id);
  const user = await db.user.create({
    data: {
      workspaceId: ws.id,
      name: 'Owner',
      email: `owner-${randomUUID()}@example.test`,
      role: 'owner',
    },
  });
  const pipeline = await db.pipeline.create({
    data: { workspaceId: ws.id, key: 'sales', name: 'Sales', isDefault: true },
  });
  const stage = async (
    key: string,
    order: number,
    probability: number,
    type: 'open' | 'won' | 'lost',
  ) =>
    db.stage.create({
      data: {
        workspaceId: ws.id,
        pipelineId: pipeline.id,
        key,
        name: key,
        order,
        probability,
        type,
      },
    });
  const fresh = await stage('new', 0, 0.2, 'open');
  const proposal = await stage('proposal', 1, 0.5, 'open');
  const won = await stage('won', 2, 1, 'won');

  const contact = (name: string, createdAt: Date, extra: Record<string, unknown> = {}) =>
    db.contact.create({
      data: { workspaceId: ws.id, name, ownerId: user.id, createdAt, ...extra },
    });
  const ada = await contact('Ada', daysAgo(60), { lastTouchAt: daysAgo(1) });
  await contact('Grace', daysAgo(45), { lastTouchAt: daysAgo(3) });
  await contact('Linus', daysAgo(2));
  await contact('Gone', daysAgo(50), { deletedAt: daysAgo(7) });

  const deal = (
    name: string,
    stageId: string,
    value: number,
    probability: number,
    closedAt: Date | null = null,
  ) =>
    db.deal.create({
      data: {
        workspaceId: ws.id,
        name,
        value,
        currency: 'EUR',
        stageId,
        probability,
        ownerId: user.id,
        contactId: ada.id,
        closedAt,
      },
    });
  await deal('Small', fresh.id, 1000, 0.2);
  await deal('Big', proposal.id, 4000, 0.5);
  await deal('Done', won.id, 9000, 1, daysAgo(1));

  const task = (title: string, dueAt: Date) =>
    db.task.create({
      data: {
        workspaceId: ws.id,
        title,
        dueAt,
        ownerId: user.id,
        recordType: 'contact',
        recordId: ada.id,
      },
    });
  await task('today', dueInDays(0));
  await task('overdue', dueInDays(-2));
  await task('next week', dueInDays(5));
  await task('next month', dueInDays(30));

  const activity = (type: 'ai_signal' | 'email', occurredAt: Date) =>
    db.activity.create({
      data: {
        workspaceId: ws.id,
        type,
        recordType: 'contact',
        recordId: ada.id,
        occurredAt,
        sourceModule: 'crm',
        payload: {},
      },
    });
  await activity('ai_signal', daysAgo(0));
  await activity('ai_signal', daysAgo(20));
  await activity('ai_signal', daysAgo(40));
  await activity('email', daysAgo(0));

  return { ws, user, fresh, proposal };
}

afterAll(async () => {
  const where = { workspaceId: { in: workspaces } };
  await db.activity.deleteMany({ where });
  await db.task.deleteMany({ where });
  await db.deal.deleteMany({ where });
  await db.contact.deleteMany({ where });
  await db.stage.deleteMany({ where });
  await db.pipeline.deleteMany({ where });
  await db.user.deleteMany({ where });
  await db.workspace.deleteMany({ where: { id: { in: workspaces } } });
  await db.$disconnect();
});

describe('Overview API (int)', () => {
  it('returns the summary in the contract shape, computed from the real data', async () => {
    const { ws, user, fresh, proposal } = await workspace();
    current = { workspaceId: ws.id, userId: user.id, role: 'member' };
    const response = await request(app).get('/overview');
    expect(response.status).toBe(200);
    const overview = overviewSchema.parse(body<Overview>(response));

    // 3 live contacts; a month ago there were 3 (Ada, Grace and the one deleted since): no change.
    expect(overview.contactCount).toBe(3);
    expect(overview.contactChange).toBe(0);
    expect(overview.openPipeline).toEqual({ amount: 5000, currency: 'EUR' });
    expect(overview.weightedPipeline).toEqual({ amount: 1000 * 0.2 + 4000 * 0.5, currency: 'EUR' });
    expect(overview.activeDeals).toBe(2);
    // Due today, overdue and next week; the one next month is not a follow-up yet.
    expect(overview.followUpsDue).toBe(3);
    expect(overview.dueToday).toBe(1);
    // AI signals of the last 30 days.
    expect(overview.aiSignals).toBe(2);
    expect(overview.pipelineByStage).toEqual([
      { stageId: fresh.id, value: { amount: 1000, currency: 'EUR' }, dealCount: 1 },
      { stageId: proposal.id, value: { amount: 4000, currency: 'EUR' }, dealCount: 1 },
    ]);
    // Most recently touched first; Linus was never touched, so he is not a recent contact.
    expect(overview.recentContacts.map((c) => c.name)).toEqual(['Ada', 'Grace']);
    expect(overview.recentActivity).toHaveLength(4);
    expect(overview.recentActivity[0]!.recordName).toBe('Ada');
  });

  it('shows only its own workspace', async () => {
    await workspace();
    const empty = await db.workspace.create({
      data: { name: `empty-${randomUUID()}`, defaultCurrency: 'USD' },
    });
    workspaces.push(empty.id);
    current = { workspaceId: empty.id, userId: randomUUID(), role: 'owner' };
    const overview = body<Overview>(await request(app).get('/overview'));
    expect(overview).toMatchObject({
      contactCount: 0,
      activeDeals: 0,
      openPipeline: { amount: 0, currency: 'USD' },
    });
    expect(overview.recentActivity).toEqual([]);
  });
});
