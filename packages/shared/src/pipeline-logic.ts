import type { Money } from "./common.js";
import type { Deal, DealSummary } from "./deal.js";
import type { Stage } from "./pipeline.js";

// Pure pipeline calculations, shared so the API (GET /deals/summary, POST /deals/:id/move)
// and the board's optimistic update always agree.

export type PipelineErrorCode = "STAGE_NOT_FOUND" | "STAGE_IN_OTHER_PIPELINE";

export class PipelineError extends Error {
  constructor(public readonly code: PipelineErrorCode) {
    super(code);
    this.name = "PipelineError";
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Sum in whole cents so totals do not pick up floating point noise.
function sumMoney(amounts: number[]): number {
  const cents = amounts.reduce((total, amount) => total + Math.round(amount * 100), 0);
  return cents / 100;
}

function isLive(deal: Deal): boolean {
  return deal.deletedAt === null;
}

/**
 * Moves a deal to another stage of the same pipeline.
 * Probability follows the new stage. Won or lost sets closedAt; moving back to an open stage clears it.
 */
export function moveDeal(deal: Deal, toStageId: string, stages: Stage[], now: Date = new Date()): Deal {
  const toStage = stages.find((stage) => stage.id === toStageId);
  if (!toStage) throw new PipelineError("STAGE_NOT_FOUND");

  const fromStage = stages.find((stage) => stage.id === deal.stageId);
  if (fromStage && fromStage.pipelineId !== toStage.pipelineId) {
    throw new PipelineError("STAGE_IN_OTHER_PIPELINE");
  }

  if (deal.stageId === toStage.id) return deal;

  const timestamp = now.toISOString();
  const closes = toStage.type !== "open";
  const wasClosed = fromStage !== undefined && fromStage.type !== "open";

  return {
    ...deal,
    stageId: toStage.id,
    probability: toStage.probability,
    // Moving between won and lost keeps the original close date.
    closedAt: closes ? (wasClosed && deal.closedAt ? deal.closedAt : timestamp) : null,
    updatedAt: timestamp,
  };
}

/**
 * Totals for the summary strip. Only deals whose stage is in `stages` count,
 * so pass the stages of one pipeline to get that pipeline's numbers.
 */
export function summarizeDeals(deals: Deal[], stages: Stage[], currency: string): DealSummary {
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const counted = deals.filter((deal) => isLive(deal) && stageById.has(deal.stageId));
  const typeOf = (deal: Deal) => stageById.get(deal.stageId)!.type;

  const open = counted.filter((deal) => typeOf(deal) === "open");
  const openInCurrency = open.filter((deal) => deal.currency === currency);
  const won = counted.filter((deal) => typeOf(deal) === "won");
  const lost = counted.filter((deal) => typeOf(deal) === "lost");

  const closedCount = won.length + lost.length;
  const daysToClose = won
    .filter((deal) => deal.closedAt !== null)
    .map((deal) => (Date.parse(deal.closedAt!) - Date.parse(deal.createdAt)) / DAY_MS);

  return {
    openValue: { amount: sumMoney(openInCurrency.map((deal) => deal.value)), currency },
    weightedValue: {
      amount: sumMoney(openInCurrency.map((deal) => deal.value * deal.probability)),
      currency,
    },
    winRate: closedCount === 0 ? null : won.length / closedCount,
    activeDeals: open.length,
    averageDaysToClose:
      daysToClose.length === 0
        ? null
        : Math.round(daysToClose.reduce((total, days) => total + days, 0) / daysToClose.length),
    otherCurrencyDeals: open.length - openInCurrency.length,
  };
}

export type BoardColumn = {
  stage: Stage;
  deals: Deal[];
  // Value of the column's deals in `currency`; deals in other currencies are listed but not added.
  total: Money;
};

/** Board columns in stage order. Deals are sorted by expected close date, undated last. */
export function buildBoard(deals: Deal[], stages: Stage[], currency: string): BoardColumn[] {
  const closeTime = (deal: Deal) =>
    deal.expectedCloseAt === null ? Number.POSITIVE_INFINITY : Date.parse(deal.expectedCloseAt);

  return [...stages]
    .filter((stage) => stage.deletedAt === null)
    .sort((a, b) => a.order - b.order)
    .map((stage) => {
      const stageDeals = deals
        .filter((deal) => isLive(deal) && deal.stageId === stage.id)
        .sort((a, b) => closeTime(a) - closeTime(b));
      return {
        stage,
        deals: stageDeals,
        total: {
          amount: sumMoney(
            stageDeals.filter((deal) => deal.currency === currency).map((deal) => deal.value),
          ),
          currency,
        },
      };
    });
}
