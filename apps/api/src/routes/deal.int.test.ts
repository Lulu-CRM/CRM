import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { db } from '../db/prisma';
import { errorHandler } from '../middleware/errorHandler';
import type { RequestContext } from '../middleware/requestContext';
import { dealsRouter } from './deals';
import { pipelinesRouter } from './pipelines';

const STAGES = [
  ['new', 0.1, 'open'],
  ['qualified', 0.3, 'open'],
  ['proposal', 0.5, 'open'],
  ['negotiation', 0.75, 'open'],
  ['won', 1, 'won'],
  ['lost', 0, 'lost'],
] as const;

type StageKey = (typeof STAGES)[number][0];

interface Tenant {
  workspaceId: string;
  userId: string;
  stages: Record<StageKey, string>;
  otherPipelineStageId: string;
}

interface ApiError {
  code: string;
  message?: string;
}

interface ApiEnvelope<T> {
  data: T;
  meta?: {
    page: number;
    pageSize: number;
    total: number;
  };
}

interface ErrorEnvelope {
  error: ApiError;
}

interface DealBody {
  id: string;
  name?: string;
  value?: number;
  currency?: string;
  ownerId?: string;
  workspaceId?: string;
  stageId: string;
  probability: number;
  closedAt: string | null;
}

interface DealSummary {
  openValue: {
    amount: number;
    currency: string;
  };
  weightedValue: {
    amount: number;
  };
  winRate: number | null;
  activeDeals: number;
  averageDaysToClose: number | null;
  otherCurrencyDeals: number;
}

interface DealListItem {
  id: string;
  value: number;
}

interface PipelineWithStages {
  isDefault: boolean;
  stages: Array<{
    key: StageKey | 'triage';
    probability: number;
  }>;
}

/**
 * Supertest exposes response.body as `any`.
 * This helper confines that untyped boundary to one place and gives
 * each test an explicit response shape.
 */
function responseBody<T>(response: { body: unknown }): T {
  return response.body as T;
}

const tenants: Tenant[] = [];
let current: RequestContext;

const app = express();

app.use(express.json());

app.use((req, _res, next) => {
  req.ctx = current;
  next();
});

app.use('/deals', dealsRouter);
app.use('/pipelines', pipelinesRouter);
app.use(errorHandler);

async function tenant(label: string): Promise<Tenant> {
  const workspace = await db.workspace.create({
    data: { name: `${label}-${randomUUID()}` },
  });

  const workspaceId = workspace.id;

  const user = await db.user.create({
    data: {
      workspaceId,
      name: `${label} user`,
      email: `${label}-${randomUUID()}@example.test`,
    },
  });

  const pipeline = await db.pipeline.create({
    data: {
      workspaceId,
      key: 'sales',
      name: 'Sales',
      isDefault: true,
    },
  });

  const stages = {} as Record<StageKey, string>;

  for (const [index, [key, probability, type]] of STAGES.entries()) {
    const stage = await db.stage.create({
      data: {
        workspaceId,
        pipelineId: pipeline.id,
        key,
        name: key,
        order: index,
        probability,
        type,
      },
    });

    stages[key] = stage.id;
  }

  const other = await db.pipeline.create({
    data: {
      workspaceId,
      key: 'support',
      name: 'Support',
      isDefault: false,
    },
  });

  const otherStage = await db.stage.create({
    data: {
      workspaceId,
      pipelineId: other.id,
      key: 'triage',
      name: 'Triage',
      order: 0,
      probability: 0.2,
      type: 'open',
    },
  });

  const created: Tenant = {
    workspaceId,
    userId: user.id,
    stages,
    otherPipelineStageId: otherStage.id,
  };

  tenants.push(created);

  return created;
}

function as(t: Tenant): void {
  current = {
    workspaceId: t.workspaceId,
    userId: t.userId,
    role: 'owner',
  };
}

async function newDeal(t: Tenant, body: Record<string, unknown> = {}): Promise<DealBody> {
  as(t);

  const res = await request(app)
    .post('/deals')
    .send({
      name: 'Deal',
      value: 1000,
      stageId: t.stages.new,
      ...body,
    });

  expect(res.status).toBe(201);

  return responseBody<ApiEnvelope<DealBody>>(res).data;
}

async function summary(t: Tenant): Promise<DealSummary> {
  as(t);

  const res = await request(app).get('/deals/summary');

  expect(res.status).toBe(200);

  return responseBody<ApiEnvelope<DealSummary>>(res).data;
}

function move(t: Tenant, id: string, stageId: string) {
  as(t);

  return request(app).post(`/deals/${id}/move`).send({ stageId });
}

