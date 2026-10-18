"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useTranslations } from "next-intl";
import type { Contact, LifecycleStage } from "@lulu/shared";
import { Avatar, CardMenu, Pill } from "@/components/ui";
import { useFormat } from "@/i18n/format";
import { avatarTone, initials, knownSources, lifecycleStages, stageTone } from "@/features/contacts/options";

type Props = {
  contacts: Contact[];
  companyName: (id: string | null) => string | undefined;
  onOpen: (contact: Contact) => void;
  onAdd: (stage: LifecycleStage) => void;
  onMove: (contact: Contact, stage: LifecycleStage) => void;
};

// Most recently touched first; never-touched leads last.
const byLastTouch = (a: Contact, b: Contact) => (b.lastTouchAt ?? "").localeCompare(a.lastTouchAt ?? "");

export function LeadBoard({ contacts, companyName, onOpen, onAdd, onMove }: Props) {
  const t = useTranslations("leads.dnd");
  const tStage = useTranslations("lifecycleStages");
  const [activeId, setActiveId] = useState<string | null>(null);

  const contactById = (id: string | number) => contacts.find((c) => c.id === id);
  const isStage = (id: unknown): id is LifecycleStage => lifecycleStages.includes(id as LifecycleStage);

  // A short move (mouse) or a press-and-hold (touch) starts a drag, so clicks and scrolling still work.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  // dnd-kit's built-in screen reader messages are English only, so they come from our translations.
  const name = (id: string | number) => contactById(id)?.name ?? "";
  const stage = (id: unknown) => (isStage(id) ? tStage(id) : "");
  const announcements: Announcements = {
    onDragStart: ({ active }) => t("picked", { name: name(active.id) }),
    onDragOver: ({ active, over }) => (over ? t("over", { name: name(active.id), stage: stage(over.id) }) : undefined),
    onDragEnd: ({ active, over }) =>
      over ? t("dropped", { name: name(active.id), stage: stage(over.id) }) : t("cancelled", { name: name(active.id) }),
    onDragCancel: ({ active }) => t("cancelled", { name: name(active.id) }),
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    const contact = contactById(active.id);
    if (contact && over && isStage(over.id) && over.id !== contact.lifecycleStage) onMove(contact, over.id);
  };

  const active = activeId ? contactById(activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t("instructions") } }}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="mt-5 grid auto-cols-[minmax(220px,1fr)] grid-flow-col items-start gap-2.5 overflow-x-auto pb-2">
        {lifecycleStages.map((key) => (
          <LeadColumn
            key={key}
            stage={key}
            contacts={contacts.filter((c) => c.lifecycleStage === key).sort(byLastTouch)}
            companyName={companyName}
            onOpen={onOpen}
            onAdd={onAdd}
            onMove={onMove}
          />
        ))}
      </div>
      <DragOverlay>{active && <LeadCardView contact={active} companyName={companyName(active.companyId)} floating />}</DragOverlay>
    </DndContext>
  );
}

function LeadColumn({
  stage,
  contacts,
  companyName,
  onOpen,
  onAdd,
  onMove,
}: { stage: LifecycleStage } & Omit<Props, "contacts"> & { contacts: Contact[] }) {
  const t = useTranslations("leads.column");
  const tStage = useTranslations("lifecycleStages");
  const format = useFormat();
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const label = tStage(stage);

  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      className={`min-w-0 rounded-[10px] border bg-[#fafaff] p-2.5 transition-colors ${
        isOver ? "border-[#c9c4ef] bg-primary-soft/60" : "border-[#ecebf3]"
      }`}
    >
      <header className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-[7px]">
          <h3 className="truncate text-[10px] font-bold text-[#4b4859]">{label}</h3>
          <b className="rounded-[9px] bg-primary-soft px-1.5 py-[3px] text-[8px] text-[#5e54c2]">
            {format.number(contacts.length)}
          </b>
        </div>
        <button
          type="button"
          onClick={() => onAdd(stage)}
          aria-label={t("addLead", { stage: label })}
          className="rounded text-base leading-none text-[#858399] hover:text-primary"
        >
          ＋
        </button>
      </header>

      {contacts.map((contact) => (
        <LeadCard
          key={contact.id}
          contact={contact}
          companyName={companyName(contact.companyId)}
          onOpen={onOpen}
          onMove={onMove}
        />
      ))}
      {contacts.length === 0 && <p className="py-3 text-center text-[9px] text-text-faint">{t("empty")}</p>}

      <button
        type="button"
        onClick={() => onAdd(stage)}
        className="w-full rounded-lg border border-dashed border-[#d8d5e5] p-[9px] text-[9px] text-[#9996a8] hover:border-[#c9c4ef] hover:text-primary"
      >
        ＋ {t("add")}
      </button>
    </section>
  );
}

