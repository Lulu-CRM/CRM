import { randomUUID } from 'node:crypto';
import {
  defaultAiSettings,
  defaultConsentSettings,
  defaultPermissions,
  type CustomField,
  type RolePermissions,
  type Stage,
} from '@lulu/shared';
import express from 'express';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { db } from '../db/prisma';
import { errorHandler } from '../middleware/errorHandler';
import type { RequestContext } from '../middleware/requestContext';
import { settingsRouter } from './settings';

interface Tenant {
  workspaceId: string;
  ownerId: string;
  memberId: string;
  pipelineId: string;
  stages: Record<string, string>;
}

const tenants: Tenant[] = [];
let current: RequestContext;

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.ctx = current;
  next();
});
app.use('/settings', settingsRouter);
app.use(errorHandler);

function body<T>(response: { body: unknown }): T {
  return (response.body as { data: T }).data;
}
function errorCode(response: { body: unknown }): string {
  return (response.body as { error: { code: string } }).error.code;
}

async function tenant(label: string): Promise<Tenant> {
  const workspace = await db.workspace.create({ data: { name: `${label}-${randomUUID()}` } });
  const user = (role: 'owner' | 'member') =>
    db.user.create({
      data: {
        workspaceId: workspace.id,
        name: `${label} ${role}`,
        email: `${label}-${role}-${randomUUID()}@example.test`,
        role,
      },
    });
  const [owner, member] = [await user('owner'), await user('member')];
  const pipeline = await db.pipeline.create({
    data: { workspaceId: workspace.id, key: 'sales', name: 'Sales', isDefault: true },
  });
  const stages: Record<string, string> = {};
  const defs = [
    ['new', 0.2, 'open'],
    ['qualified', 0.4, 'open'],
    ['proposal', 0.7, 'open'],
    ['won', 1, 'won'],
    ['lost', 0, 'lost'],
  ] as const;
  for (const [order, [key, probability, type]] of defs.entries()) {
    const stage = await db.stage.create({
      data: {
        workspaceId: workspace.id,
        pipelineId: pipeline.id,
        key,
        name: key[0]!.toUpperCase() + key.slice(1),
        order,
        probability,
        type,
      },
    });
    stages[key] = stage.id;
  }
  const t = {
    workspaceId: workspace.id,
    ownerId: owner.id,
    memberId: member.id,
    pipelineId: pipeline.id,
    stages,
  };
  tenants.push(t);
  return t;
}

const asOwner = (t: Tenant) =>
  (current = { workspaceId: t.workspaceId, userId: t.ownerId, role: 'owner' });
const asMember = (t: Tenant) =>
  (current = { workspaceId: t.workspaceId, userId: t.memberId, role: 'member' });

async function stageNames(t: Tenant) {
  const rows = await db.stage.findMany({
    where: { pipelineId: t.pipelineId, deletedAt: null },
    orderBy: { order: 'asc' },
  });
  return rows.map((s) => `${s.order}:${s.name}`);
}

afterAll(async () => {
  const ids = tenants.map((t) => t.workspaceId);
  const where = { workspaceId: { in: ids } };
  await db.deal.deleteMany({ where });
  await db.customField.deleteMany({ where });
  await db.setting.deleteMany({ where });
  await db.permission.deleteMany({ where });
  await db.stage.deleteMany({ where });
  await db.pipeline.deleteMany({ where });
  await db.user.deleteMany({ where });
  await db.workspace.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});

