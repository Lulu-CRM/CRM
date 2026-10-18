"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { LifecycleStage } from "@lulu/shared";
import { lifecycleStages } from "./options";
import type { Lookups } from "./useLookups";

export type ExtraFilters = { stage?: LifecycleStage; ownerId?: string };

const select =
  "w-full rounded-md border border-border-strong bg-surface px-2.5 py-2 text-[11px] text-text outline-none focus:border-[#8e83de]";

// The design's "+ Filter" chip: status and owner on top of the quick filters.
export function FilterMenu({
  value,
  onChange,
  lookups,
}: {
  value: ExtraFilters;
  onChange: (value: ExtraFilters) => void;
  lookups: Lookups;
}) {
  const t = useTranslations("contacts.moreFilters");
  const tStage = useTranslations("lifecycleStages");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !box.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const chip = (label: string, clear: () => void) => (
    <span className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-1 text-[10px] font-bold whitespace-nowrap text-primary-hover">
      {label}
      <button type="button" onClick={clear} aria-label={t("remove", { filter: label })} className="px-0.5 hover:text-text">
        ✕
      </button>
    </span>
  );

  return (
    <div ref={box} className="relative flex items-center gap-1">
      {value.stage && chip(tStage(value.stage), () => onChange({ ...value, stage: undefined }))}
      {value.ownerId && chip(lookups.userName(value.ownerId) ?? value.ownerId, () => onChange({ ...value, ownerId: undefined }))}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="rounded-md px-2.5 py-1.5 text-[10px] whitespace-nowrap text-text-subtle hover:bg-surface-soft"
      >
        ＋ {t("button")}
      </button>
      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 grid w-56 gap-3 rounded-lg border border-border bg-surface p-3 shadow-raised">
          <label className="grid gap-1.5">
            <span className="text-[10px] font-extrabold text-neutral">{t("status")}</span>
            <select
              className={select}
              value={value.stage ?? ""}
              onChange={(e) => onChange({ ...value, stage: (e.target.value || undefined) as LifecycleStage | undefined })}
            >
              <option value="">{t("any")}</option>
              {lifecycleStages.map((stage) => (
                <option key={stage} value={stage}>
                  {tStage(stage)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-[10px] font-extrabold text-neutral">{t("owner")}</span>
            <select
              className={select}
              value={value.ownerId ?? ""}
              onChange={(e) => onChange({ ...value, ownerId: e.target.value || undefined })}
            >
              <option value="">{t("any")}</option>
              {lookups.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
