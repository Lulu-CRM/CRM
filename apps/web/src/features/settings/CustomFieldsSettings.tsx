"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { customFieldTypeSchema, fieldKeyFromLabel, type CustomField, type CustomFieldType } from "@lulu/shared";
import { Button, ConfirmDialog, EmptyState, Modal, Pill, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { useApi } from "@/lib/useApi";
import { SettingsScreen, settingsInput, useCanEditSettings } from "./SettingsScreen";

export function CustomFieldsSettings() {
  const t = useTranslations("settings.fields");
  const tType = useTranslations("settings.fields.types");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const canEdit = useCanEditSettings();
  const fields = useApi(() => api.settings.customFields.list(), []);
  const [form, setForm] = useState<{ field: CustomField | null } | null>(null);
  const [toDelete, setToDelete] = useState<CustomField | null>(null);
  const [deleting, setDeleting] = useState(false);

  const list = fields.data?.data ?? [];

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.settings.customFields.remove(toDelete.id);
      toast(t("deleted"));
      setToDelete(null);
      fields.reload();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsScreen section="fields" loading={fields.loading && !fields.data} error={fields.error} onRetry={fields.reload} canEdit={canEdit}>
      <div className="flex justify-end">
        <Button icon="＋" disabled={!canEdit} onClick={() => setForm({ field: null })}>{t("add")}</Button>
      </div>
      {list.length === 0 ? (
        <EmptyState title={t("empty")} description={t("emptyHint")} />
      ) : (
        <ul className="mt-3">
          {list.map((field) => (
            <li key={field.id} className="flex items-center gap-3 border-t border-surface-muted py-3">
              <span className="min-w-0 flex-1">
                <strong className="block text-[11px] text-text-strong">{field.label}</strong>
                <small className="block text-[9px] text-text-subtle">
                  {field.key}
                  {field.options.length > 0 && ` · ${field.options.join(", ")}`}
                </small>
              </span>
              <Pill>{tType(field.type)}</Pill>
              {canEdit && (
                <>
                  <Button variant="ghost" onClick={() => setForm({ field })} aria-label={t("editLabel", { label: field.label })}>✎</Button>
                  <Button variant="ghost" onClick={() => setToDelete(field)} aria-label={t("deleteLabel", { label: field.label })}>✕</Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <FieldModal
        open={form !== null}
        field={form?.field ?? null}
        takenKeys={list.map((f) => f.key)}
        onClose={() => setForm(null)}
        onSaved={() => {
          setForm(null);
          fields.reload();
        }}
      />
      <ConfirmDialog
        open={toDelete !== null}
        title={toDelete ? t("deleteTitle", { label: toDelete.label }) : ""}
        message={t("deleteBody")}
        confirmLabel={tCommon("delete")}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </SettingsScreen>
  );
}

function FieldModal({
  open,
  field,
  takenKeys,
  onClose,
  onSaved,
}: {
  open: boolean;
  field: CustomField | null;
  takenKeys: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("settings.fields");
  const tType = useTranslations("settings.fields.types");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const id = useId();
  const [label, setLabel] = useState("");
  const [type, setType] = useState<CustomFieldType>("text");
  const [options, setOptions] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLabel(field?.label ?? "");
    setType(field?.type ?? "text");
    setOptions(field?.options.join("\n") ?? "");
    setSubmitted(false);
  }, [open, field]);

  const optionList = [...new Set(options.split(/\n|,/).map((o) => o.trim()).filter(Boolean))];
  const labelMissing = label.trim() === "";
  const optionsMissing = type === "select" && optionList.length === 0;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (labelMissing || optionsMissing) return;
    setSaving(true);
    try {
      const opts = type === "select" ? optionList : [];
      if (field) await api.settings.customFields.update(field.id, { label: label.trim(), options: opts });
      else await api.settings.customFields.create({ key: fieldKeyFromLabel(label, takenKeys), label: label.trim(), type, options: opts });
      toast(field ? t("saved") : t("created"));
      onSaved();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} eyebrow={t("eyebrow")} title={field ? t("editTitle") : t("addTitle")}>
      <form onSubmit={save} noValidate className="grid gap-3.5">
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-label`} className="text-[10px] font-extrabold text-neutral">{t("label")}</label>
          <input id={`${id}-label`} className={settingsInput} value={label} placeholder={t("labelPlaceholder")} onChange={(e) => setLabel(e.target.value)} aria-invalid={submitted && labelMissing ? true : undefined} />
          {submitted && labelMissing && <span className="text-[10px] text-[#d9534f]">{t("errors.label")}</span>}
        </div>
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-type`} className="text-[10px] font-extrabold text-neutral">{t("type")}</label>
          {/* The type stays as created, so values already stored keep their meaning. */}
          <select id={`${id}-type`} className={settingsInput} value={type} disabled={field !== null} onChange={(e) => setType(e.target.value as CustomFieldType)}>
            {customFieldTypeSchema.options.map((option) => (
              <option key={option} value={option}>{tType(option)}</option>
            ))}
          </select>
        </div>
        {type === "select" && (
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-options`} className="text-[10px] font-extrabold text-neutral">{t("options")}</label>
            <textarea id={`${id}-options`} rows={4} className={settingsInput} value={options} placeholder={t("optionsPlaceholder")} onChange={(e) => setOptions(e.target.value)} aria-invalid={submitted && optionsMissing ? true : undefined} />
            {submitted && optionsMissing && <span className="text-[10px] text-[#d9534f]">{t("errors.options")}</span>}
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-[#efedf4] pt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>{tCommon("cancel")}</Button>
          <Button type="submit" loading={saving}>{field ? tCommon("save") : t("add")}</Button>
        </div>
      </form>
    </Modal>
  );
}
