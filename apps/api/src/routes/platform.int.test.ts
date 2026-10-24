import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { db } from '../db/prisma';
import { dispatchOutbox, MAX_ATTEMPTS, onDomainEvent, type DomainEvent } from '../jobs/outbox';
import { setActor } from '../lib/actorContext';
import { errorHandler } from '../middleware/errorHandler';
import type { RequestContext } from '../middleware/requestContext';
import { requestId } from '../middleware/requestId';
import { auditRouter } from './audit';
import { contactsRouter } from './contacts';
import { eventsRouter } from './events';

// Platform alignment (Oct 23, 2026): audit log, domain-event outbox, correlation ids and
// deduplicated module events.

const workspaces: string[] = [];
let current: RequestContext;

const app = express();
app.use(express.json());
app.use(requestId);
app.use((req, _res, next) => {
  req.ctx = current;
  // What requireAuth does after it has verified the token.
  setActor({ actorType: 'user', actorId: current.userId, workspaceId: current.workspaceId });
  next();
});
app.use('/contacts', contactsRouter);
app.use('/events', eventsRouter);
app.use('/audit-log', auditRouter);
app.use(errorHandler);

const data = <T>(r: { body: unknown }) => (r.body as { data: T }).data;

async function workspace() {
  const ws = await db.workspace.create({ data: { name: `platform-${randomUUID()}` } });
  workspaces.push(ws.id);
  const user = (role: 'owner' | 'member') =>
    db.user.create({
      data: {
        workspaceId: ws.id,
        name: role,
        email: `${role}-${randomUUID()}@example.test`,
        role,
        passwordHash: 'secret-hash-never-in-audit',
      },
    });
  const [owner, member] = [await user('owner'), await user('member')];
  return {
    ws,
    owner,
    member,
    asOwner: () => (current = { workspaceId: ws.id, userId: owner.id, role: 'owner' }),
    asMember: () => (current = { workspaceId: ws.id, userId: member.id, role: 'member' }),
  };
}

afterAll(async () => {
  const where = { workspaceId: { in: workspaces } };
  await db.activity.deleteMany({ where });
  await db.contact.deleteMany({ where });
  await db.user.deleteMany({ where });
  await db.workspace.deleteMany({ where: { id: { in: workspaces } } });
  await db.auditLog.deleteMany({ where });
  await db.outboxEvent.deleteMany({ where });
  await db.$disconnect();
});

