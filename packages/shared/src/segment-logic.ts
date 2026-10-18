import type { Contact } from "./contact.js";
import type { Deal } from "./deal.js";
import type { Stage } from "./pipeline.js";
import type { SegmentCondition, SegmentRules } from "./segment.js";
import type { Task } from "./task.js";
import { dueKind } from "./task-logic.js";

// Pure segment matching, shared so the API (segments.refresh, GET /segments/:id/contacts),
// the mock and the rule builder's live preview count the same members.

const DAY_MS = 24 * 60 * 60 * 1000;

export type SegmentContext = {
  now: Date;
  // Time zone that decides what "due today" means (see dueKind).
  timeZone: string;
  tasks: Task[];
  deals: Deal[];
  stages: Stage[];
};

/** Precomputed lookups, so matching many contacts stays linear. */
function index(context: SegmentContext) {
  const followUpDue = new Set<string>();
  for (const task of context.tasks) {
    if (task.deletedAt || task.recordType !== "contact" || !task.recordId) continue;
    const kind = dueKind(task, context.now, context.timeZone);
    if (kind === "overdue" || kind === "today") followUpDue.add(task.recordId);
  }

  const openStageIds = new Set(context.stages.filter((s) => s.type === "open").map((s) => s.id));
  const onOpenDeal = new Set<string>();
  for (const deal of context.deals) {
    if (!deal.deletedAt && deal.contactId && openStageIds.has(deal.stageId)) onOpenDeal.add(deal.contactId);
  }

  return { followUpDue, onOpenDeal };
}

function matchesCondition(
  contact: Contact,
  condition: SegmentCondition,
  now: Date,
  lookups: ReturnType<typeof index>,
): boolean {
  switch (condition.field) {
    case "lifecycleStage":
      return (contact.lifecycleStage === condition.value) === (condition.op === "is");
    case "ownerId":
      return (contact.ownerId === condition.value) === (condition.op === "is");
    case "tag": {
      const wanted = condition.value.toLocaleLowerCase();
      const has = contact.tags.some((tag) => tag.toLocaleLowerCase() === wanted);
      return has === (condition.op === "has");
    }
    case "marketingConsent":
      return contact.marketingConsent === condition.value;
    case "lastTouch": {
      if (condition.op === "never") return contact.lastTouchAt === null;
      if (contact.lastTouchAt === null) return condition.op === "older_than_days";
      const age = now.getTime() - Date.parse(contact.lastTouchAt);
      return condition.op === "within_days" ? age <= condition.value * DAY_MS : age > condition.value * DAY_MS;
    }
    case "followUp":
      return lookups.followUpDue.has(contact.id);
    case "openDeal":
      return lookups.onOpenDeal.has(contact.id) === (condition.op === "exists");
  }
}

/** The contacts that belong to a segment. Deleted contacts never do. */
export function segmentMembers(contacts: Contact[], rules: SegmentRules, context: SegmentContext): Contact[] {
  const lookups = index(context);
  return contacts.filter((contact) => {
    if (contact.deletedAt) return false;
    const results = rules.conditions.map((c) => matchesCondition(contact, c, context.now, lookups));
    return rules.match === "all" ? results.every(Boolean) : results.some(Boolean);
  });
}
