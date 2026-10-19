import type { Prisma } from '../src/generated/prisma/client';
import { db, disconnectDb } from '../src/db/prisma';
import {
  SEED_ACTIVITY_AI_SIGNAL_ID,
  SEED_ACTIVITY_DANIEL_CALL_ID,
  SEED_ACTIVITY_LEAD_CREATED_ID,
  SEED_ACTIVITY_SOPHIE_REPLY_ID,
  SEED_ACTIVITY_TASK_DONE_ID,
  SEED_ALEX_ID,
  SEED_COMPANY_ATLAS_ID,
  SEED_COMPANY_KLARWERK_ID,
  SEED_COMPANY_NORTHSTAR_ID,
  SEED_COMPANY_ROAM_ID,
  SEED_CONTACT_DANIEL_ID,
  SEED_CONTACT_ELENA_ID,
  SEED_CONTACT_MILA_ID,
  SEED_CONTACT_SOPHIE_ID,
  SEED_CONTACT_TOBIAS_ID,
  SEED_DEAL_ATLAS_ID,
  SEED_DEAL_KLARWERK_ID,
  SEED_DEAL_NORTHSTAR_ID,
  SEED_DEAL_ROAM_ID,
  SEED_JAMIE_ID,
  SEED_NOTE_KLARWERK_ID,
  SEED_NOTE_NORTHSTAR_ID,
  SEED_NOTE_ROAM_ID,
  SEED_PIPELINE_SALES_ID,
  SEED_STAGE_LOST_ID,
  SEED_STAGE_NEGOTIATION_ID,
  SEED_STAGE_NEW_ID,
  SEED_STAGE_PROPOSAL_ID,
  SEED_STAGE_QUALIFIED_ID,
  SEED_STAGE_WON_ID,
  SEED_WORKSPACE_ID,
} from './seed-ids';

// Sample data from the MagicPath design (design/src/components/generated/LuluCRM.tsx).
// Every row uses a fixed id from seed-ids.ts and upserts through the base Prisma
// client with an explicit workspaceId, so the seed is idempotent: running it twice
// produces no duplicates. Text values from the prototype are translated to real
// types (money strings -> Decimal + currency, "70%" -> 0.7) and date text becomes
// timestamps computed relative to the seed run time ("Today, 09:42", "2 days ago").

const DAY_MS = 24 * 60 * 60 * 1000;

function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function atTime(day: Date, hour: number, minute: number): Date {
  return new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, minute),
  );
}

function todayAt(hour: number, minute: number): Date {
  return atTime(utcToday(), hour, minute);
}

function yesterdayAt(hour: number, minute: number): Date {
  return new Date(atTime(utcToday(), hour, minute).getTime() - DAY_MS);
}

// The most recent Monday (today, when the seed runs on a Monday), matching the
// design's "Mon, 14:30" labels.
function lastMondayAt(hour: number, minute: number): Date {
  const daysSinceMonday = (utcToday().getUTCDay() + 6) % 7;
  return new Date(atTime(utcToday(), hour, minute).getTime() - daysSinceMonday * DAY_MS);
}

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60_000);
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 3_600_000);
}

// Deal close dates from the design ("28 Oct", "04 Nov", ...) stay upcoming: the
// next occurrence of that calendar date at 12:00 UTC.
function nextCloseAt(month: number, day: number): Date {
  const now = Date.now();
  const year = new Date().getUTCFullYear();
  const thisYear = Date.UTC(year, month - 1, day, 12, 0);
  return new Date(thisYear > now ? thisYear : Date.UTC(year + 1, month - 1, day, 12, 0));
}

type WithId<T> = T & { id: string };

const workspace: WithId<Prisma.WorkspaceUncheckedCreateInput> = {
  id: SEED_WORKSPACE_ID,
  name: 'Lulu demo',
  defaultCurrency: 'EUR',
  defaultLanguage: 'en',
};

