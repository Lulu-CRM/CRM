"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { Deal } from "@lulu/shared";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, Card, EmptyState, Skeleton, useToast } from "@/components/ui";
import { useErrorMessage } from "@/lib/errors";
import { DealBoard } from "./DealBoard";
import { DealFormModal, type DealFormMode } from "./DealFormModal";
import { DealSummaryStrip } from "./DealSummaryStrip";
import { DealTable } from "./DealTable";
import { DeleteDealModal } from "./DeleteDealModal";
import { useDealsBoard, type DealsData } from "./useDealsBoard";

export function DealsView() {
  const { state, reload, ...actions } = useDealsBoard();

  return (
    <>
      <PageHeader page="deals" />
      <Card>
        {state.status === "loading" && <BoardSkeleton />}
        {state.status === "error" && <LoadError error={state.error} onRetry={reload} />}
        {state.status === "ready" && <Ready data={state} actions={actions} />}
      </Card>
    </>
  );
}

function Ready({ data, actions }: { data: DealsData; actions: Omit<ReturnType<typeof useDealsBoard>, "state" | "reload"> }) {
  const t = useTranslations("deals");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [view, setView] = useState<"board" | "table">("board");
  const [form, setForm] = useState<DealFormMode | null>(null);
  const [toDelete, setToDelete] = useState<Deal | null>(null);

  const { pipeline, deals, summary, users, contacts, companies } = data;
  const stages = useMemo(
    () => pipeline.stages.filter((s) => s.deletedAt === null).sort((a, b) => a.order - b.order),
    [pipeline.stages],
  );
  const currency = summary.openValue.currency;

  const lookup = useMemo(() => {
    const byId = <T extends { id: string; name: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r.name]));
    const companiesById = byId(companies);
    const contactsById = byId(contacts);
    const usersById = byId(users);
    return {
      company: (id: string | null) => (id ? companiesById.get(id) : undefined),
      contact: (id: string | null) => (id ? contactsById.get(id) : undefined),
      owner: (id: string) => usersById.get(id),
    };
  }, [companies, contacts, users]);

  const firstOpenStage = stages.find((s) => s.type === "open") ?? stages[0];

  const move = async (deal: Deal, stageId: string) => {
    try {
      await actions.move(deal.id, stageId);
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{t("eyebrow")}</span>
          <h2 className="mt-1.5 text-[17px] font-semibold tracking-tight text-[#363347]">{t("title")}</h2>
          <p className="mt-1.5 max-w-[610px] text-[10px] leading-relaxed text-[#9190a0]">{t("intro")}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            icon={view === "board" ? "▤" : "▦"}
            onClick={() => setView(view === "board" ? "table" : "board")}
          >
            {view === "board" ? t("tableView") : t("boardView")}
          </Button>
          <Button icon="＋" onClick={() => firstOpenStage && setForm({ kind: "create", stageId: firstOpenStage.id })}>
            {t("addDeal")}
          </Button>
        </div>
      </div>

      <DealSummaryStrip summary={summary} />

      {view === "board" ? (
        <DealBoard
          deals={deals}
          stages={stages}
          currency={currency}
          companyName={lookup.company}
          contactName={lookup.contact}
          onOpen={(deal) => setForm({ kind: "edit", deal })}
          onAdd={(stageId) => setForm({ kind: "create", stageId })}
          onMove={move}
          onDelete={setToDelete}
        />
      ) : (
        <DealTable
          deals={deals}
          stages={stages}
          companyName={lookup.company}
          contactName={lookup.contact}
          ownerName={lookup.owner}
          onOpen={(deal) => setForm({ kind: "edit", deal })}
        />
      )}

      <DealFormModal
        mode={form}
        stages={stages}
        users={users}
        contacts={contacts}
        companies={companies}
        defaultCurrency={currency}
        onClose={() => setForm(null)}
        onCreate={async (input) => {
          await actions.create(input);
          toast(t("toast.created"));
        }}
        onUpdate={async (id, input) => {
          await actions.update(id, input);
          toast(t("toast.saved"));
        }}
      />

      <DeleteDealModal
        deal={toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={async (deal) => {
          try {
            await actions.remove(deal.id);
            setToDelete(null);
            toast(t("toast.deleted"));
          } catch (error) {
            toast(errorMessage(error), "error");
          }
        }}
      />
    </>
  );
}

function BoardSkeleton() {
  const t = useTranslations("common");
  return (
    <div role="status" aria-busy="true" aria-label={t("loading")}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-5 w-64" />
      <Skeleton className="mt-6 h-9 w-full" />
      <div className="mt-5 grid auto-cols-[minmax(220px,1fr)] grid-flow-col gap-2.5 overflow-hidden">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="grid gap-2 rounded-[10px] border border-[#ecebf3] bg-[#fafaff] p-2.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useTranslations("common");
  const errorMessage = useErrorMessage();
  return (
    <EmptyState
      icon="!"
      title={t("error")}
      description={errorMessage(error)}
      action={
        <Button variant="outline" onClick={onRetry}>
          {t("retry")}
        </Button>
      }
    />
  );
}
