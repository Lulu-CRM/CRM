"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { Deal, Stage } from "@lulu/shared";
import { Avatar, EmptyState, Pill, Table, type Column, type PillTone, type SortState } from "@/components/ui";
import { useFormat } from "@/i18n/format";
import { initials, toneFor } from "@/lib/initials";
import { useStageName } from "./stages";

type Props = {
  deals: Deal[];
  stages: Stage[];
  companyName: (id: string | null) => string | undefined;
  contactName: (id: string | null) => string | undefined;
  ownerName: (id: string) => string | undefined;
  onOpen: (deal: Deal) => void;
};

const toneForStage = (stage: Stage | undefined): PillTone =>
  stage?.type === "won" ? "success" : stage?.type === "lost" ? "neutral" : "violet";

export function DealTable({ deals, stages, companyName, contactName, ownerName, onOpen }: Props) {
  const t = useTranslations("deals.table");
  const format = useFormat();
  const stageName = useStageName();
  const [sort, setSort] = useState<SortState>({ key: "expectedCloseAt", direction: "asc" });

  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);
  const rows = useMemo(() => {
    const live = deals.filter((d) => d.deletedAt === null && stageById.has(d.stageId));
    if (!sort) return live;
    const value = (deal: Deal): number | string => {
      if (sort.key === "value") return deal.value;
      if (sort.key === "probability") return deal.probability;
      if (sort.key === "stage") return stageById.get(deal.stageId)!.order;
      if (sort.key === "expectedCloseAt") return deal.expectedCloseAt ?? "￿";
      return deal.name.toLocaleLowerCase();
    };
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...live].sort((a, b) => (value(a) < value(b) ? -1 : value(a) > value(b) ? 1 : 0) * direction);
  }, [deals, sort, stageById]);

  if (rows.length === 0) return <EmptyState title={t("empty")} description={t("emptyHint")} />;

  const columns: Column<Deal>[] = [
    {
      key: "name",
      header: t("deal"),
      sortable: true,
      cell: (deal) => (
        <span>
          <strong className="block text-[10px] text-text">{deal.name}</strong>
          <small className="text-[9px] text-text-subtle">{companyName(deal.companyId)}</small>
        </span>
      ),
    },
    { key: "contact", header: t("contact"), cell: (deal) => contactName(deal.contactId) ?? "–" },
    {
      key: "stage",
      header: t("stage"),
      sortable: true,
      cell: (deal) => {
        const stage = stageById.get(deal.stageId);
        return <Pill tone={toneForStage(stage)}>{stage ? stageName(stage) : ""}</Pill>;
      },
    },
    {
      key: "value",
      header: t("value"),
      sortable: true,
      cell: (deal) => (
        <strong className="text-text">{format.money({ amount: deal.value, currency: deal.currency })}</strong>
      ),
    },
    { key: "probability", header: t("probability"), sortable: true, cell: (deal) => format.percent(deal.probability) },
    {
      key: "expectedCloseAt",
      header: t("close"),
      sortable: true,
      cell: (deal) => (deal.expectedCloseAt ? format.date(deal.expectedCloseAt) : "–"),
    },
    {
      key: "owner",
      header: t("owner"),
      cell: (deal) => {
        const owner = ownerName(deal.ownerId);
        return owner ? (
          <span className="flex items-center gap-2">
            <Avatar initials={initials(owner)} tone={toneFor(deal.ownerId)} small />
            {owner}
          </span>
        ) : (
          "–"
        );
      },
    },
  ];

  return (
    <div className="mt-5">
      <Table columns={columns} rows={rows} rowKey={(deal) => deal.id} onRowClick={onOpen} sort={sort} onSortChange={setSort} />
    </div>
  );
}