const users: WithId<Prisma.UserUncheckedCreateInput>[] = [
  {
    id: SEED_JAMIE_ID,
    workspaceId: SEED_WORKSPACE_ID,
    name: 'Jamie Morgan',
    email: 'jamie.morgan@lulu.test',
    role: 'owner',
  },
  {
    id: SEED_ALEX_ID,
    workspaceId: SEED_WORKSPACE_ID,
    name: 'Alex Rivera',
    email: 'alex.rivera@lulu.test',
    role: 'member',
  },
];

const companies: WithId<Prisma.CompanyUncheckedCreateInput>[] = [
  {
    id: SEED_COMPANY_NORTHSTAR_ID,
    workspaceId: SEED_WORKSPACE_ID,
    name: 'Northstar Studio',
    domain: 'northstar.studio',
    industry: 'Creative services',
    ownerId: SEED_JAMIE_ID,
  },
  {
    id: SEED_COMPANY_ATLAS_ID,
    workspaceId: SEED_WORKSPACE_ID,
    name: 'Atlas Logistics',
    domain: 'atlaslogistics.co',
    industry: 'Logistics',
    ownerId: SEED_JAMIE_ID,
  },
  {
    id: SEED_COMPANY_ROAM_ID,
    workspaceId: SEED_WORKSPACE_ID,
    name: 'Roam & Root',
    domain: 'roamandroot.com',
    industry: 'Retail',
    ownerId: SEED_ALEX_ID,
  },
  {
    id: SEED_COMPANY_KLARWERK_ID,
    workspaceId: SEED_WORKSPACE_ID,
    name: 'Klarwerk GmbH',
    domain: 'klarwerk.de',
    industry: 'Finance',
    ownerId: SEED_JAMIE_ID,
  },
];

const contacts: WithId<Prisma.ContactUncheckedCreateInput>[] = [
  {
    id: SEED_CONTACT_SOPHIE_ID,
    workspaceId: SEED_WORKSPACE_ID,
    name: 'Sophie Laurent',
    email: 'sophie@northstar.studio',
    phone: '+49 151 248 991',
    companyId: SEED_COMPANY_NORTHSTAR_ID,
    jobRole: 'Creative Director',
    source: 'website_form',
    lifecycleStage: 'qualified',
    ownerId: SEED_JAMIE_ID,
    tags: ['Design', 'Warm'],
    marketingConsent: false,
    consentUpdatedAt: null,
    lastTouchAt: todayAt(9, 42),
  },
  {
    id: SEED_CONTACT_DANIEL_ID,
    workspaceId: SEED_WORKSPACE_ID,
    name: 'Daniel Chen',
    email: 'daniel@atlaslogistics.co',
    phone: '+49 176 830 442',
    companyId: SEED_COMPANY_ATLAS_ID,
    jobRole: 'Operations Lead',
    source: 'referral',
    lifecycleStage: 'customer',
    ownerId: SEED_JAMIE_ID,
    tags: ['Logistics', 'VIP'],
    marketingConsent: false,
    consentUpdatedAt: null,
    lastTouchAt: yesterdayAt(16, 18),
  },
  {
    id: SEED_CONTACT_MILA_ID,
    workspaceId: SEED_WORKSPACE_ID,
    name: 'Mila Rossi',
    email: 'mila@roamandroot.com',
    phone: '+49 160 441 720',
    companyId: SEED_COMPANY_ROAM_ID,
    jobRole: 'Founder',
    source: 'instagram',
    lifecycleStage: 'new',
    ownerId: SEED_ALEX_ID,
    tags: ['Retail'],
    marketingConsent: false,
    consentUpdatedAt: null,
    lastTouchAt: yesterdayAt(11, 5),
  },
  {
    id: SEED_CONTACT_TOBIAS_ID,
    workspaceId: SEED_WORKSPACE_ID,
    name: 'Tobias Klein',
    email: 'tobias@klarwerk.de',
    phone: '+49 171 927 006',
    companyId: SEED_COMPANY_KLARWERK_ID,
    jobRole: 'Finance Manager',
    source: 'import',
    lifecycleStage: 'follow_up',
    ownerId: SEED_JAMIE_ID,
    tags: ['Finance', 'Follow-up'],
    marketingConsent: false,
    consentUpdatedAt: null,
    lastTouchAt: lastMondayAt(14, 30),
  },
  {
    id: SEED_CONTACT_ELENA_ID,
    workspaceId: SEED_WORKSPACE_ID,
    name: 'Elena Schmidt',
    email: 'elena@hausamfluss.de',
    phone: '+49 172 105 819',
    companyId: null,
    jobRole: 'Managing Director',
    source: 'email',
    lifecycleStage: 'qualified',
    ownerId: SEED_ALEX_ID,
    tags: ['Hospitality'],
    marketingConsent: false,
    consentUpdatedAt: null,
    lastTouchAt: lastMondayAt(10, 12),
  },
];