describe('Audit log and outbox (int)', () => {
  it('records who changed what, with the request correlation id, and an event per change', async () => {
    const t = await workspace();
    t.asOwner();
    const correlationId = `test-${randomUUID()}`;
    const created = await request(app)
      .post('/contacts')
      .set('X-Request-Id', correlationId)
      .send({ name: 'Ada Lovelace', email: 'ada@example.test' });
    expect(created.status).toBe(201);
    expect(created.headers['x-request-id']).toBe(correlationId);
    const contactId = data<{ id: string }>(created).id;

    await request(app).patch(`/contacts/${contactId}`).send({ jobRole: 'Analyst' });
    await request(app).delete(`/contacts/${contactId}`);

    const entries = await db.auditLog.findMany({
      where: { workspaceId: t.ws.id, entityType: 'contact', entityId: contactId },
      orderBy: { createdAt: 'asc' },
    });
    expect(entries.map((e) => e.action)).toEqual(['create', 'update', 'delete']);
    expect(entries[0]).toMatchObject({ actorType: 'user', actorId: t.owner.id, correlationId });
    expect(entries[0]!.changes).toMatchObject({ name: 'Ada Lovelace', email: 'ada@example.test' });
    expect(entries[1]!.changes).toEqual({ jobRole: 'Analyst' });

    const events = await db.outboxEvent.findMany({
      where: { workspaceId: t.ws.id, aggregateId: contactId },
      orderBy: { occurredAt: 'asc' },
    });
    expect(events.map((e) => e.eventType)).toEqual([
      'contact.created',
      'contact.updated',
      'contact.deleted',
    ]);
    expect(events[1]!.payload).toEqual({ id: contactId, fields: ['jobRole'] });
  });

  it('never copies a password hash into the audit log', async () => {
    const t = await workspace();
    const rows = await db.auditLog.findMany({
      where: { workspaceId: t.ws.id, entityType: 'user' },
    });
    expect(rows).toHaveLength(2);
    expect(JSON.stringify(rows)).not.toContain('secret-hash-never-in-audit');
  });

  it('lets owners read their own workspace audit log, but not members', async () => {
    const t = await workspace();
    const other = await workspace();
    t.asOwner();
    await request(app).post('/contacts').send({ name: 'Grace Hopper' });

    const list = await request(app).get('/audit-log?entityType=contact');
    expect(list.status).toBe(200);
    const items = data<Array<{ workspaceId: string; entityType: string; action: string }>>(list);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((e) => e.workspaceId === t.ws.id && e.entityType === 'contact')).toBe(true);

    other.asOwner();
    const theirs = data<Array<{ entityType: string }>>(
      await request(app).get('/audit-log?entityType=contact'),
    );
    expect(theirs).toEqual([]);

    t.asMember();
    expect((await request(app).get('/audit-log')).status).toBe(403);
  });

  it('dispatches events to listeners and parks one that keeps failing', async () => {
    const t = await workspace();
    t.asOwner();
    const good = data<{ id: string }>(
      await request(app).post('/contacts').send({ name: 'Delivered' }),
    ).id;
    const bad = data<{ id: string }>(
      await request(app).post('/contacts').send({ name: 'Broken' }),
    ).id;

    const seen: DomainEvent[] = [];
    const stop = onDomainEvent('contact.created', (event) => {
      if (event.workspaceId !== t.ws.id) return;
      if (event.aggregateId === bad) throw new Error('listener down');
      seen.push(event);
    });
    try {
      for (let i = 0; i < MAX_ATTEMPTS + 1; i++) await dispatchOutbox(100, t.ws.id);
    } finally {
      stop();
    }

    expect(seen.map((e) => e.aggregateId)).toEqual([good]);
    const rows = await db.outboxEvent.findMany({
      where: { workspaceId: t.ws.id, eventType: 'contact.created' },
    });
    const byId = new Map(rows.map((r) => [r.aggregateId, r]));
    expect(byId.get(good)).toMatchObject({ status: 'dispatched', attempts: 1 });
    expect(byId.get(bad)).toMatchObject({
      status: 'failed',
      attempts: MAX_ATTEMPTS,
      lastError: 'listener down',
    });
  });
});

describe('POST /events deduplication (int)', () => {
  it('records an event once, however often it is sent', async () => {
    const t = await workspace();
    t.asOwner();
    const contact = await db.contact.create({
      data: {
        workspaceId: t.ws.id,
        name: 'Sophie',
        email: 'sophie@example.test',
        ownerId: t.owner.id,
      },
    });
    const event = {
      eventId: `email-${randomUUID()}`,
      type: 'email.received',
      sourceModule: 'email',
      occurredAt: '2026-10-20T09:00:00Z',
      contact: { email: 'sophie@example.test' },
      summary: 'Reply',
    };

    const first = await request(app).post('/events').send(event);
    expect(first.status).toBe(201);
    await db.contact.update({
      where: { id: contact.id },
      data: { lastTouchAt: new Date('2026-10-22T00:00:00Z') },
    });

    const again = await request(app)
      .post('/events')
      .send({ ...event, occurredAt: '2026-10-23T09:00:00Z' });
    expect(again.status).toBe(200);
    expect(data<{ id: string }>(again).id).toBe(data<{ id: string }>(first).id);

    expect(await db.activity.count({ where: { workspaceId: t.ws.id, recordId: contact.id } })).toBe(
      1,
    );
    // The repeat changed nothing: lastTouchAt stays where it was.
    const after = await db.contact.findUniqueOrThrow({ where: { id: contact.id } });
    expect(after.lastTouchAt?.toISOString()).toBe('2026-10-22T00:00:00.000Z');

    // The same id from another module is a different event.
    const fromCalendar = await request(app)
      .post('/events')
      .send({ ...event, type: 'calendar.booked', sourceModule: 'calendar' });
    expect(fromCalendar.status).toBe(201);
  });

  it('still accepts events without an eventId (each one recorded)', async () => {
    const t = await workspace();
    t.asOwner();
    await db.contact.create({
      data: { workspaceId: t.ws.id, name: 'Mila', email: 'mila@example.test', ownerId: t.owner.id },
    });
    const event = {
      type: 'email.received',
      sourceModule: 'email',
      occurredAt: '2026-10-20T09:00:00Z',
      contact: { email: 'mila@example.test' },
      summary: 'Hi',
    };
    expect((await request(app).post('/events').send(event)).status).toBe(201);
    expect((await request(app).post('/events').send(event)).status).toBe(201);
  });
});
