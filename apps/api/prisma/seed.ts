import { DEMO_WORKSPACE_ID, demoDeals, demoPipeline, demoStages } from '@lulu/shared';
import type { Prisma } from '../src/generated/prisma/client';
import { db, disconnectDb } from '../src/db/prisma';

// Sample data from the MagicPath design (design/src/components/generated/LuluCRM.tsx),
// as required by tasks.md: 5 contacts, 4 companies, 4 deals, 3 notes, 5 activities.
// Every record uses a fixed id and upserts, so the seed is idempotent.

type WithId<T> = T & { id: string };

const BASE_TIME = new Date('2026-10-01T09:00:00.000Z');
const base = { createdAt: BASE_TIME, updatedAt: BASE_TIME };

const workspace: WithId<Prisma.WorkspaceUncheckedCreateInput> = {
  id: DEMO_WORKSPACE_ID,
  name: 'Lulu demo',
  defaultCurrency: 'EUR',
  defaultLanguage: 'en',
  ...base,
};

const users: WithId<Prisma.UserUncheckedCreateInput>[] = [
  {
    id: 'user_jamie',
    workspaceId: DEMO_WORKSPACE_ID,
    name: 'Jamie Morgan',
    email: 'jamie@lulu.test',
    role: 'owner',
    ...base,
  },
  {
    id: 'user_alex',
    workspaceId: DEMO_WORKSPACE_ID,
    name: 'Alex Rivera',
    email: 'alex@lulu.test',
    role: 'member',
    ...base,
  },
];

const companies: WithId<Prisma.CompanyUncheckedCreateInput>[] = [
  {
    id: 'company_northstar',
    workspaceId: DEMO_WORKSPACE_ID,
    name: 'Northstar Studio',
    domain: 'northstar.studio',
    industry: 'Creative services',
    ownerId: 'user_jamie',
    ...base,
  },
  {
    id: 'company_atlas',
    workspaceId: DEMO_WORKSPACE_ID,
    name: 'Atlas Logistics',
    domain: 'atlaslogistics.co',
    industry: 'Logistics',
    ownerId: 'user_jamie',
    ...base,
  },
  {
    id: 'company_roam',
    workspaceId: DEMO_WORKSPACE_ID,
    name: 'Roam & Root',
    domain: 'roamandroot.com',
    industry: 'Retail',
    ownerId: 'user_alex',
    ...base,
  },
  {
    id: 'company_klarwerk',
    workspaceId: DEMO_WORKSPACE_ID,
    name: 'Klarwerk GmbH',
    domain: 'klarwerk.de',
    industry: 'Finance',
    ownerId: 'user_jamie',
    ...base,
  },
];

const contacts: WithId<Prisma.ContactUncheckedCreateInput>[] = [
  {
    id: 'contact_sophie',
    workspaceId: DEMO_WORKSPACE_ID,
    name: 'Sophie Laurent',
    email: 'sophie@northstar.studio',
    phone: '+49 151 248 991',
    companyId: 'company_northstar',
    jobRole: 'Creative Director',
    source: 'Website form',
    lifecycleStage: 'qualified',
    ownerId: 'user_jamie',
    tags: ['Design', 'Warm'],
    lastTouchAt: new Date('2026-10-18T09:42:00.000Z'),
    ...base,
  },
  {
    id: 'contact_daniel',
    workspaceId: DEMO_WORKSPACE_ID,
    name: 'Daniel Chen',
    email: 'daniel@atlaslogistics.co',
    phone: '+49 176 830 442',
    companyId: 'company_atlas',
    jobRole: 'Operations Lead',
    source: 'Referral',
    lifecycleStage: 'customer',
    ownerId: 'user_jamie',
    tags: ['Logistics', 'VIP'],
    lastTouchAt: new Date('2026-10-17T16:18:00.000Z'),
    ...base,
  },
  {
    id: 'contact_mila',
    workspaceId: DEMO_WORKSPACE_ID,
    name: 'Mila Rossi',
    email: 'mila@roamandroot.com',
    phone: '+49 160 441 720',
    companyId: 'company_roam',
    jobRole: 'Founder',
    source: 'Instagram',
    lifecycleStage: 'new',
    ownerId: 'user_alex',
    tags: ['Retail'],
    lastTouchAt: new Date('2026-10-17T11:05:00.000Z'),
    ...base,
  },
  {
    id: 'contact_tobias',
    workspaceId: DEMO_WORKSPACE_ID,
    name: 'Tobias Klein',
    email: 'tobias@klarwerk.de',
    phone: '+49 171 927 006',
    companyId: 'company_klarwerk',
    jobRole: 'Finance Manager',
    source: 'Import',
    lifecycleStage: 'follow_up',
    ownerId: 'user_jamie',
    tags: ['Finance', 'Follow-up'],
    lastTouchAt: new Date('2026-10-13T14:30:00.000Z'),
    ...base,
  },
  {
    id: 'contact_elena',
    workspaceId: DEMO_WORKSPACE_ID,
    name: 'Elena Schmidt',
    email: 'elena@hausamfluss.de',
    phone: '+49 172 105 819',
    jobRole: 'Managing Director',
    source: 'Email',
    lifecycleStage: 'qualified',
    ownerId: 'user_alex',
    tags: ['Hospitality'],
    lastTouchAt: new Date('2026-10-13T10:12:00.000Z'),
    ...base,
  },
];

