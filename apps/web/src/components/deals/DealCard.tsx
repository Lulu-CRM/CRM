"use client";

import { useEffect, useRef, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { useTranslations } from "next-intl";
import type { Deal, Stage } from "@lulu/shared";
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
          <DealMenu deal={deal} stages={stages} onOpen={onOpen} onMove={onMove} onDelete={onDelete} />
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

function DealMenu({ deal, stages, onOpen, onMove, onDelete }: { deal: Deal } & Actions) {
  const t = useTranslations("deals.card");
  const tCommon = useTranslations("common");
  const stageName = useStageName();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  const item = "block w-full rounded-md px-2.5 py-1.5 text-left text-[10px] text-text-strong hover:bg-surface-muted";

  return (
    // Stop the pointer here so opening the menu never starts a drag.
    <div ref={root} className="relative z-10" onPointerDown={(event) => event.stopPropagation()}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("actions", { name: deal.name })}
        onClick={() => setOpen((value) => !value)}
        className="rounded px-1 text-[#9e9aaa] hover:bg-surface-muted"
      >
        •••
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-6 right-0 w-48 rounded-lg border border-border bg-surface p-1 shadow-[0_12px_30px_#201c4b1f]"
        >
          <button type="button" role="menuitem" className={item} onClick={run(() => onOpen(deal))}>
            {tCommon("edit")}
          </button>
          <div className="my-1 border-t border-border" role="separator" />
          <span className="block px-2.5 pt-1 pb-0.5 text-[8px] font-black tracking-[0.12em] text-rail-label uppercase">
            {t("moveTo")}
          </span>
          {stages
            .filter((stage) => stage.id !== deal.stageId)
            .map((stage) => (
              <button
                key={stage.id}
                type="button"
                role="menuitem"
                className={item}
                onClick={run(() => onMove(deal, stage.id))}
              >
                {stageName(stage)}
              </button>
            ))}
          <div className="my-1 border-t border-border" role="separator" />
          <button
            type="button"
            role="menuitem"
            className={`${item} text-[#c2413d]`}
            onClick={run(() => onDelete(deal))}
          >
            {tCommon("delete")}
          </button>
        </div>
      )}
    </div>
  );
}
