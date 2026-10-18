"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  segmentMembers,
  type Contact,
  type SegmentColor,
  type SegmentCreateInput,
  type SegmentContext,
  type SegmentListItem,
  type User,
} from "@lulu/shared";
import { Button, Modal } from "@/components/ui";
import { lifecycleStages } from "@/features/contacts/options";
import { fields, newDraft, operators, toCondition, toDraft, type DraftCondition, type Field } from "./rules";
import { colours, SegmentIcon } from "./SegmentIcon";

const inputClass =
  "w-full rounded-md border border-border-strong bg-surface px-[11px] py-2.5 text-[11px] text-text outline-none focus:border-[#8e83de] focus:shadow-[0_0_0_3px_#eeecff] aria-[invalid=true]:border-[#d9534f]";
const smallInput =
  "min-w-0 rounded-md border border-border-strong bg-surface px-2 py-2 text-[10px] text-text outline-none focus:border-[#8e83de] aria-[invalid=true]:border-[#d9534f]";

// New segment when `segment` is null, edit otherwise. The count updates live while the rules change.
export function SegmentFormModal({
  open,
  segment,
  users,
  contacts,
  context,
  onClose,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  segment: SegmentListItem | null;
  users: User[];
  contacts: Contact[];
  context: SegmentContext | null;
  onClose: () => void;
  onSubmit: (input: SegmentCreateInput) => Promise<void>;
  onDelete: (segment: SegmentListItem) => void;
}) {
  const t = useTranslations("segments.form");
  const tField = useTranslations("segments.fields");
  const tOp = useTranslations("segments.operators");
  const tColour = useTranslations("segments.colours");
  const tStage = useTranslations("lifecycleStages");
  const tCommon = useTranslations("common");
  const id = useId();

  const defaultOwner = users[0]?.id ?? "";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [colour, setColour] = useState<SegmentColor>("violet");
  const [match, setMatch] = useState<"all" | "any">("all");
  const [drafts, setDrafts] = useState<DraftCondition[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(segment?.name ?? "");
    setDescription(segment?.description ?? "");
    setColour(segment?.color ?? "violet");
    setMatch(segment?.rules.match ?? "all");
    setDrafts(segment ? segment.rules.conditions.map(toDraft) : [newDraft("lifecycleStage", defaultOwner)]);
    setSubmitted(false);
  }, [open, segment, defaultOwner]);

  const conditions = drafts.map(toCondition);
  const complete = conditions.every((c) => c !== null) && conditions.length > 0;
  const preview = useMemo(
    () =>
      complete && context
        ? segmentMembers(contacts, { match, conditions: conditions as NonNullable<(typeof conditions)[number]>[] }, context).length
        : null,
    // conditions is derived from drafts on every render; drafts is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [complete, context, contacts, match, drafts],
  );

  const update = (key: string, change: Partial<DraftCondition>) =>
    setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...change } : d)));
  const changeField = (key: string, field: Field) =>
    setDrafts((list) => list.map((d) => (d.key === key ? { ...newDraft(field, defaultOwner), key } : d)));

  const nameMissing = name.trim() === "";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (nameMissing || !complete) return;
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || null,
        color: colour,
        rules: { match, conditions: conditions as NonNullable<(typeof conditions)[number]>[] },
      });
    } finally {
      setSaving(false);
    }
  };

  const valueControl = (draft: DraftCondition, index: number) => {
    const invalid = submitted && conditions[index] === null ? true : undefined;
    const label = t("value");
    const common = { "aria-label": label, "aria-invalid": invalid, className: `${smallInput} flex-1` };
    switch (draft.field) {
      case "lifecycleStage":
        return (
          <select {...common} value={draft.value} onChange={(e) => update(draft.key, { value: e.target.value })}>
            {lifecycleStages.map((s) => (
              <option key={s} value={s}>{tStage(s)}</option>
            ))}
          </select>
        );
      case "ownerId":
        return (
          <select {...common} value={draft.value} onChange={(e) => update(draft.key, { value: e.target.value })}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        );
      case "tag":
        return <input {...common} value={draft.value} placeholder={t("tagPlaceholder")} onChange={(e) => update(draft.key, { value: e.target.value })} />;
      case "marketingConsent":
        return (
          <select {...common} value={draft.value} onChange={(e) => update(draft.key, { value: e.target.value })}>
            <option value="true">{t("consentGranted")}</option>
            <option value="false">{t("consentNotGranted")}</option>
          </select>
        );
      case "lastTouch":
        return draft.op === "never" ? null : (
          <span className="flex flex-1 items-center gap-1.5">
            <input {...common} type="number" min={1} max={3650} value={draft.value} onChange={(e) => update(draft.key, { value: e.target.value })} />
            <span className="text-[10px] text-text-subtle">{t("days")}</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      eyebrow={segment ? t("editEyebrow") : t("newEyebrow")}
      title={segment ? t("editTitle") : t("newTitle")}
    >
      <form onSubmit={submit} noValidate className="grid gap-3.5 sm:grid-cols-2">
        <div className="grid content-start gap-1.5 sm:col-span-2">
          <label htmlFor={`${id}-name`} className="text-[10px] font-extrabold text-neutral">
            {t("name")}<span className="text-[#c2413d]" aria-hidden> *</span>
          </label>
          <input
            id={`${id}-name`}
            className={inputClass}
            value={name}
            placeholder={t("namePlaceholder")}
            onChange={(e) => setName(e.target.value)}
            aria-required
            aria-invalid={submitted && nameMissing ? true : undefined}
            aria-describedby={submitted && nameMissing ? `${id}-name-error` : undefined}
          />
          {submitted && nameMissing && (
            <span id={`${id}-name-error`} className="text-[10px] text-[#d9534f]">{t("errors.name")}</span>
          )}
        </div>
        <div className="grid content-start gap-1.5">
          <label htmlFor={`${id}-description`} className="text-[10px] font-extrabold text-neutral">{t("description")}</label>
          <input id={`${id}-description`} className={inputClass} value={description} placeholder={t("descriptionPlaceholder")} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <fieldset className="grid content-start gap-1.5">
          <legend className="mb-1.5 text-[10px] font-extrabold text-neutral">{t("colour")}</legend>
          <div className="flex gap-2">
            {colours.map((c) => (
              <label key={c} className={`cursor-pointer rounded-[11px] p-0.5 ${colour === c ? "ring-2 ring-[#8e83de]" : ""}`}>
                <input type="radio" name={`${id}-colour`} value={c} checked={colour === c} onChange={() => setColour(c)} className="sr-only" aria-label={tColour(c)} />
                <SegmentIcon colour={c} />
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="grid gap-2 rounded-lg border border-border p-3 sm:col-span-2">
          <legend className="px-1 text-[10px] font-extrabold text-neutral">{t("conditions")}</legend>
          <label className="flex flex-wrap items-center gap-2 text-[10px] text-text-muted">
            {t("matchLabel")}
            <select className={smallInput} value={match} onChange={(e) => setMatch(e.target.value as "all" | "any")}>
              <option value="all">{t("matchAll")}</option>
              <option value="any">{t("matchAny")}</option>
            </select>
          </label>
          <ol className="grid gap-2">
            {drafts.map((draft, index) => (
              <li key={draft.key} className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap">
                <select aria-label={t("field")} className={`${smallInput} sm:w-40`} value={draft.field} onChange={(e) => changeField(draft.key, e.target.value as Field)}>
                  {fields.map((f) => (
                    <option key={f} value={f}>{tField(f)}</option>
                  ))}
                </select>
                <select aria-label={t("operator")} className={`${smallInput} sm:w-44`} value={draft.op} onChange={(e) => update(draft.key, { op: e.target.value })}>
                  {operators[draft.field].map((op) => (
                    <option key={op} value={op}>{tOp(op)}</option>
                  ))}
                </select>
                {valueControl(draft, index)}
                <button
                  type="button"
                  onClick={() => setDrafts((list) => list.filter((d) => d.key !== draft.key))}
                  disabled={drafts.length === 1}
                  aria-label={t("removeCondition", { number: index + 1 })}
                  className="rounded px-2 py-1 text-text-subtle hover:bg-surface-muted disabled:opacity-30"
                >
                  ✕
                </button>
              </li>
            ))}
          </ol>
          {submitted && !complete && <span className="text-[10px] text-[#d9534f]">{t("errors.condition")}</span>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setDrafts((list) => [...list, newDraft("lifecycleStage", defaultOwner)])}
              disabled={drafts.length >= 20}
              className="text-[11px] font-extrabold text-primary-hover hover:underline disabled:opacity-40"
            >
              ＋ {t("addCondition")}
            </button>
            <output className="text-[10px] font-semibold text-text-strong" aria-live="polite">
              {preview === null ? "" : t("preview", { count: preview })}
            </output>
          </div>
        </fieldset>

        <div className="mt-1.5 flex flex-col items-end justify-between gap-3 border-t border-[#efedf4] pt-4 sm:col-span-2 sm:flex-row sm:items-center">
          {segment ? (
            <button type="button" onClick={() => onDelete(segment)} className="text-[11px] font-extrabold text-[#c2413d] hover:underline">
              {t("delete")}
            </button>
          ) : (
            <span className="text-[10px] text-text-subtle">{t("hint")}</span>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>{tCommon("cancel")}</Button>
            <Button type="submit" loading={saving}>{segment ? tCommon("save") : t("create")}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
