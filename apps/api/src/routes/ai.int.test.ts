import { randomUUID } from 'node:crypto';
import { aiInsightSchema, type AiInsight, type AiRun } from '@lulu/shared';
import express from 'express';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { db } from '../db/prisma';
import { aiAnalyzeQueue, closeQueues } from '../jobs/queues';
import { startWorkers, stopWorkers } from '../jobs/workers';
import { errorHandler } from '../middleware/errorHandler';
import type { RequestContext } from '../middleware/requestContext';
import { processAiAnalyze } from '../services/ai';
import { aiRouter } from './ai';

interface Tenant {
  workspaceId: string;
  userId: string;
  contactId: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const tenants: Tenant[] = [];
let current: RequestContext;

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.ctx = current;
  next();
});
app.use(aiRouter);
app.use(errorHandler);

function body<T>(response: { body: unknown }): T {
  return (response.body as { data: T }).data;
}
function errorCode(response: { body: unknown }): string {
  return (response.body as { error: { code: string } }).error.code;
}

/**
 * A workspace with the default stages and one contact: a new lead, touched yesterday, with no deals
 * or due tasks. The simulated provider then suggests qualifying them: a task plus the stage change.
 */
async function tenant(label: string, role: RequestContext['role'] = 'owner'): Promise<Tenant> {
  const workspace = await db.workspace.create({ data: { name: `${label}-${randomUUID()}` } });
  const user = await db.user.create({
    data: {
      workspaceId: workspace.id,
      name: `${label} user`,
      email: `${label}-${randomUUID()}@example.test`,
      role,
    },
  });
  const pipeline = await db.pipeline.create({
    data: { workspaceId: workspace.id, key: 'sales', name: 'Sales', isDefault: true },
  });
  const stages = [
    ['new', 0.2, 'open'],
    ['won', 1, 'won'],
    ['lost', 0, 'lost'],
  ] as const;
  for (const [index, [key, probability, type]] of stages.entries()) {
    await db.stage.create({
      data: {
        workspaceId: workspace.id,
        pipelineId: pipeline.id,
        key,
        name: key,
        order: index,
        probability,
        type,
      },
    });
  }
  const contact = await db.contact.create({
    data: {
      workspaceId: workspace.id,
      name: 'Mila Rossi',
      email: `mila-${randomUUID()}@example.test`,
      lifecycleStage: 'new',
      ownerId: user.id,
      lastTouchAt: new Date(Date.now() - DAY_MS),
    },
  });
  const t = { workspaceId: workspace.id, userId: user.id, contactId: contact.id };
  tenants.push(t);
  return t;
}

function as(t: Tenant, role: RequestContext['role'] = 'owner') {
  current = { workspaceId: t.workspaceId, userId: t.userId, role };
}

async function analyzed(t: Tenant): Promise<AiInsight> {
  return processAiAnalyze({
    contactId: t.contactId,
    workspaceId: t.workspaceId,
    requestedById: t.userId,
  });
}

afterAll(async () => {
  await stopWorkers();
  await aiAnalyzeQueue.obliterate({ force: true });
  const ids = tenants.map((t) => t.workspaceId);
  const where = { workspaceId: { in: ids } };
  await db.activity.deleteMany({ where });
  await db.task.deleteMany({ where });
  await db.aiInsight.deleteMany({ where });
  await db.contact.deleteMany({ where });
  await db.stage.deleteMany({ where });
  await db.pipeline.deleteMany({ where });
  await db.user.deleteMany({ where });
  await db.workspace.deleteMany({ where: { id: { in: ids } } });
  await closeQueues();
  await db.$disconnect();
});

