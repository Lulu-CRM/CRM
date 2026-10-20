import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { runSeed } from '../prisma/seed';
import { SEED_PIPELINE_SALES_ID, SEED_WORKSPACE_ID } from '../prisma/seed-ids';
import { Prisma } from './generated/prisma/client';
import { db } from './db/prisma';

// Loads the design sample data through the real seed, twice, and checks that the
// result is exactly the expected dataset: same counts after both runs (idempotent),
// deals linked to the seeded pipeline, and money stored as Decimal plus currency.

describe('seed (int)', () => {
  beforeAll(async () => {
    await runSeed();
    await runSeed();
  }, 60_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  it('seeds the exact counts, with no duplicates after a second run', async () => {
    const where = { workspaceId: SEED_WORKSPACE_ID, deletedAt: null };
    const [workspaces, users, contacts, companies, pipelines, stages, deals, notes, activities] =
      await Promise.all([
        db.workspace.count({ where: { id: SEED_WORKSPACE_ID } }),
        db.user.count({ where }),
        db.contact.count({ where }),
        db.company.count({ where }),
        db.pipeline.count({ where }),
        db.stage.count({ where }),
        db.deal.count({ where }),
        db.note.count({ where }),
        db.activity.count({ where }),
      ]);

    expect({
      workspaces,
      users,
      contacts,
      companies,
      pipelines,
      stages,
      deals,
      notes,
      activities,
    }).toEqual({
      workspaces: 1,
      users: 2,
      contacts: 5,
      companies: 5,
      pipelines: 1,
      stages: 6,
      deals: 4,
      notes: 3,
      activities: 5,
    });
  });

  it('gives both seeded users a password hash to log in with', async () => {
    const users = await db.user.findMany({
      where: { workspaceId: SEED_WORKSPACE_ID, deletedAt: null },
      select: { email: true, passwordHash: true },
    });

    expect(users).toHaveLength(2);
    for (const user of users) {
      expect(user.passwordHash).not.toBeNull();
      expect(user.passwordHash?.startsWith('$2')).toBe(true);
    }
  });

  it('links every deal to a stage of the seeded pipeline', async () => {
    const pipelineStages = await db.stage.findMany({
      where: { pipelineId: SEED_PIPELINE_SALES_ID },
    });
    const stageIds = new Set(pipelineStages.map((stage) => stage.id));
    const deals = await db.deal.findMany({
      where: { workspaceId: SEED_WORKSPACE_ID, deletedAt: null },
    });

    expect(deals.length).toBe(4);
    for (const deal of deals) {
      expect(stageIds.has(deal.stageId)).toBe(true);
    }
  });

  it('stores deal money as Decimal with an explicit currency', async () => {
    const deals = await db.deal.findMany({
      where: { workspaceId: SEED_WORKSPACE_ID, deletedAt: null },
    });

    expect(deals.length).toBe(4);
    for (const deal of deals) {
      expect(deal.value).toBeInstanceOf(Prisma.Decimal);
      expect(deal.probability).toBeInstanceOf(Prisma.Decimal);
      expect(typeof deal.currency).toBe('string');
      expect(deal.currency).toBe('EUR');
    }
  });

  it('summarizes the seeded open deals in EUR', async () => {
    const deals = await db.deal.findMany({
      where: { workspaceId: SEED_WORKSPACE_ID, deletedAt: null, currency: 'EUR' },
      include: { stage: { select: { type: true, probability: true } } },
    });

    let openValue = 0;
    let weightedValue = 0;
    for (const deal of deals) {
      if (deal.stage.type !== 'open') continue;
      const value = Number(deal.value);
      openValue += value;
      weightedValue += value * Number(deal.stage.probability);
    }

    // Matches the design's "€97.9k open value" and 63% weighted win rate.
    expect(openValue).toBe(97900);
    expect(weightedValue).toBeCloseTo(61765, 2);
  });
});