type CardProps = {
  contact: Contact;
  companyName?: string;
  onOpen: (contact: Contact) => void;
  onMove: (contact: Contact, stage: LifecycleStage) => void;
};

function LeadCard(props: CardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: props.contact.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      aria-describedby={attributes["aria-describedby"]}
      className={`touch-manipulation ${isDragging ? "opacity-40" : ""}`}
    >
      <LeadCardView {...props} />
    </div>
  );
}

/** The card's look on its own, also used for the copy that follows the pointer while dragging. */
function LeadCardView({
  contact,
  companyName,
  onOpen,
  onMove,
  floating = false,
}: { contact: Contact; companyName?: string; floating?: boolean } & Partial<Pick<CardProps, "onOpen" | "onMove">>) {
  const t = useTranslations("leads.card");
  const tStage = useTranslations("lifecycleStages");
  const tSource = useTranslations("sources");
  const format = useFormat();

  const source = contact.source
    ? (knownSources as readonly string[]).includes(contact.source)
      ? tSource(contact.source)
      : contact.source
    : null;
  const details = [contact.jobRole, source].filter(Boolean).join(" · ");

  return (
    <article
      className={`relative mb-2 rounded-[9px] border border-[#e8e6f0] bg-surface p-[11px] shadow-[0_5px_12px_#24243a04] transition hover:-translate-y-px hover:border-[#c9c4ef] ${
        floating ? "rotate-1 cursor-grabbing shadow-raised" : "cursor-grab"
      }`}
    >
      <div className="flex items-center gap-2">
        <Avatar initials={initials(contact.name)} tone={avatarTone(contact.id)} small />
        <span className="min-w-0 flex-1">
          {onOpen ? (
            // The stretched button makes the whole card open the profile, while the menu stays clickable on top.
            <button
              type="button"
              onClick={() => onOpen(contact)}
              className="block w-full truncate text-left text-[10px] font-semibold text-[#414050] after:absolute after:inset-0 after:rounded-[9px]"
            >
              {contact.name}
            </button>
          ) : (
            <strong className="block truncate text-[10px] font-semibold text-[#414050]">{contact.name}</strong>
          )}
          {companyName && <small className="mt-[3px] block truncate text-[8px] text-[#9996a7]">{companyName}</small>}
        </span>
        {onOpen && onMove && (
          <CardMenu
            label={t("actions", { name: contact.name })}
            entries={[
              { kind: "item", key: "open", label: t("open"), onSelect: () => onOpen(contact) },
              { kind: "separator", key: "sep" },
              { kind: "heading", key: "move", label: t("moveTo") },
              ...lifecycleStages
                .filter((stage) => stage !== contact.lifecycleStage)
                .map((stage) => ({
                  kind: "item" as const,
                  key: stage,
                  label: tStage(stage),
                  onSelect: () => onMove(contact, stage),
                })),
            ]}
          />
        )}
      </div>
      {details && <p className="my-2.5 truncate text-[9px] text-[#888596]">{details}</p>}
      <footer className="mt-2 flex items-center justify-between gap-2 text-[8px] text-text-faint">
        <Pill tone={stageTone[contact.lifecycleStage]}>{tStage(contact.lifecycleStage)}</Pill>
        <span>{contact.lastTouchAt ? format.recent(contact.lastTouchAt) : t("noTouch")}</span>
      </footer>
    </article>
  );
}