const pipeline: WithId<Prisma.PipelineUncheckedCreateInput> = {
  id: SEED_PIPELINE_SALES_ID,
  workspaceId: SEED_WORKSPACE_ID,
  key: 'sales',
  name: 'Sales pipeline',
  isDefault: true,
};

// Probabilities follow the design's per-deal "70% likely" figures, which are the
// per-stage odds shown on the board (New 20%, Qualified 40%, Proposal 70%,
// Negotiation 85%); Won and Lost are certain either way.
const stages: WithId<Prisma.StageUncheckedCreateInput>[] = [
  {
    id: SEED_STAGE_NEW_ID,
    workspaceId: SEED_WORKSPACE_ID,
    pipelineId: SEED_PIPELINE_SALES_ID,
    key: 'new',
    name: 'New',
    order: 0,
    probability: 0.2,
    type: 'open',
  },
  {
    id: SEED_STAGE_QUALIFIED_ID,
    workspaceId: SEED_WORKSPACE_ID,
    pipelineId: SEED_PIPELINE_SALES_ID,
    key: 'qualified',
    name: 'Qualified',
    order: 1,
    probability: 0.4,
    type: 'open',
  },
  {
    id: SEED_STAGE_PROPOSAL_ID,
    workspaceId: SEED_WORKSPACE_ID,
    pipelineId: SEED_PIPELINE_SALES_ID,
    key: 'proposal',
    name: 'Proposal',
    order: 2,
    probability: 0.7,
    type: 'open',
  },
  {
    id: SEED_STAGE_NEGOTIATION_ID,
    workspaceId: SEED_WORKSPACE_ID,
    pipelineId: SEED_PIPELINE_SALES_ID,
    key: 'negotiation',
    name: 'Negotiation',
    order: 3,
    probability: 0.85,
    type: 'open',
  },
  {
    id: SEED_STAGE_WON_ID,
    workspaceId: SEED_WORKSPACE_ID,
    pipelineId: SEED_PIPELINE_SALES_ID,
    key: 'won',
    name: 'Won',
    order: 4,
    probability: 1,
    type: 'won',
  },
  {
    id: SEED_STAGE_LOST_ID,
    workspaceId: SEED_WORKSPACE_ID,
    pipelineId: SEED_PIPELINE_SALES_ID,
    key: 'lost',
    name: 'Lost',
    order: 5,
    probability: 0,
    type: 'lost',
  },
];

