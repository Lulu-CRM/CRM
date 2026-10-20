import {
  segmentMembers,
  segmentRulesSchema,
  type Contact,
  type SegmentContext,
  type SegmentRules,
} from '@lulu/shared';
import type { ScopedDb } from '../db/scoped';
import { toSharedContact } from './contactMapper';
import { toSharedDeal, toSharedStage } from './dealMapper';
import { toSharedTask } from './timeline';

// Segment membership with the shared rules (packages/shared/src/segment-logic.ts), so GET /segments,
// GET /segments/:id/contacts and GET /contacts?segmentId= always agree with each other and with the web app.

export interface MembershipData {
  contacts: Contact[];
  context: SegmentContext;
}

/** Everything the rules look at, loaded once and reused for every segment in a request. */
export async function loadMembershipData(
  scoped: ScopedDb,
  now: Date = new Date(),
): Promise<MembershipData> {
  const [contactRows, taskRows, dealRows, stageRows] = await Promise.all([
    scoped.contact.findMany({}),
    scoped.task.findMany({ where: { done: false } }),
    scoped.deal.findMany({}),
    scoped.stage.findMany({ orderBy: { order: 'asc' } }),
  ]);
  return {
    contacts: contactRows.map(toSharedContact),
    context: {
      now,
      // "Due today" uses UTC until workspaces have a time zone (docs/data-model.md).
      timeZone: 'UTC',
      tasks: taskRows.map(toSharedTask),
      deals: dealRows.map(toSharedDeal),
      stages: stageRows.map(toSharedStage),
    },
  };
}

/** The ids of the contacts in a segment. Rules are checked again on read, so a bad stored value never matches. */
export function memberIds(data: MembershipData, rules: unknown): string[] {
  const parsed = segmentRulesSchema.safeParse(rules);
  if (!parsed.success) return [];
  return segmentMembers(data.contacts, parsed.data satisfies SegmentRules, data.context).map(
    (c) => c.id,
  );
}
