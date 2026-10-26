"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { belongsTo, companySizes, type Company, type CompanyListItem } from "@lulu/shared";
import { Button, Modal, MultiPicker, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { DIAL_CODES, defaultCountry } from "@/lib/phone";
import { useApi } from "@/lib/useApi";
import type { Lookups } from "@/features/contacts/useLookups";
import { companyFormSchema, toCompanyInput, toFirstNote, toFormValues, type CompanyFormValues } from "./companyForm";

const inputClass =
  "w-full rounded-md border border-border-strong bg-surface px-[11px] py-2.5 text-[11px] text-text outline-none focus:border-[#8e83de] focus:shadow-[0_0_0_3px_#eeecff] aria-[invalid=true]:border-[#d9534f]";

// Add when `company` is null, edit otherwise. `industries` are the ones already in use, offered as suggestions.
export function CompanyFormModal({
  open,
  company,
  lookups,
  industries,
  onClose,
  onSaved,
}: {
  open: boolean;
  company: Company | null;
  lookups: Lookups;
  industries: string[];
  onClose: () => void;
  onSaved: (company: CompanyListItem) => void;
}) {
  const t = useTranslations("companies.form");
  const tCompanies = useTranslations("companies");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const locale = useLocale();
  const defaultOwner = lookups.me?.id ?? "";
  const country = useMemo(() => defaultCountry(typeof navigator === "undefined" ? undefined : navigator.language), []);

  // Contacts for the picker, and who belongs to this company now (edit).
  const contacts = useApi(() => (open ? api.contacts.list({ pageSize: 100 }) : Promise.resolve(null)), [open]);
  const contactList = useMemo(() => contacts.data?.data ?? [], [contacts.data]);
  const linkedIds = useMemo(
    () => (company ? contactList.filter((c) => belongsTo(c, company.id)).map((c) => c.id) : []),
    [company, contactList],
  );

  // Countries for the WhatsApp number, named in the user's language, sorted by name.
  const countries = useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: "region" });
    return Object.keys(DIAL_CODES)
      .map((code) => ({ code, name: names.of(code) ?? code, dial: DIAL_CODES[code]! }))
      .sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [locale]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: toFormValues(company, defaultOwner, country),
  });

  useEffect(() => {
    if (open) reset(toFormValues(company, defaultOwner, country));
  }, [open, company, defaultOwner, country, reset]);

  // The contacts list loads after the form opens: fill in who belongs here without touching the other
  // fields, which the user may already be typing in.
  useEffect(() => {
    if (open && company) setValue("contactIds", linkedIds);
  }, [open, company, linkedIds, setValue]);

  const onSubmit = async (values: CompanyFormValues) => {
    try {
      const input = toCompanyInput(values);
      const saved = company ? await api.companies.update(company.id, input) : await api.companies.create(input);
      // Link the picked people and unlink the ones taken out, in one request (they keep their other companies).
      const before = [...linkedIds].sort().join();
      if ([...values.contactIds].sort().join() !== before) {
        await api.companies.setContacts(saved.id, { contactIds: values.contactIds });
      }
      const note = company ? null : toFirstNote(values, saved.id);
      if (note) await api.notes.create(note);
      // The AI rewrites the company's AI notes in the background from the data just saved.
      void api.companies.aiNotes(saved.id).catch(() => {});
      toast(company ? t("updated") : t("created"));
      onSaved(saved);
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };

  const field = (name: keyof CompanyFormValues, label: React.ReactNode, input: React.ReactNode, wide = false) => {
    const message = errors[name]?.message;
    return (
      <div className={`grid content-start gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
        <label htmlFor={`company-${name}`} className="text-[10px] font-extrabold text-neutral">
          {label}
        </label>
        {input}
        {message && (
          <span id={`company-${name}-error`} className="text-[10px] text-[#d9534f]">
            {t(`errors.${message}`)}
          </span>
        )}
      </div>
    );
  };

  // id, error state and error link for each input.
  const aria = (name: keyof CompanyFormValues) => ({
    id: `company-${name}`,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `company-${name}-error` : undefined,
  });

  const req = <span className="text-[#c2413d]" aria-hidden> *</span>;

  return (
    <Modal open={open} onClose={onClose} eyebrow={company ? t("editEyebrow") : t("eyebrow")} title={company ? t("editTitle") : t("addTitle")}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-3.5 sm:grid-cols-2">
        {field("name", <>{t("name")}{req}</>, <input className={inputClass} autoComplete="off" placeholder={t("namePlaceholder")} aria-required {...register("name")} {...aria("name")} />, true)}
        {field("domain", t("domain"), <input className={inputClass} autoComplete="off" placeholder={t("domainPlaceholder")} {...register("domain")} {...aria("domain")} />)}
        {field(
          "industry",
          t("industry"),
          <>
            <input className={inputClass} list="company-industries" autoComplete="off" placeholder={t("industryPlaceholder")} {...register("industry")} {...aria("industry")} />
            <datalist id="company-industries">
              {industries.map((industry) => (
                <option key={industry} value={industry} />
              ))}
            </datalist>
          </>,
        )}
        {field(
          "size",
          t("size"),
          <select className={inputClass} {...register("size")} {...aria("size")}>
            <option value="">{t("noSize")}</option>
            {companySizes.map((size) => (
              <option key={size} value={size}>
                {tCompanies("sizeValue", { size })}
              </option>
            ))}
          </select>,
        )}
        {field(
          "ownerId",
          t("owner"),
          <select className={inputClass} {...register("ownerId")} {...aria("ownerId")}>
            {lookups.users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>,
        )}

        {field(
          "whatsappNumber",
          t("whatsapp"),
          <div className="flex gap-1.5">
            <select
              className={`${inputClass.replace("w-full ", "")} w-[45%] min-w-0 flex-none`}
              aria-label={t("whatsappCountry")}
              {...register("whatsappCountry")}
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {`${c.name} +${c.dial}`}
                </option>
              ))}
            </select>
            <input
              className={`${inputClass.replace("w-full ", "")} w-0 min-w-0 flex-1`}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder={t("whatsappPlaceholder")}
              {...register("whatsappNumber")}
              {...aria("whatsappNumber")}
            />
          </div>,
        )}
        {field("instagram", t("instagram"), <input className={inputClass} autoComplete="off" placeholder={t("instagramPlaceholder")} {...register("instagram")} {...aria("instagram")} />)}
        {field("facebook", t("facebook"), <input className={inputClass} autoComplete="off" placeholder={t("facebookPlaceholder")} {...register("facebook")} {...aria("facebook")} />)}
        {field("productService", t("productService"), <input className={inputClass} autoComplete="off" placeholder={t("productServicePlaceholder")} {...register("productService")} {...aria("productService")} />, true)}
        {!company &&
          field("note", t("note"), <textarea className={inputClass} rows={3} placeholder={t("notePlaceholder")} {...register("note")} {...aria("note")} />, true)}
        {field(
          "contactIds",
          t("contacts"),
          <MultiPicker
            id="company-contactIds"
            items={contactList.map((c) => ({
              id: c.id,
              name: c.name,
              searchText: c.email,
              hint: c.companyId && c.companyId !== company?.id ? lookups.companyName(c.companyId) : undefined,
            }))}
            value={watch("contactIds")}
            onChange={(ids) => setValue("contactIds", ids, { shouldDirty: true })}
            labels={{
              list: t("contacts"),
              none: t("contactsNone"),
              count: (count) => t("contactsCount", { count }),
              search: t("contactsSearch"),
              empty: t("contactsEmpty"),
            }}
          />,
          true,
        )}
        <p className="text-[10px] text-text-subtle sm:col-span-2">{t("aiNotesHint")}</p>

        <div className="mt-1.5 flex flex-col items-end justify-between gap-3 border-t border-[#efedf4] pt-4 sm:col-span-2 sm:flex-row sm:items-center">
          <span className="text-[10px] text-text-subtle">{t("requiredHint")}</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {company ? tCommon("save") : t("submit")}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