const deals: WithId<Prisma.DealUncheckedCreateInput>[] = [
  {
    id: SEED_DEAL_NORTHSTAR_ID,
    workspaceId: SEED_WORKSPACE_ID,
    name: 'Northstar annual workspace',
    value: 24000,
    currency: 'EUR',
    stageId: SEED_STAGE_PROPOSAL_ID,
    probability: 0.7,
    expectedCloseAt: nextCloseAt(10, 28),
    contactId: SEED_CONTACT_SOPHIE_ID,
    companyId: SEED_COMPANY_NORTHSTAR_ID,
    ownerId: SEED_JAMIE_ID,
  },
  {
    id: SEED_DEAL_ATLAS_ID,
    workspaceId: SEED_WORKSPACE_ID,
    name: 'Atlas operations rollout',
    value: 42500,
    currency: 'EUR',
    stageId: SEED_STAGE_NEGOTIATION_ID,
    probability: 0.85,
    expectedCloseAt: nextCloseAt(11, 4),
    contactId: SEED_CONTACT_DANIEL_ID,
    companyId: SEED_COMPANY_ATLAS_ID,
    ownerId: SEED_JAMIE_ID,
  },
  {
    id: SEED_DEAL_ROAM_ID,
    workspaceId: SEED_WORKSPACE_ID,
    name: 'Roam & Root launch',
    value: 12800,
    currency: 'EUR',
    stageId: SEED_STAGE_QUALIFIED_ID,
    probability: 0.4,
    expectedCloseAt: nextCloseAt(11, 18),
    contactId: SEED_CONTACT_MILA_ID,
    companyId: SEED_COMPANY_ROAM_ID,
    ownerId: SEED_ALEX_ID,
  },
  {
    id: SEED_DEAL_KLARWERK_ID,
    workspaceId: SEED_WORKSPACE_ID,
    name: 'Klarwerk finance workspace',
    value: 18600,
    currency: 'EUR',
    stageId: SEED_STAGE_NEW_ID,
    probability: 0.2,
    expectedCloseAt: nextCloseAt(12, 2),
    contactId: SEED_CONTACT_TOBIAS_ID,
    companyId: SEED_COMPANY_KLARWERK_ID,
    ownerId: SEED_JAMIE_ID,
  },
];

const notes: WithId<Prisma.NoteUncheckedCreateInput>[] = [
  {
    id: SEED_NOTE_NORTHSTAR_ID,
    workspaceId: SEED_WORKSPACE_ID,
    title: 'Northstar decision criteria',
    body: 'They care most about approval flows and the shared workspace.',
    visibility: 'shared',
    authorId: SEED_JAMIE_ID,
    recordType: 'deal',
    recordId: SEED_DEAL_NORTHSTAR_ID,
    createdAt: todayAt(9, 18),
  },
  {
    id: SEED_NOTE_KLARWERK_ID,
    workspaceId: SEED_WORKSPACE_ID,
    title: 'Klarwerk next step',
    body: 'Send finance workflow example before the next call.',
    visibility: 'private',
    authorId: SEED_ALEX_ID,
    recordType: 'deal',
    recordId: SEED_DEAL_KLARWERK_ID,
    createdAt: yesterdayAt(15, 40),
  },
  {
    id: SEED_NOTE_ROAM_ID,
    workspaceId: SEED_WORKSPACE_ID,
    title: 'Roam & Root context',
    body: 'Founder prefers short, visual updates and async follow-up.',
    visibility: 'shared',
    authorId: SEED_JAMIE_ID,
    recordType: 'deal',
    recordId: SEED_DEAL_ROAM_ID,
    createdAt: lastMondayAt(11, 22),
  },
];

const activities: WithId<Prisma.ActivityUncheckedCreateInput>[] = [
  {
    id: SEED_ACTIVITY_SOPHIE_REPLY_ID,
    workspaceId: SEED_WORKSPACE_ID,
    type: 'email',
    sourceModule: 'email',
    recordType: 'contact',
    recordId: SEED_CONTACT_SOPHIE_ID,
    occurredAt: minutesAgo(12),
    actorId: SEED_JAMIE_ID,
    summary: 'Reply received from Sophie Laurent',
  },
  {
    id: SEED_ACTIVITY_DANIEL_CALL_ID,
    workspaceId: SEED_WORKSPACE_ID,
    type: 'meeting',
    sourceModule: 'calendar',
    recordType: 'contact',
    recordId: SEED_CONTACT_DANIEL_ID,
    occurredAt: hoursAgo(1),
    actorId: SEED_JAMIE_ID,
    summary: 'Discovery call scheduled with Daniel Chen',
  },
  {
    id: SEED_ACTIVITY_TASK_DONE_ID,
    workspaceId: SEED_WORKSPACE_ID,
    type: 'task',
    sourceModule: 'crm',
    recordType: 'contact',
    recordId: SEED_CONTACT_MILA_ID,
    occurredAt: yesterdayAt(16, 30),
    actorId: SEED_ALEX_ID,
    summary: 'Follow-up task completed by Alex Rivera',
  },
  {
    id: SEED_ACTIVITY_AI_SIGNAL_ID,
    workspaceId: SEED_WORKSPACE_ID,
    type: 'ai_signal',
    sourceModule: 'crm',
    recordType: 'company',
    recordId: SEED_COMPANY_KLARWERK_ID,
    occurredAt: yesterdayAt(15, 0),
    actorId: null,
    summary: 'AI identified a warm buying signal',
  },
  {
    id: SEED_ACTIVITY_LEAD_CREATED_ID,
    workspaceId: SEED_WORKSPACE_ID,
    type: 'created',
    sourceModule: 'crm',
    recordType: 'contact',
    recordId: SEED_CONTACT_SOPHIE_ID,
    occurredAt: lastMondayAt(15, 22),
    actorId: null,
    summary: 'Lead created from website form',
  },
];

