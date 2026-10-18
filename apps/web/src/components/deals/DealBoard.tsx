"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useTranslations } from "next-intl";
import { buildBoard, type BoardColumn, type Deal, type Stage } from "@lulu/shared";
import { useFormat } from "@/i18n/format";
import { DealCard, DealCardView } from "./DealCard";
import { stageColour, useStageName } from "./stages";

type Props = {
  deals: Deal[];
  stages: Stage[];
  currency: string;
  companyName: (id: string | null) => string | undefined;
  contactName: (id: string | null) => string | undefined;
  onOpen: (deal: Deal) => void;
  onAdd: (stageId: string) => void;
  onMove: (deal: Deal, stageId: string) => void;
  onDelete: (deal: Deal) => void;
};

export function DealBoard({ deals, stages, currency, companyName, contactName, onOpen, onAdd, onMove, onDelete }: Props) {
  const t = useTranslations("deals.dnd");
  const stageName = useStageName();
  const [activeId, setActiveId] = useState<string | null>(null);

  const columns = useMemo(() => buildBoard(deals, stages, currency), [deals, stages, currency]);
  const dealById = (id: string | number) => deals.find((d) => d.id === id);
  const stageById = (id: string | number | undefined) => stages.find((s) => s.id === id);

  // A short move (mouse) or a press-and-hold (touch) starts a drag, so clicks and scrolling still work.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  // dnd-kit's built-in screen reader messages are English only, so they come from our translations.
  const name = (id: string | number) => dealById(id)?.name ?? "";
  const stageLabel = (id: string | number | undefined) => {
    const stage = stageById(id);
    return stage ? stageName(stage) : "";
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => t("picked", { name: name(active.id) }),
    onDragOver: ({ active, over }) => (over ? t("over", { name: name(active.id), stage: stageLabel(over.id) }) : undefined),
    onDragEnd: ({ active, over }) =>
      over ? t("dropped", { name: name(active.id), stage: stageLabel(over.id) }) : t("cancelled", { name: name(active.id) }),
    onDragCancel: ({ active }) => t("cancelled", { name: name(active.id) }),
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    const deal = dealById(active.id);
    if (deal && over && over.id !== deal.stageId) onMove(deal, String(over.id));
  };

  const active = activeId ? dealById(activeId) : undefined;
  const activeStage = active && stageById(active.stageId);

  return (
    <DndContext
      sensors={sensors}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t("instructions") } }}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="mt-5 grid auto-cols-[minmax(220px,1fr)] grid-flow-col items-start gap-2.5 overflow-x-auto pb-2">
        {columns.map((column) => (
          <DealColumn
            key={column.stage.id}
            column={column}
            stages={stages}
            companyName={companyName}
            contactName={contactName}
            onOpen={onOpen}
            onAdd={onAdd}
            onMove={onMove}
            onDelete={onDelete}
          />
        ))}
      </div>
      <DragOverlay>
        {active && activeStage && (
          <DealCardView
            deal={active}
            stage={activeStage}
            companyName={companyName(active.companyId)}
            contactName={contactName(active.contactId)}
            floating
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

function DealColumn({
  column,
  stages,
  companyName,
  contactName,
  onOpen,
  onAdd,
  onMove,
  onDelete,
}: { column: BoardColumn } & Omit<Props, "deals" | "currency">) {
  const t = useTranslations("deals.column");
  const format = useFormat();
  const stageName = useStageName();
  const { setNodeRef, isOver } = useDroppable({ id: column.stage.id });
  const label = stageName(column.stage);

  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      className={`min-w-0 rounded-[10px] border bg-[#fafaff] p-2.5 transition-colors ${
        isOver ? "border-[#c9c4ef] bg-primary-soft/60" : "border-[#ecebf3]"
      }`}
    >
      <header className="mb-2.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-[7px]">
            <span className="size-[7px] rounded-full" style={{ background: stageColour(column.stage) }} aria-hidden />
            <h3 className="truncate text-[10px] font-bold text-[#4b4859]">{label}</h3>
            <b className="rounded-[9px] bg-primary-soft px-1.5 py-[3px] text-[8px] text-[#5e54c2]">
              {format.number(column.deals.length)}
            </b>
          </div>
          <span className="mt-1 block text-[9px] text-text-subtle" data-testid={`column-total-${column.stage.key ?? column.stage.id}`}>
            {format.money(column.total)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onAdd(column.stage.id)}
          aria-label={t("addDeal", { stage: label })}
          className="rounded text-base leading-none text-[#858399] hover:text-primary"
        >
          ＋
        </button>
      </header>

      {column.deals.map((deal) => (
        <DealCard
          key={deal.id}
          deal={deal}
          stage={column.stage}
          companyName={companyName(deal.companyId)}
          contactName={contactName(deal.contactId)}
          stages={stages}
          onOpen={onOpen}
          onMove={onMove}
          onDelete={onDelete}
        />
      ))}
      {column.deals.length === 0 && <p className="py-3 text-center text-[9px] text-text-faint">{t("empty")}</p>}

      <button
        type="button"
        onClick={() => onAdd(column.stage.id)}
        className="w-full rounded-lg border border-dashed border-[#d8d5e5] p-[9px] text-[9px] text-[#9996a8] hover:border-[#c9c4ef] hover:text-primary"
      >
        ＋ {t("add")}
      </button>
    </section>
  );
}