describe('AI analysis API (int)', () => {
  it('queues an analysis for a contact and answers at once', async () => {
    const t = await tenant('run');
    as(t);
    const response = await request(app).post(`/contacts/${t.contactId}/ai-analysis`);
    expect(response.status).toBe(200);
    const run = body<AiRun>(response);
    expect(run.status).toBe('queued');

    // The job is on the queue with what the worker needs (a running worker may already have it).
    const job = await aiAnalyzeQueue.getJob(run.jobId);
    expect(job?.data).toEqual({
      contactId: t.contactId,
      workspaceId: t.workspaceId,
      requestedById: t.userId,
    });
  });

  it("refuses an unknown contact and another workspace's contact", async () => {
    const mine = await tenant('mine');
    const theirs = await tenant('theirs');
    as(mine);
    const unknown = await request(app).post(`/contacts/${randomUUID()}/ai-analysis`);
    expect(unknown.status).toBe(404);
    expect(errorCode(unknown)).toBe('CONTACT_NOT_FOUND');
    const foreign = await request(app).get(`/contacts/${theirs.contactId}/ai-insights`);
    expect(errorCode(foreign)).toBe('CONTACT_NOT_FOUND');
  });

  it('the job stores a suggested insight in the contract shape, readable as the latest', async () => {
    const t = await tenant('job');
    as(t);
    expect(body(await request(app).get(`/contacts/${t.contactId}/ai-insights`))).toBeNull();

    const insight = await analyzed(t);
    expect(insight).toMatchObject({
      contactId: t.contactId,
      provider: 'simulated',
      status: 'suggested',
      suggestedStage: 'qualified',
      nextStep: { title: { key: 'nextQualify', params: {} } },
    });
    expect(insight.suggestedTask?.title).toEqual({
      key: 'taskQualify',
      params: { name: 'Mila Rossi' },
    });

    const latest = body<AiInsight>(await request(app).get(`/contacts/${t.contactId}/ai-insights`));
    expect(aiInsightSchema.parse(latest)).toEqual(insight);
  });

  it('saves nothing until accepted, then only what was ticked', async () => {
    const t = await tenant('accept');
    as(t);
    const insight = await analyzed(t);
    expect(await db.task.count({ where: { workspaceId: t.workspaceId } })).toBe(0);

    const response = await request(app)
      .post(`/ai-insights/${insight.id}/accept`)
      .send({ createTask: true, taskTitle: 'Call Mila about her budget', applyStage: true });
    expect(response.status).toBe(200);
    expect(body<AiInsight>(response).status).toBe('accepted');

    const tasks = await db.task.findMany({ where: { workspaceId: t.workspaceId } });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      title: 'Call Mila about her budget',
      recordType: 'contact',
      recordId: t.contactId,
      ownerId: t.userId,
      dueAt: new Date(insight.suggestedTask!.dueAt),
    });
    const contact = await db.contact.findUniqueOrThrow({ where: { id: t.contactId } });
    expect(contact.lifecycleStage).toBe('qualified');

    const activity = await db.activity.findFirstOrThrow({
      where: { workspaceId: t.workspaceId, type: 'ai_signal' },
    });
    expect(activity).toMatchObject({
      recordType: 'contact',
      recordId: t.contactId,
      actorId: t.userId,
    });
    expect(activity.payload).toMatchObject({ insightId: insight.id, action: 'accepted' });

    // Accepted once: it cannot be accepted or dismissed again.
    const again = await request(app)
      .post(`/ai-insights/${insight.id}/accept`)
      .send({ createTask: false, applyStage: true });
    expect(again.status).toBe(409);
    expect(errorCode(again)).toBe('AI_INSIGHT_CLOSED');
  });

  it('accepting with nothing ticked only closes the insight', async () => {
    const t = await tenant('nothing');
    as(t);
    const insight = await analyzed(t);
    await request(app)
      .post(`/ai-insights/${insight.id}/accept`)
      .send({ createTask: false, applyStage: false });
    expect(await db.task.count({ where: { workspaceId: t.workspaceId } })).toBe(0);
    expect(
      (await db.contact.findUniqueOrThrow({ where: { id: t.contactId } })).lifecycleStage,
    ).toBe('new');
  });

  it('needs a task title when a task is created', async () => {
    const t = await tenant('title');
    as(t);
    const insight = await analyzed(t);
    const response = await request(app)
      .post(`/ai-insights/${insight.id}/accept`)
      .send({ createTask: true, applyStage: false });
    expect(response.status).toBe(400);
    expect(errorCode(response)).toBe('VALIDATION_ERROR');
  });

  it('dismissing saves nothing and closes the insight', async () => {
    const t = await tenant('dismiss');
    as(t);
    const insight = await analyzed(t);
    expect((await request(app).post(`/ai-insights/${insight.id}/dismiss`)).status).toBe(204);
    expect(
      body<AiInsight>(await request(app).get(`/contacts/${t.contactId}/ai-insights`)).status,
    ).toBe('dismissed');
    expect(await db.task.count({ where: { workspaceId: t.workspaceId } })).toBe(0);

    const accept = await request(app)
      .post(`/ai-insights/${insight.id}/accept`)
      .send({ createTask: false, applyStage: true });
    expect(errorCode(accept)).toBe('AI_INSIGHT_CLOSED');
  });

  it("never shows or changes another workspace's insight", async () => {
    const owner = await tenant('owner');
    const other = await tenant('other');
    const insight = await analyzed(owner);
    as(other);
    const accept = await request(app)
      .post(`/ai-insights/${insight.id}/accept`)
      .send({ createTask: false, applyStage: true });
    expect(accept.status).toBe(404);
    expect(errorCode(accept)).toBe('AI_INSIGHT_NOT_FOUND');
    expect((await db.aiInsight.findUniqueOrThrow({ where: { id: insight.id } })).status).toBe(
      'suggested',
    );
  });

  it('runs end to end through the queue and the worker', async () => {
    const t = await tenant('worker');
    as(t);
    startWorkers();
    await request(app).post(`/contacts/${t.contactId}/ai-analysis`);

    let latest: AiInsight | null = null;
    for (let i = 0; i < 50 && latest === null; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      latest = body<AiInsight | null>(
        await request(app).get(`/contacts/${t.contactId}/ai-insights`),
      );
    }
    expect(latest?.status).toBe('suggested');
    expect(latest?.contactId).toBe(t.contactId);
  });
});