async function upsertMany<T extends { id: string }>(
  rows: T[],
  upsert: (id: string, data: Omit<T, 'id'>, create: T) => Promise<unknown>,
): Promise<void> {
  for (const row of rows) {
    const { id, ...data } = row;
    await upsert(id, data, row);
  }
}

async function openDealTotals(): Promise<{ openValue: number; weightedValue: number }> {
  const dealsWithStage = await db.deal.findMany({
    where: { workspaceId: SEED_WORKSPACE_ID, deletedAt: null, currency: 'EUR' },
    include: { stage: { select: { type: true, probability: true } } },
  });

  let openValue = 0;
  let weightedValue = 0;
  for (const deal of dealsWithStage) {
    if (deal.stage.type !== 'open') continue;
    const value = Number(deal.value);
    openValue += value;
    weightedValue += value * Number(deal.stage.probability);
  }
  return { openValue, weightedValue };
}

export async function runSeed(): Promise<void> {
  await upsertMany([workspace], (id, data, create) =>
    db.workspace.upsert({ where: { id }, update: data, create }),
  );
  await upsertMany(users, (id, data, create) =>
    db.user.upsert({ where: { id }, update: data, create }),
  );
  await upsertMany(companies, (id, data, create) =>
    db.company.upsert({ where: { id }, update: data, create }),
  );
  await upsertMany(contacts, (id, data, create) =>
    db.contact.upsert({ where: { id }, update: data, create }),
  );
  await upsertMany([pipeline], (id, data, create) =>
    db.pipeline.upsert({ where: { id }, update: data, create }),
  );
  await upsertMany(stages, (id, data, create) =>
    db.stage.upsert({ where: { id }, update: data, create }),
  );
  await upsertMany(deals, (id, data, create) =>
    db.deal.upsert({ where: { id }, update: data, create }),
  );
  await upsertMany(notes, (id, data, create) =>
    db.note.upsert({ where: { id }, update: data, create }),
  );
  await upsertMany(activities, (id, data, create) =>
    db.activity.upsert({ where: { id }, update: data, create }),
  );

  const { openValue, weightedValue } = await openDealTotals();

  console.log(`Workspaces: 1`);
  console.log(`Users: ${users.length}`);
  console.log(`Companies: ${companies.length}`);
  console.log(`Contacts: ${contacts.length}`);
  console.log(`Pipelines: 1`);
  console.log(`Stages: ${stages.length}`);
  console.log(`Deals: ${deals.length}`);
  console.log(`Notes: ${notes.length}`);
  console.log(`Activities: ${activities.length}`);
  console.log(`Open deal value: ${openValue.toFixed(2)} EUR`);
  console.log(`Weighted value (stage probability, open only): ${weightedValue.toFixed(2)} EUR`);
  console.log('Seed complete');
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && /prisma[\\/]seed\.(ts|js)$/.test(process.argv[1]);

if (invokedDirectly) {
  runSeed()
    .catch((err: unknown) => {
      console.error('Seed failed:', err instanceof Error ? err.message : err);
      process.exitCode = 1;
    })
    .finally(() => disconnectDb());
}
