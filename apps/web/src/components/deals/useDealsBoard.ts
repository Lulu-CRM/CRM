"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  moveDeal,
  summarizeDeals,
  type Company,
  type Contact,
  type Deal,
  type DealCreateInput,
  type DealSummary,
  type DealUpdateInput,
  type PipelineWithStages,
  type User,
} from "@lulu/shared";
import { api, ApiError } from "@/lib/api";

export type DealsData = {
  pipeline: PipelineWithStages;
  deals: Deal[];
  summary: DealSummary;
  users: User[];
  contacts: Contact[];
  companies: Company[];
};

type State = { status: "loading" } | { status: "error"; error: unknown } | ({ status: "ready" } & DealsData);

const replace = (saved: Deal) => (deals: Deal[]) => deals.map((d) => (d.id === saved.id ? saved : d));

/**
 * Data and actions for the Deals & Pipeline page.
 * Moves are optimistic: the board and the totals change at once, using the same shared
 * logic as the API, and the deal goes back to where it was if the API refuses.
 */
export function useDealsBoard() {
  const [state, setState] = useState<State>({ status: "loading" });
  const stateRef = useRef(state);
  stateRef.current = state;

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const [pipelines, deals, summary, users, contacts, companies] = await Promise.all([
        api.pipelines(),
        api.deals.list(),
        api.deals.summary(),
        api.users(),
        api.contacts.list({ pageSize: 100 }),
        api.companies.list(),
      ]);
      const pipeline = pipelines.find((p) => p.isDefault) ?? pipelines[0];
      if (!pipeline) throw new ApiError("PIPELINE_NOT_FOUND", 404);
      setState({
        status: "ready",
        pipeline,
        deals: deals.data,
        summary,
        users: users.data,
        contacts: contacts.data,
        companies: companies.data,
      });
    } catch (error) {
      setState({ status: "error", error });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Changes the deal list and recalculates the totals locally, so the strip never lags the board.
  const applyDeals = useCallback((change: (deals: Deal[]) => Deal[]) => {
    setState((current) => {
      if (current.status !== "ready") return current;
      const deals = change(current.deals);
      const summary = summarizeDeals(deals, current.pipeline.stages, current.summary.openValue.currency);
      return { ...current, deals, summary };
    });
  }, []);

  // The server's numbers win once they arrive (they cover every deal, not just the loaded page).
  const refreshSummary = useCallback(async () => {
    try {
      const summary = await api.deals.summary();
      setState((current) => (current.status === "ready" ? { ...current, summary } : current));
    } catch {
      // Keep the local numbers; the next action or reload tries again.
    }
  }, []);

  const move = useCallback(
    async (dealId: string, stageId: string) => {
      const current = stateRef.current;
      if (current.status !== "ready") return;
      const original = current.deals.find((d) => d.id === dealId);
      if (!original || original.stageId === stageId) return;

      applyDeals(replace(moveDeal(original, stageId, current.pipeline.stages)));
      try {
        applyDeals(replace(await api.deals.move(dealId, stageId)));
      } catch (error) {
        applyDeals(replace(original));
        throw error;
      } finally {
        void refreshSummary();
      }
    },
    [applyDeals, refreshSummary],
  );

  const create = useCallback(
    async (input: DealCreateInput) => {
      const saved = await api.deals.create(input);
      applyDeals((deals) => [...deals, saved]);
      void refreshSummary();
      return saved;
    },
    [applyDeals, refreshSummary],
  );

  const update = useCallback(
    async (id: string, input: DealUpdateInput) => {
      const saved = await api.deals.update(id, input);
      applyDeals(replace(saved));
      void refreshSummary();
      return saved;
    },
    [applyDeals, refreshSummary],
  );

  const remove = useCallback(
    async (id: string) => {
      await api.deals.remove(id);
      applyDeals((deals) => deals.filter((d) => d.id !== id));
      void refreshSummary();
    },
    [applyDeals, refreshSummary],
  );

  return { state, reload: load, move, create, update, remove };
}
