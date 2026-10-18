import type { Company, CompanyDetail, CompanyHealth, CompanyListItem } from "./company";
import type { Contact } from "./contact";
import type { Deal } from "./deal";
import type { Stage } from "./pipeline";

// Pure company calculations, shared so GET /companies and mock mode always agree.

const DAY_MS = 24 * 60 * 60 * 1000;

// An account is "strong" when a deal is won or an open deal has reached this probability (Proposal in the default pipeline).
export const STRONG_DEAL_PROBABILITY = 0.7;
// A strong account with no contact touched for this many days drops to "watch".
export const STALE_AFTER_DAYS = 30;

/**
 * strong: a won deal, or an open deal at STRONG_DEAL_PROBABILITY or more, and a contact touched in the last STALE_AFTER_DAYS days.
 * new: no deal has moved past the first open stage yet (or there are no deals).
 * watch: everything else.
 * Lost and deleted deals are ignored.
 */
export function companyHealth(deals: Deal[], stages: Stage[], lastTouchAt: string | null, now: Date = new Date()): CompanyHealth {
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const live = deals.filter((deal) => deal.deletedAt === null && stageById.get(deal.stageId)?.type !== "lost");
  const won = live.filter((deal) => stageById.get(deal.stageId)?.type === "won");
  const open = live.filter((deal) => stageById.get(deal.stageId)?.type === "open");

  const firstOpenOrder = Math.min(...stages.filter((s) => s.type === "open").map((s) => s.order));
  const pastFirstStage = open.some((deal) => (stageById.get(deal.stageId)?.order ?? firstOpenOrder) > firstOpenOrder);
  if (won.length === 0 && !pastFirstStage) return "new";

  const recent = lastTouchAt !== null && now.getTime() - new Date(lastTouchAt).getTime() <= STALE_AFTER_DAYS * DAY_MS;
  const promising = won.length > 0 || open.some((deal) => deal.probability >= STRONG_DEAL_PROBABILITY);
  return promising && recent ? "strong" : "watch";
}

/** Adds the numbers GET /companies returns. `contacts` and `deals` may hold other companies' records. */
export function summarizeCompany(
  company: Company,
  contacts: Contact[],
  deals: Deal[],
  stages: Stage[],
  currency: string,
  now: Date = new Date(),
): CompanyListItem {
  const people = contacts.filter((c) => c.companyId === company.id && c.deletedAt === null);
  const own = deals.filter((d) => d.companyId === company.id && d.deletedAt === null);
  const openStageIds = new Set(stages.filter((s) => s.type === "open").map((s) => s.id));
  const open = own.filter((d) => openStageIds.has(d.stageId));
  const inCurrency = open.filter((d) => d.currency === currency);

  const touches = people.map((c) => c.lastTouchAt).filter((t): t is string => t !== null);
  const lastTouchAt = touches.length ? touches.reduce((a, b) => (new Date(a) > new Date(b) ? a : b)) : null;

  return {
    ...company,
    contactCount: people.length,
    // Sum in whole cents so totals do not pick up floating point noise.
    openDealValue: {
      amount: inCurrency.reduce((sum, d) => sum + Math.round(d.value * 100), 0) / 100,
      currency,
    },
    openDealCount: open.length,
    otherCurrencyDeals: open.length - inCurrency.length,
    lastTouchAt,
    health: companyHealth(own, stages, lastTouchAt, now),
  };
}

/** GET /companies/:id: the summary plus the company's people (most recent touch first) and deals. */
export function companyDetail(
  company: Company,
  contacts: Contact[],
  deals: Deal[],
  stages: Stage[],
  currency: string,
  now: Date = new Date(),
): CompanyDetail {
  const time = (value: string | null) => (value ? new Date(value).getTime() : -Infinity);
  return {
    ...summarizeCompany(company, contacts, deals, stages, currency, now),
    contacts: contacts
      .filter((c) => c.companyId === company.id && c.deletedAt === null)
      .sort((a, b) => time(b.lastTouchAt) - time(a.lastTouchAt)),
    deals: deals.filter((d) => d.companyId === company.id && d.deletedAt === null),
  };
}