const pipeline: WithId<Prisma.PipelineUncheckedCreateInput> = {
  id: demoPipeline.id,
  workspaceId: demoPipeline.workspaceId,
  key: demoPipeline.key,
  name: demoPipeline.name,
  isDefault: demoPipeline.isDefault,
  ...base,
};

const stages: WithId<Prisma.StageUncheckedCreateInput>[] = demoStages.map((stage) => ({
  id: stage.id,
  workspaceId: stage.workspaceId,
  pipelineId: stage.pipelineId,
  key: stage.key,
  name: stage.name,
  order: stage.order,
  probability: stage.probability,
  type: stage.type,
  ...base,
}));

const deals: WithId<Prisma.DealUncheckedCreateInput>[] = demoDeals.map((deal) => ({
  id: deal.id,
  workspaceId: deal.workspaceId,
  name: deal.name,
  value: deal.value,
  currency: deal.currency,
  stageId: deal.stageId,
  probability: deal.probability,
  expectedCloseAt: deal.expectedCloseAt === null ? null : new Date(deal.expectedCloseAt),
  contactId: deal.contactId,
  companyId: deal.companyId,
  ownerId: deal.ownerId,
  closedAt: deal.closedAt === null ? null : new Date(deal.closedAt),
  ...base,
}));

const notes: WithId<Prisma.NoteUncheckedCreateInput>[] = [
  {
    id: 'note_northstar',
    workspaceId: DEMO_WORKSPACE_ID,
    title: 'Northstar decision criteria',
    body: 'They care most about approval flows and the shared workspace.',
    visibility: 'shared',
    authorId: 'user_jamie',
    recordType: 'deal',
    recordId: 'deal_northstar',
    createdAt: new Date('2026-10-18T09:18:00.000Z'),
    updatedAt: new Date('2026-10-18T09:18:00.000Z'),
  },
  {
    id: 'note_klarwerk',
    workspaceId: DEMO_WORKSPACE_ID,
    title: 'Klarwerk next step',
    body: 'Send finance workflow example before the next call.',
    visibility: 'private',
    authorId: 'user_alex',
    recordType: 'deal',
    recordId: 'deal_klarwerk',
    createdAt: new Date('2026-10-17T15:40:00.000Z'),
    updatedAt: new Date('2026-10-17T15:40:00.000Z'),
  },
  {
    id: 'note_roam',
    workspaceId: DEMO_WORKSPACE_ID,
    title: 'Roam & Root context',
    body: 'Founder prefers short, visual updates and async follow-up.',
    visibility: 'shared',
    authorId: 'user_jamie',
    recordType: 'deal',
    recordId: 'deal_roam',
    createdAt: new Date('2026-10-13T11:22:00.000Z'),
    updatedAt: new Date('2026-10-13T11:22:00.000Z'),
  },
];

const activities: WithId<Prisma.ActivityUncheckedCreateInput>[] = [
  {
    id: 'activity_sophie_reply',
    workspaceId: DEMO_WORKSPACE_ID,
    type: 'email',
    sourceModule: 'email',
    recordType: 'contact',
    recordId: 'contact_sophie',
    occurredAt: new Date('2026-10-18T09:48:00.000Z'),
    actorId: 'user_jamie',
    summary: 'Reply received from Sophie Laurent',
    ...base,
  },
  {
    id: 'activity_daniel_call',
    workspaceId: DEMO_WORKSPACE_ID,
    type: 'meeting',
    sourceModule: 'calendar',
    recordType: 'contact',
    recordId: 'contact_daniel',
    occurredAt: new Date('2026-10-18T09:00:00.000Z'),
    actorId: 'user_jamie',
    summary: 'Discovery call scheduled with Daniel Chen',
    ...base,
  },
  {
    id: 'activity_task_done',
    workspaceId: DEMO_WORKSPACE_ID,
    type: 'task',
    recordType: 'contact',
    recordId: 'contact_mila',
    occurredAt: new Date('2026-10-17T16:30:00.000Z'),
    actorId: 'user_alex',
    summary: 'Follow-up task completed by Alex Rivera',
    ...base,
  },
  {
    id: 'activity_ai_signal',
    workspaceId: DEMO_WORKSPACE_ID,
    type: 'ai_signal',
    recordType: 'company',
    recordId: 'company_klarwerk',
    occurredAt: new Date('2026-10-17T15:00:00.000Z'),
    summary: 'AI identified a warm buying signal',
    ...base,
  },
  {
    id: 'activity_stage_changed',
    workspaceId: DEMO_WORKSPACE_ID,
    type: 'stage_changed',
    recordType: 'deal',
    recordId: 'deal_northstar',
    occurredAt: new Date('2026-10-18T09:45:00.000Z'),
    actorId: 'user_jamie',
    summary: 'Northstar annual workspace moved to Proposal',
    ...base,
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

async function main(): Promise<void> {
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

  console.log(
    `Seed complete: ${users.length} users, ${companies.length} companies, ${contacts.length} contacts, 1 pipeline (${stages.length} stages), ${deals.length} deals, ${notes.length} notes, ${activities.length} activities.`,
  );
}

main()
  .catch((err: unknown) => {
    console.error('Seed failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());
