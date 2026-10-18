import { describe, expect, it } from "vitest";
import type { Deal } from "./deal.js";
import { dealSchema, dealSummarySchema } from "./deal.js";
import { demoDeals, demoPipeline, demoStages } from "./fixtures/pipeline.js";
import { buildBoard, moveDeal, PipelineError, summarizeDeals } from "./pipeline-logic.js";
import { pipelineWithStagesSchema, type Stage } from "./pipeline.js";

const NOW = new Date("2026-10-20T10:00:00.000Z");

const deal = (overrides: Partial<Deal>): Deal => ({ ...demoDeals[0], ...overrides });

describe("fixtures", () => {
  it("match the schemas", () => {
    expect(() => pipelineWithStagesSchema.parse(demoPipeline)).not.toThrow();
    for (const d of demoDeals) expect(() => dealSchema.parse(d)).not.toThrow();
  });
});

describe("moveDeal", () => {
  it("takes the probability of the new stage and stays open", () => {
    const moved = moveDeal(demoDeals[0], "stage_negotiation", demoStages, NOW);
    expect(moved.stageId).toBe("stage_negotiation");
    expect(moved.probability).toBe(0.85);
    expect(moved.closedAt).toBeNull();
    expect(moved.updatedAt).toBe(NOW.toISOString());
  });

  it("sets closedAt when the deal is won or lost", () => {
    expect(moveDeal(demoDeals[0], "stage_won", demoStages, NOW)).toMatchObject({
      probability: 1,
      closedAt: NOW.toISOString(),
    });
    expect(moveDeal(demoDeals[0], "stage_lost", demoStages, NOW)).toMatchObject({
      probability: 0,
      closedAt: NOW.toISOString(),
    });
  });

  it("clears closedAt when a closed deal is reopened", () => {
    const won = moveDeal(demoDeals[0], "stage_won", demoStages, NOW);
    expect(moveDeal(won, "stage_proposal", demoStages, NOW).closedAt).toBeNull();
  });

  it("keeps the original close date when moving between won and lost", () => {
    const won = moveDeal(demoDeals[0], "stage_won", demoStages, NOW);
    const later = new Date("2026-10-25T10:00:00.000Z");
    expect(moveDeal(won, "stage_lost", demoStages, later).closedAt).toBe(NOW.toISOString());
  });

  it("returns the same deal when the stage does not change", () => {
    expect(moveDeal(demoDeals[0], demoDeals[0].stageId, demoStages, NOW)).toBe(demoDeals[0]);
  });

  it("does not change the original deal", () => {
    const before = { ...demoDeals[0] };
    moveDeal(demoDeals[0], "stage_won", demoStages, NOW);
    expect(demoDeals[0]).toEqual(before);
  });

  it("rejects an unknown stage", () => {
    expect(() => moveDeal(demoDeals[0], "stage_missing", demoStages, NOW)).toThrow(
      expect.objectContaining({ code: "STAGE_NOT_FOUND" }),
    );
  });

  it("rejects a stage from another pipeline", () => {
    const other: Stage = { ...demoStages[0], id: "stage_other", pipelineId: "pipeline_other" };
    const error = (() => {
      try {
        moveDeal(demoDeals[0], "stage_other", [...demoStages, other], NOW);
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(PipelineError);
    expect((error as PipelineError).code).toBe("STAGE_IN_OTHER_PIPELINE");
  });
});

describe("summarizeDeals", () => {
  it("totals the design's open deals", () => {
    const summary = summarizeDeals(demoDeals, demoStages, "EUR");
    expect(dealSummarySchema.parse(summary)).toEqual(summary);
    expect(summary.openValue).toEqual({ amount: 97900, currency: "EUR" });
    // 24000*0.7 + 42500*0.85 + 12800*0.4 + 18600*0.2
    expect(summary.weightedValue).toEqual({ amount: 61765, currency: "EUR" });
    expect(summary.activeDeals).toBe(4);
    expect(summary.winRate).toBeNull();
    expect(summary.averageDaysToClose).toBeNull();
    expect(summary.otherCurrencyDeals).toBe(0);
  });

  it("updates the totals when a deal is won", () => {
    const won = moveDeal(demoDeals[1], "stage_won", demoStages, NOW);
    const summary = summarizeDeals([demoDeals[0], won, demoDeals[2], demoDeals[3]], demoStages, "EUR");
    expect(summary.openValue.amount).toBe(97900 - 42500);
    expect(summary.activeDeals).toBe(3);
    expect(summary.winRate).toBe(1);
    // created Oct 1, closed Oct 20
    expect(summary.averageDaysToClose).toBe(19);
  });

  it("computes the win rate from won and lost deals", () => {
    const deals = [
      deal({ id: "a", stageId: "stage_won", closedAt: NOW.toISOString() }),
      deal({ id: "b", stageId: "stage_won", closedAt: NOW.toISOString() }),
      deal({ id: "c", stageId: "stage_won", closedAt: NOW.toISOString() }),
      deal({ id: "d", stageId: "stage_lost", closedAt: NOW.toISOString() }),
    ];
    expect(summarizeDeals(deals, demoStages, "EUR").winRate).toBe(0.75);
  });

  it("leaves deals in other currencies out of the money totals", () => {
    const deals = [deal({ id: "eur", value: 1000 }), deal({ id: "usd", value: 5000, currency: "USD" })];
    const summary = summarizeDeals(deals, demoStages, "EUR");
    expect(summary.openValue.amount).toBe(1000);
    expect(summary.activeDeals).toBe(2);
    expect(summary.otherCurrencyDeals).toBe(1);
  });

  it("ignores deleted deals and deals from other pipelines", () => {
    const deals = [
      deal({ id: "live", value: 1000 }),
      deal({ id: "deleted", value: 2000, deletedAt: NOW.toISOString() }),
      deal({ id: "elsewhere", value: 4000, stageId: "stage_other_pipeline" }),
    ];
    const summary = summarizeDeals(deals, demoStages, "EUR");
    expect(summary.openValue.amount).toBe(1000);
    expect(summary.activeDeals).toBe(1);
  });

  it("adds values without floating point noise", () => {
    const deals = [deal({ id: "a", value: 0.1 }), deal({ id: "b", value: 0.2 })];
    expect(summarizeDeals(deals, demoStages, "EUR").openValue.amount).toBe(0.3);
  });
});

describe("buildBoard", () => {
  it("puts stages in order with their deals and totals", () => {
    const board = buildBoard(demoDeals, [...demoStages].reverse(), "EUR");
    expect(board.map((column) => column.stage.key)).toEqual([
      "new",
      "qualified",
      "proposal",
      "negotiation",
      "won",
      "lost",
    ]);
    expect(board[2].deals.map((d) => d.id)).toEqual(["deal_northstar"]);
    expect(board[2].total).toEqual({ amount: 24000, currency: "EUR" });
    expect(board[4].deals).toEqual([]);
    expect(board[4].total.amount).toBe(0);
  });

  it("sorts deals by expected close date, undated last", () => {
    const deals = [
      deal({ id: "undated", expectedCloseAt: null }),
      deal({ id: "late", expectedCloseAt: "2026-12-01T12:00:00.000Z" }),
      deal({ id: "soon", expectedCloseAt: "2026-10-22T12:00:00.000Z" }),
    ];
    const column = buildBoard(deals, demoStages, "EUR").find((c) => c.stage.key === "proposal")!;
    expect(column.deals.map((d) => d.id)).toEqual(["soon", "late", "undated"]);
  });

  it("hides deleted stages and deleted deals", () => {
    const stages = demoStages.map((s) => (s.key === "lost" ? { ...s, deletedAt: NOW.toISOString() } : s));
    const deals = [...demoDeals, deal({ id: "gone", deletedAt: NOW.toISOString() })];
    const board = buildBoard(deals, stages, "EUR");
    expect(board).toHaveLength(5);
    expect(board.flatMap((c) => c.deals)).toHaveLength(4);
  });
});
