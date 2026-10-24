"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { Contact } from "@lulu/shared";

const boxClass =
  "flex w-full items-center justify-between gap-2 rounded-md border border-border-strong bg-surface px-[11px] py-2.5 text-left text-[11px] text-text outline-none focus:border-[#8e83de] focus:shadow-[0_0_0_3px_#eeecff]";

/**
 * A dropdown of the contacts already in the CRM, to pick who belongs to a company (Dave, Oct 24, 2026).
 * Several can be picked; a search narrows long lists.
 */
export function ContactPicker({
  id,
  contacts,
  value,
  onChange,
  companyName,
}: {
  id: string;
  contacts: Contact[];
  value: string[];
  onChange: (ids: string[]) => void;
  // The name of each contact's main company elsewhere; picking them here adds this one, they keep both.
  companyName: (companyId: string | null) => string | undefined;
}) {
  const t = useTranslations("companies.form");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const box = useRef<HTMLDivElement>(null);

  // Close on a click outside or Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && (event.stopPropagation(), setOpen(false));
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const selected = contacts.filter((c) => value.includes(c.id));
  const needle = search.trim().toLocaleLowerCase();
  const shown = needle ? contacts.filter((c) => `${c.name} ${c.email ?? ""}`.toLocaleLowerCase().includes(needle)) : contacts;
  const toggle = (contactId: string) =>
    onChange(value.includes(contactId) ? value.filter((v) => v !== contactId) : [...value, contactId]);

  return (
    <div ref={box} className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={boxClass}
      >
        <span className={`truncate ${selected.length ? "" : "text-text-faint"}`}>
          {selected.length === 0
            ? t("contactsNone")
            : selected.length <= 2
              ? selected.map((c) => c.name).join(", ")
              : t("contactsCount", { count: selected.length })}
        </span>
        <span aria-hidden className="text-text-subtle">
          {open ? "⌃" : "⌄"}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 left-0 z-10 mt-1 rounded-md border border-border bg-surface p-2 shadow-card">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("contactsSearch")}
            aria-label={t("contactsSearch")}
            className="mb-1.5 w-full rounded-md border border-border-strong px-2.5 py-1.5 text-[11px] outline-none focus:border-[#8e83de]"
          />
          <ul role="listbox" aria-label={t("contacts")} aria-multiselectable className="max-h-48 overflow-y-auto">
            {contacts.length === 0 && <li className="px-2 py-2 text-[10px] text-text-subtle">{t("contactsEmpty")}</li>}
            {shown.map((contact) => {
              const elsewhere = companyName(contact.companyId);
              return (
                <li key={contact.id} role="option" aria-selected={value.includes(contact.id)}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[11px] hover:bg-surface-muted">
                    <input
                      type="checkbox"
                      checked={value.includes(contact.id)}
                      onChange={() => toggle(contact.id)}
                      className="accent-[#6259d6]"
                    />
                    <span className="min-w-0 flex-1 truncate">{contact.name}</span>
                    {elsewhere && !value.includes(contact.id) && (
                      <small className="truncate text-[9px] text-text-faint">{elsewhere}</small>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
