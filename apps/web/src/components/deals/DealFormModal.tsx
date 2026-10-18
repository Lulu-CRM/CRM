"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  dealCreateSchema,
  dealUpdateSchema,
  type Company,
  type Contact,
  type Deal,
  type DealCreateInput,
  type DealUpdateInput,
  type Stage,
  type User,
} from "@lulu/shared";
import { Button, Modal } from "@/components/ui";
import { useErrorMessage } from "@/lib/errors";
import { useStageName } from "./stages";

export type DealFormMode = { kind: "create"; stageId: string } | { kind: "edit"; deal: Deal };

type Props = {
  mode: DealFormMode | null;
  stages: Stage[];
  users: User[];
  contacts: Contact[];
  companies: Company[];
  defaultCurrency: string;
  onClose: () => void;
  onCreate: (input: DealCreateInput) => Promise<unknown>;
  onUpdate: (id: string, input: DealUpdateInput) => Promise<unknown>;
};

// Currencies offered in the picker; names come from Intl in the user's language.
const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CNY"];

export function DealFormModal(props: Props) {
  const t = useTranslations("deals.form");
  const { mode, onClose } = props;

  return (
    <Modal
      open={mode !== null}
      onClose={onClose}
      eyebrow={mode?.kind === "edit" ? t("editEyebrow") : t("newEyebrow")}
      title={mode?.kind === "edit" ? t("editTitle") : t("newTitle")}
    >
      {/* Keyed so the fields start fresh for every deal. */}
      {mode && <DealForm key={mode.kind === "edit" ? mode.deal.id : `new-${mode.stageId}`} {...props} mode={mode} />}
    </Modal>
  );
}

type Fields = {
  name: string;
  companyId: string;
  contactId: string;
  value: string;
  currency: string;
  expectedClose: string;
  stageId: string;
  ownerId: string;
};

type FieldErrors = Partial<Record<keyof Fields, string>>;

function DealForm({
  mode,
  stages,
  users,
  contacts,
  companies,
  defaultCurrency,
  onClose,
  onCreate,
  onUpdate,
}: Props & { mode: DealFormMode }) {
  const t = useTranslations("deals.form");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const stageName = useStageName();
  const errorMessage = useErrorMessage();
  const id = useId();

  const deal = mode.kind === "edit" ? mode.deal : null;
  const [fields, setFields] = useState<Fields>({
    name: deal?.name ?? "",
    companyId: deal?.companyId ?? "",
    contactId: deal?.contactId ?? "",
    value: deal ? String(deal.value) : "",
    currency: deal?.currency ?? defaultCurrency,
    // Date-only values are stored at 12:00 UTC (docs/data-model.md), so the first 10 characters are the day.
    expectedClose: deal?.expectedCloseAt?.slice(0, 10) ?? "",
    stageId: mode.kind === "create" ? mode.stageId : mode.deal.stageId,
    ownerId: deal?.ownerId ?? users[0]?.id ?? "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof Fields) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFields((current) => ({ ...current, [key]: event.target.value }));

  const currencyName = (code: string) => {
    try {
      return new Intl.DisplayNames([locale], { type: "currency" }).of(code) ?? code;
    } catch {
      return code;
    }
  };
  const currencies = CURRENCIES.includes(fields.currency) ? CURRENCIES : [fields.currency, ...CURRENCIES];

  // With a company picked, only its people are offered (plus whoever is already linked).
  const contactOptions = contacts.filter(
    (c) => !fields.companyId || c.companyId === fields.companyId || c.id === fields.contactId,
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const shared = {
      name: fields.name,
      value: fields.value.trim() === "" ? Number.NaN : Number(fields.value),
      currency: fields.currency,
      expectedCloseAt: fields.expectedClose ? `${fields.expectedClose}T12:00:00.000Z` : null,
      companyId: fields.companyId || null,
      contactId: fields.contactId || null,
      ownerId: fields.ownerId || undefined,
    };
    const parsed =
      mode.kind === "create"
        ? dealCreateSchema.safeParse({ ...shared, stageId: fields.stageId })
        : dealUpdateSchema.safeParse(shared);

    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "name") next.name = t("errors.name");
        else if (key === "value") next.value = t("errors.value");
        else if (key === "expectedCloseAt") next.expectedClose = t("errors.date");
        else if (typeof key === "string" && key in fields) next[key as keyof Fields] = t("errors.invalid");
      }
      setErrors(next);
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      if (mode.kind === "create") await onCreate(parsed.data as DealCreateInput);
      else await onUpdate(mode.deal.id, parsed.data as DealUpdateInput);
      onClose();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const input =
    "w-full rounded-lg border border-border-strong bg-surface px-[11px] py-2.5 text-[10px] text-[#454252] outline-none focus:border-[#8e83de] focus:shadow-[0_0_0_3px_#eeecff] aria-[invalid=true]:border-[#d9534f]";
  const label = "mb-1.5 block text-[9px] font-extrabold text-neutral";

  const field = (key: keyof Fields, text: string, control: React.ReactNode, full = false) => (
    <div className={full ? "sm:col-span-2" : ""}>
      <label htmlFor={`${id}-${key}`} className={label}>
        {text}
      </label>
      {control}
      {errors[key] && (
        <p id={`${id}-${key}-error`} className="mt-1 text-[9px] text-[#c2413d]">
          {errors[key]}
        </p>
      )}
    </div>
  );

  const controlProps = (key: keyof Fields) => ({
    id: `${id}-${key}`,
    value: fields[key],
    onChange: set(key),
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${id}-${key}-error` : undefined,
    className: input,
  });

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid gap-3.5 sm:grid-cols-2">
        {field("name", t("name"), <input {...controlProps("name")} placeholder={t("namePlaceholder")} autoFocus />, true)}
        {field(
          "companyId",
          t("company"),
          <select {...controlProps("companyId")}>
            <option value="">{t("none")}</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>,
        )}
        {field(
          "contactId",
          t("contact"),
          <select {...controlProps("contactId")}>
            <option value="">{t("none")}</option>
            {contactOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>,
        )}
        {field("value", t("value"), <input {...controlProps("value")} type="number" min={0} step="any" inputMode="decimal" />)}
        {field(
          "currency",
          t("currency"),
          <select {...controlProps("currency")}>
            {currencies.map((code) => (
              <option key={code} value={code}>
                {code} · {currencyName(code)}
              </option>
            ))}
          </select>,
        )}
        {field("expectedClose", t("expectedClose"), <input {...controlProps("expectedClose")} type="date" />)}
        {mode.kind === "create" &&
          field(
            "stageId",
            t("stage"),
            <select {...controlProps("stageId")}>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {stageName(s)}
                </option>
              ))}
            </select>,
          )}
        {field(
          "ownerId",
          t("owner"),
          <select {...controlProps("ownerId")}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>,
        )}
      </div>

      {formError && (
        <p role="alert" className="mt-4 rounded-lg bg-[#ffe1e0] px-3 py-2 text-[10px] text-[#8a2f2c]">
          {formError}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[#efedf4] pt-4 text-[9px] text-[#9a97a8]">
        <span>{t("hint")}</span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" loading={saving}>
            {mode.kind === "create" ? t("create") : t("save")}
          </Button>
        </div>
      </div>
    </form>
  );
}
