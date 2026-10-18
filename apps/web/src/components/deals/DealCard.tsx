"use client";

import { useDraggable } from "@dnd-kit/core";
import { useTranslations } from "next-intl";
import type { Deal, Stage } from "@lulu/shared";
import { CardMenu } from "@/components/ui";
import { useFormat } from "@/i18n/format";
import { stageColour, useStageName } from "./stages";

export type DealCardDetails = {
  deal: Deal;
  stage: Stage;
  companyName?: string;
  contactName?: string;
};

type Actions = {
  stages: Stage[];
  onOpen: (deal: Deal) => void;
  onMove: (deal: Deal, stageId: string) => void;
  onDelete: (deal: Deal) => void;
};

/** A card on the board. Drag it to another column, click it to edit, or use its menu. */
export function DealCard(props: DealCardDetails & Actions) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: props.deal.id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      aria-describedby={attributes["aria-describedby"]}
      className={`touch-manipulation ${isDragging ? "opacity-40" : ""}`}
    >
      <DealCardView {...props} />
    </div>
  );
}

/** The card's look on its own, also used for the copy that follows the pointer while dragging. */
export function DealCardView({
  deal,
  stage,
  companyName,
  contactName,
  stages,
  onOpen,
  onMove,
  onDelete,
  floating = false,
}: DealCardDetails & Partial<Actions> & { floating?: boolean }) {
  const t = useTranslations("deals.card");
  const tCommon = useTranslations("common");
  const stageName = useStageName();
  const format = useFormat();
  const related = [companyName, contactName].filter(Boolean).join(" · ");

  return (
    <article
      className={`relative mb-2 rounded-[9px] border border-[#e8e6f0] bg-surface p-[11px] shadow-[0_5px_12px_#24243a04] transition hover:-translate-y-px hover:border-[#c9c4ef] ${
        floating ? "rotate-1 cursor-grabbing shadow-raised" : "cursor-grab"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className="size-[7px] flex-none rounded-full" style={{ background: stageColour(stage) }} aria-hidden />
        {onOpen ? (
          // The stretched button makes the whole card open the deal, while the menu stays clickable on top.
          <button
            type="button"
            onClick={() => onOpen(deal)}
            className="min-w-0 flex-1 truncate text-left text-[10px] font-semibold text-[#454253] after:absolute after:inset-0 after:rounded-[9px]"
          >
            {deal.name}
          </button>
        ) : (
          <strong className="min-w-0 flex-1 truncate text-[10px] font-semibold text-[#454253]">{deal.name}</strong>
        )}
        {stages && onMove && onDelete && onOpen && (
          <CardMenu
            label={t("actions", { name: deal.name })}
            entries={[
              { kind: "item", key: "edit", label: tCommon("edit"), onSelect: () => onOpen(deal) },
              { kind: "separator", key: "sep-move" },
              { kind: "heading", key: "move", label: t("moveTo") },
              ...stages
                .filter((stage) => stage.id !== deal.stageId)
                .map((stage) => ({
                  kind: "item" as const,
                  key: stage.id,
                  label: stageName(stage),
                  onSelect: () => onMove(deal, stage.id),
                })),
              { kind: "separator", key: "sep-delete" },
              { kind: "item", key: "delete", label: tCommon("delete"), onSelect: () => onDelete(deal), danger: true },
            ]}
          />
        )}
      </div>
      {related && <small className="mt-2 block truncate text-[8px] text-[#9b98a8]">{related}</small>}
      <strong className="mt-2.5 mb-2 block text-sm text-[#3f3c4e]">
        {format.money({ amount: deal.value, currency: deal.currency })}
      </strong>
      <div className="h-[5px] overflow-hidden rounded-[5px] bg-[#eeeef4]" aria-hidden>
        <i className="block h-full rounded-[5px] bg-[#7669dd]" style={{ width: `${deal.probability * 100}%` }} />
      </div>
      <footer className="mt-[7px] flex items-center justify-between gap-2 text-[8px] text-text-faint">
        <span>{t("likely", { percent: format.percent(deal.probability) })}</span>
        <span>
          {deal.expectedCloseAt ? t("close", { date: format.dayMonth(deal.expectedCloseAt) }) : t("noCloseDate")}
        </span>
      </footer>
    </article>
  );
}
