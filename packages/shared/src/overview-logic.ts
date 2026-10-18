import type { Activity } from "./activity";
import type { Company } from "./company";
import type { Contact } from "./contact";
import type { Deal } from "./deal";
import type { Overview } from "./overview";
import type { Stage } from "./pipeline";
import { summarizeDeals } from "./pipeline-logic";
import type { Task } from "./task";
import { dueKind } from "./task-logic";

const DAY_MS = 24 * 60 * 60 * 1000;

export const RECENT_CONTACTS = 4;
export const RECENT_ACTIVITY = 5;
export const AI_SIGNAL_DAYS = 30;

export type OverviewInput = {
  contacts: Contact[];
  companies: Company[];
  deals: Deal[];
  stages: Stage[];
  tasks: Task[];
  activities: Activity[];
  currency: string;
};

const live = <T extends { deletedAt: string | null }>(rows: T[]) => rows.filter((row) => row.deletedAt === null);

// Monday 00:00 of the week `now` is in, in the given time zone.
// Uses the zone's offset at `now`; a DST change earlier in the week moves it by at most an hour.
export function startOfWeek(now: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      weekday: "short",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  const wallClock = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offset = wallClock - Math.floor(now.getTime() / 1000) * 1000;
  const daysSinceMonday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.weekday);
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day - daysSinceMonday) - offset;
}

/**
 * Everything the Overview page shows, in one object. The API and mock mode both call this,
 * so the numbers match. Totals are in `currency` only (see summarizeDeals).
 */
export function buildOverview(input: OverviewInput, now: Date, timeZone: string): Overview {
  const contacts = live(input.contacts);
  const tasks = live(input.tasks);
  const activities = live(input.activities);
  const openStages = input.stages.filter((stage) => stage.type === "open").sort((a, b) => a.order - b.order);

  const summary = summarizeDeals(input.deals, input.stages, input.currency);

  const monthAgo = new Date(now);
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  // Contacts that existed a month ago: created by then and not deleted by then.
  const contactsMonthAgo = input.contacts.filter(
    (c) => Date.parse(c.createdAt) <= monthAgo.getTime() && (c.deletedAt === null || Date.parse(c.deletedAt) > monthAgo.getTime()),
  ).length;

  const dueKinds = tasks.map((task) => dueKind(task, now, timeZone));
  const followUpsDue = dueKinds.filter((kind) => kind === "overdue" || kind === "today" || kind === "tomorrow" || kind === "this_week").length;
  const dueToday = dueKinds.filter((kind) => kind === "today").length;

  const signals = activities.filter(
    (a) => a.type === "ai_signal" && now.getTime() - Date.parse(a.occurredAt) <= AI_SIGNAL_DAYS * DAY_MS,
  );
  const weekStart = startOfWeek(now, timeZone);

  const liveDeals = live(input.deals);
  const pipelineByStage = openStages.map((stage) => {
    const inStage = liveDeals.filter((deal) => deal.stageId === stage.id);
    const inCurrency = inStage.filter((deal) => deal.currency === input.currency);
    return {
      stageId: stage.id,
      value: { amount: inCurrency.reduce((sum, deal) => sum + deal.value, 0), currency: input.currency },
      dealCount: inStage.length,
    };
  });

  const recentContacts = [...contacts]
    .filter((c) => c.lastTouchAt !== null)
    .sort((a, b) => Date.parse(b.lastTouchAt!) - Date.parse(a.lastTouchAt!))
    .slice(0, RECENT_CONTACTS);

  const names = new Map<string, string>([
    ...input.contacts.map((c) => [`contact:${c.id}`, c.name] as const),
    ...input.companies.map((c) => [`company:${c.id}`, c.name] as const),
    ...input.deals.map((d) => [`deal:${d.id}`, d.name] as const),
  ]);
  const recentActivity = [...activities]
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
    .slice(0, RECENT_ACTIVITY)
    .map((a) => ({ ...a, recordName: a.recordType && a.recordId ? names.get(`${a.recordType}:${a.recordId}`) ?? null : null }));

  return {
    contactCount: contacts.length,
    contactChange: contactsMonthAgo === 0 ? null : (contacts.length - contactsMonthAgo) / contactsMonthAgo,
    openPipeline: summary.openValue,
    weightedPipeline: summary.weightedValue,
    activeDeals: summary.activeDeals,
    followUpsDue,
    dueToday,
    aiSignals: signals.length,
    aiSignalsThisWeek: signals.filter((a) => Date.parse(a.occurredAt) >= weekStart).length,
    pipelineByStage,
    recentContacts,
    recentActivity,
  };
}