afterAll(async () => {
  const ids = tenants.map((t) => t.workspaceId);
  const where = { workspaceId: { in: ids } };

  await db.activity.deleteMany({ where });
  await db.deal.deleteMany({ where });
  await db.stage.deleteMany({ where });
  await db.pipeline.deleteMany({ where });
  await db.user.deleteMany({ where });
  await db.workspace.deleteMany({
    where: { id: { in: ids } },
  });
  await db.$disconnect();
});

describe('deals API (int)', () => {
  it('creates a deal with defaults from the workspace and the stage', async () => {
    const t = await tenant('create');
    const deal = await newDeal(t, {
      stageId: t.stages.qualified,
    });

    expect(deal.probability).toBe(0.3);
    expect(deal.closedAt).toBeNull();

    as(t);

    const res = await request(app).get(`/deals/${deal.id}`);
    const result = responseBody<ApiEnvelope<DealBody>>(res);

    expect(result.data).toMatchObject({
      currency: 'EUR',
      ownerId: t.userId,
      workspaceId: t.workspaceId,
    });
  });

  it('rejects a stage from another workspace on create', async () => {
    const a = await tenant('create-a');
    const b = await tenant('create-b');

    as(a);

    const res = await request(app).post('/deals').send({
      name: 'Deal',
      value: 1,
      stageId: b.stages.new,
    });

    expect(res.status).toBe(404);

    const result = responseBody<ErrorEnvelope>(res);
    expect(result.error.code).toBe('STAGE_NOT_FOUND');
  });

  it('moving a deal updates the totals', async () => {
    const t = await tenant('totals');
    const first = await newDeal(t, { value: 1000 });
    const second = await newDeal(t, { value: 2000 });

    let s = await summary(t);

    expect(s.openValue.amount).toBe(3000);
    expect(s.weightedValue.amount).toBeCloseTo(300, 2);
    expect(s.activeDeals).toBe(2);
    expect(s.winRate).toBeNull();
    expect(s.averageDaysToClose).toBeNull();

    const won = await move(t, first.id, t.stages.won);
    expect(won.status).toBe(200);

    const wonDeal = responseBody<ApiEnvelope<DealBody>>(won).data;

    expect(wonDeal.closedAt).not.toBeNull();
    expect(wonDeal.probability).toBe(1);

    s = await summary(t);

    expect(s.openValue.amount).toBe(2000);
    expect(s.weightedValue.amount).toBeCloseTo(200, 2);
    expect(s.activeDeals).toBe(1);
    expect(s.winRate).toBe(1);
    expect(s.averageDaysToClose).toBe(0);

    await move(t, second.id, t.stages.lost);

    s = await summary(t);

    expect(s.activeDeals).toBe(0);
    expect(s.winRate).toBe(0.5);

    const reopened = await move(t, first.id, t.stages.qualified);
    const reopenedDeal = responseBody<ApiEnvelope<DealBody>>(reopened).data;

    expect(reopenedDeal.closedAt).toBeNull();

    s = await summary(t);

    expect(s.openValue.amount).toBe(1000);
    expect(s.weightedValue.amount).toBeCloseTo(300, 2);
    expect(s.winRate).toBe(0);
  });

  it('logs a stage_changed activity once per real move', async () => {
    const t = await tenant('activity');
    const deal = await newDeal(t);

    await move(t, deal.id, t.stages.proposal);
    await move(t, deal.id, t.stages.proposal);

    const activities = await db.activity.findMany({
      where: {
        workspaceId: t.workspaceId,
        recordType: 'deal',
        recordId: deal.id,
      },
    });

    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      type: 'stage_changed',
      actorId: t.userId,
      payload: {
        fromStageId: t.stages.new,
        toStageId: t.stages.proposal,
      },
    });
  });

  it('reports move errors with their codes', async () => {
    const a = await tenant('errors-a');
    const b = await tenant('errors-b');
    const deal = await newDeal(a);

    const unknown = await move(a, deal.id, randomUUID());

    expect(unknown.status).toBe(404);
    expect(responseBody<ErrorEnvelope>(unknown).error.code).toBe('STAGE_NOT_FOUND');

    const foreign = await move(a, deal.id, b.stages.won);

    expect(foreign.status).toBe(404);
    expect(responseBody<ErrorEnvelope>(foreign).error.code).toBe('STAGE_NOT_FOUND');

    const otherPipeline = await move(a, deal.id, a.otherPipelineStageId);

    expect(otherPipeline.status).toBe(400);
    expect(responseBody<ErrorEnvelope>(otherPipeline).error.code).toBe('STAGE_IN_OTHER_PIPELINE');

    const missing = await move(a, randomUUID(), a.stages.won);

    expect(missing.status).toBe(404);
    expect(responseBody<ErrorEnvelope>(missing).error.code).toBe('DEAL_NOT_FOUND');
  });

  it('edits a deal but never its stage', async () => {
    const t = await tenant('patch');
    const deal = await newDeal(t);

    as(t);

    const rejected = await request(app).patch(`/deals/${deal.id}`).send({ stageId: t.stages.won });

    expect(rejected.status).toBe(400);
    expect(responseBody<ErrorEnvelope>(rejected).error.code).toBe('VALIDATION_ERROR');

    const edited = await request(app).patch(`/deals/${deal.id}`).send({ name: 'Renamed' });

    expect(edited.status).toBe(200);
    expect(responseBody<ApiEnvelope<DealBody>>(edited).data).toMatchObject({
      name: 'Renamed',
      stageId: t.stages.new,
    });
  });

  it('soft deletes a deal and leaves it out of lists and totals', async () => {
    const t = await tenant('delete');
    const deal = await newDeal(t);

    await newDeal(t);
    as(t);

    expect((await request(app).delete(`/deals/${deal.id}`)).status).toBe(204);

    expect((await request(app).get(`/deals/${deal.id}`)).status).toBe(404);

    const list = await request(app).get('/deals');
    const result = responseBody<
      ApiEnvelope<DealListItem[]> & {
        meta: { page: number; pageSize: number; total: number };
      }
    >(list);

    expect(result.meta.total).toBe(1);
    expect((await summary(t)).activeDeals).toBe(1);
    expect(await db.deal.findUnique({ where: { id: deal.id } })).not.toBeNull();
  });

  it('counts open deals in other currencies without adding them', async () => {
    const t = await tenant('currency');

    await newDeal(t, { value: 1000 });
    await newDeal(t, { value: 5000, currency: 'USD' });

    const s = await summary(t);

    expect(s.openValue.amount).toBe(1000);
    expect(s.otherCurrencyDeals).toBe(1);
  });

  it("never shows or changes another workspace's deal", async () => {
    const a = await tenant('iso-a');
    const b = await tenant('iso-b');
    const deal = await newDeal(a);

    as(b);

    expect((await request(app).get(`/deals/${deal.id}`)).status).toBe(404);

    expect((await request(app).patch(`/deals/${deal.id}`).send({ name: 'x' })).status).toBe(404);

    expect((await move(b, deal.id, b.stages.won)).status).toBe(404);

    as(b);

    expect((await request(app).delete(`/deals/${deal.id}`)).status).toBe(404);

    const list = await request(app).get('/deals');
    const result = responseBody<
      ApiEnvelope<DealListItem[]> & {
        meta: { page: number; pageSize: number; total: number };
      }
    >(list);

    expect(result.meta.total).toBe(0);

    const untouched = await db.deal.findUniqueOrThrow({
      where: { id: deal.id },
    });

    expect(untouched.name).toBe('Deal');
    expect(untouched.stageId).toBe(a.stages.new);
    expect(untouched.deletedAt).toBeNull();
  });

  it('filters, searches, sorts and pages', async () => {
    const t = await tenant('list');
    const won = await newDeal(t, {
      name: 'Alpha site',
      value: 300,
    });

    await newDeal(t, { name: 'Beta shop', value: 100 });
    await newDeal(t, { name: 'Gamma app', value: 200 });

    await move(t, won.id, t.stages.won);
    as(t);

    const byStatus = await request(app).get('/deals?status=won');
    const statusResult = responseBody<ApiEnvelope<DealListItem[]>>(byStatus);

    expect(statusResult.data.map((deal) => deal.id)).toEqual([won.id]);

    const bySearch = await request(app).get('/deals?q=shop');
    const searchResult = responseBody<ApiEnvelope<DealListItem[]>>(bySearch);

    expect(searchResult.data).toHaveLength(1);

    const sorted = await request(app).get('/deals?sort=-value&pageSize=2&page=1');

    const sortedResult = responseBody<
      ApiEnvelope<DealListItem[]> & {
        meta: { page: number; pageSize: number; total: number };
      }
    >(sorted);

    expect(sortedResult.data.map((deal) => deal.value)).toEqual([300, 200]);

    expect(sortedResult.meta).toEqual({
      page: 1,
      pageSize: 2,
      total: 3,
    });

    expect((await request(app).get('/deals?sort=password')).status).toBe(400);
  });

  it('lists pipelines with ordered stages and numeric probabilities', async () => {
    const t = await tenant('pipelines');

    as(t);

    const res = await request(app).get('/pipelines');

    expect(res.status).toBe(200);

    const result = responseBody<ApiEnvelope<PipelineWithStages[]>>(res);

    const [first] = result.data;

    expect(first).toBeDefined();

    if (!first) {
      throw new Error('Expected the default pipeline to be returned');
    }

    expect(first.isDefault).toBe(true);

    expect(first.stages.map((stage) => stage.key)).toEqual(STAGES.map(([key]) => key));

    expect(first.stages[3]?.probability).toBe(0.75);
  });
});