describe('Settings API (int)', () => {
  it('answers with the shared defaults until a workspace saves its own', async () => {
    const t = await tenant('defaults');
    asMember(t);
    expect(body(await request(app).get('/settings/consent'))).toEqual(defaultConsentSettings);
    expect(body(await request(app).get('/settings/ai'))).toEqual(defaultAiSettings);
    expect(body(await request(app).get('/settings/roles'))).toEqual(defaultPermissions);
    expect(body(await request(app).get('/settings/custom-fields'))).toEqual([]);
  });

  it('lets anyone read but only roles with settings: edit change settings', async () => {
    const t = await tenant('guard');
    asMember(t);
    const denied = await request(app)
      .put('/settings/consent')
      .send({ ...defaultConsentSettings, importedContactsConsent: 'granted' });
    expect(denied.status).toBe(403);
    expect(errorCode(denied)).toBe('FORBIDDEN');
    expect(
      (
        await request(app)
          .post('/settings/custom-fields')
          .send({ key: 'tier', label: 'Tier', type: 'text' })
      ).status,
    ).toBe(403);

    asOwner(t);
    const saved = await request(app)
      .put('/settings/consent')
      .send({ ...defaultConsentSettings, importedContactsConsent: 'granted' });
    expect(body<{ importedContactsConsent: string }>(saved).importedContactsConsent).toBe(
      'granted',
    );
    asMember(t);
    expect(
      body<{ importedContactsConsent: string }>(await request(app).get('/settings/consent'))
        .importedContactsConsent,
    ).toBe('granted');
  });

  it('saves notifications and AI switches, rejecting incomplete bodies', async () => {
    const t = await tenant('kv');
    asOwner(t);
    const ai = await request(app)
      .put('/settings/ai')
      .send({ ...defaultAiSettings, suggestFollowUps: false });
    expect(body<{ suggestFollowUps: boolean }>(ai).suggestFollowUps).toBe(false);
    const bad = await request(app).put('/settings/ai').send({ suggestFollowUps: false });
    expect(errorCode(bad)).toBe('VALIDATION_ERROR');

    const notifications = body<Record<string, { email: boolean }>>(
      await request(app).get('/settings/notifications'),
    );
    notifications.taskDue!.email = true;
    await request(app).put('/settings/notifications').send(notifications);
    expect(
      body<Record<string, { email: boolean }>>(await request(app).get('/settings/notifications'))
        .taskDue!.email,
    ).toBe(true);
  });

  it('saves role permissions, and the role guard uses them at once', async () => {
    const t = await tenant('roles');
    asOwner(t);
    const permissions: RolePermissions = structuredClone(defaultPermissions);
    permissions.member.settings = ['view', 'edit'];
    const saved = await request(app).put('/settings/roles').send(permissions);
    expect(body<RolePermissions>(saved).member.settings).toEqual(['view', 'edit']);

    // The member may now change settings.
    asMember(t);
    const allowed = await request(app).put('/settings/ai').send(defaultAiSettings);
    expect(allowed.status).toBe(200);
  });

  it('manages custom fields: keys and types stay, select needs choices, keys can be reused after delete', async () => {
    const t = await tenant('fields');
    asOwner(t);
    const noChoices = await request(app)
      .post('/settings/custom-fields')
      .send({ key: 'tier', label: 'Tier', type: 'select' });
    expect(errorCode(noChoices)).toBe('VALIDATION_ERROR');

    const created = body<CustomField>(
      await request(app)
        .post('/settings/custom-fields')
        .send({ key: 'tier', label: 'Tier', type: 'select', options: ['Gold'] }),
    );
    expect(created).toMatchObject({
      entity: 'contact',
      key: 'tier',
      type: 'select',
      options: ['Gold'],
    });

    const dup = await request(app)
      .post('/settings/custom-fields')
      .send({ key: 'tier', label: 'Other', type: 'text' });
    expect(dup.status).toBe(409);
    expect(errorCode(dup)).toBe('CUSTOM_FIELD_KEY_TAKEN');

    const renamed = await request(app)
      .patch(`/settings/custom-fields/${created.id}`)
      .send({ label: 'Customer tier', options: ['Gold', 'Silver'] });
    expect(body<CustomField>(renamed)).toMatchObject({
      key: 'tier',
      label: 'Customer tier',
      options: ['Gold', 'Silver'],
    });
    expect(
      (await request(app).patch(`/settings/custom-fields/${created.id}`).send({ type: 'text' }))
        .status,
    ).toBe(400);

    expect((await request(app).delete(`/settings/custom-fields/${created.id}`)).status).toBe(204);
    expect(body(await request(app).get('/settings/custom-fields'))).toEqual([]);
    const again = await request(app)
      .post('/settings/custom-fields')
      .send({ key: 'tier', label: 'Tier', type: 'text' });
    expect(again.status).toBe(201);
    expect(
      (await request(app).patch(`/settings/custom-fields/${created.id}`).send({ label: 'x' }))
        .status,
    ).toBe(404);
  });

  it('adds, renames, reorders and protects stages', async () => {
    const t = await tenant('stages');
    asOwner(t);
    const added = body<Stage>(
      await request(app)
        .post('/settings/stages')
        .send({ pipelineId: t.pipelineId, name: 'Demo booked', probability: 0.55 }),
    );
    expect(added).toMatchObject({ key: null, type: 'open', probability: 0.55 });
    expect(await stageNames(t)).toEqual([
      '0:New',
      '1:Qualified',
      '2:Proposal',
      '3:Demo booked',
      '4:Won',
      '5:Lost',
    ]);

    // Renaming a default stage clears its key, so the new name shows in every language.
    const renamed = body<Stage>(
      await request(app)
        .patch(`/settings/stages/${t.stages.proposal}`)
        .send({ name: 'Offer sent' }),
    );
    expect(renamed).toMatchObject({ name: 'Offer sent', key: null });

    await request(app).patch(`/settings/stages/${added.id}`).send({ order: 0 });
    expect(await stageNames(t)).toEqual([
      '0:Demo booked',
      '1:New',
      '2:Qualified',
      '3:Offer sent',
      '4:Won',
      '5:Lost',
    ]);

    const won = await request(app).delete(`/settings/stages/${t.stages.won}`);
    expect(errorCode(won)).toBe('STAGE_LOCKED');

    await db.deal.create({
      data: {
        workspaceId: t.workspaceId,
        name: 'Deal',
        value: 1,
        currency: 'EUR',
        stageId: t.stages.new!,
        probability: 0.2,
        ownerId: t.ownerId,
      },
    });
    const inUse = await request(app).delete(`/settings/stages/${t.stages.new}`);
    expect(errorCode(inUse)).toBe('STAGE_IN_USE');

    expect((await request(app).delete(`/settings/stages/${added.id}`)).status).toBe(204);
    expect(await stageNames(t)).toEqual([
      '0:New',
      '1:Qualified',
      '2:Offer sent',
      '3:Won',
      '4:Lost',
    ]);
  });

  it("never touches another workspace's stages or fields", async () => {
    const mine = await tenant('mine');
    const theirs = await tenant('theirs');
    asOwner(mine);
    const stage = await request(app)
      .patch(`/settings/stages/${theirs.stages.new}`)
      .send({ name: 'Hacked' });
    expect(errorCode(stage)).toBe('STAGE_NOT_FOUND');
    const pipeline = await request(app)
      .post('/settings/stages')
      .send({ pipelineId: theirs.pipelineId, name: 'X', probability: 0.1 });
    expect(errorCode(pipeline)).toBe('PIPELINE_NOT_FOUND');
  });
});
