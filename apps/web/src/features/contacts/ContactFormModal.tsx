"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import type { Contact, LifecycleStage } from "@lulu/shared";
import { Button, Modal, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { contactFormSchema, findCompanyByName, toContactInput, toFormValues, type ContactFormValues } from "./contactForm";
import { knownSources, lifecycleStages } from "./options";
import type { Lookups } from "./useLookups";

const inputClass =
  "w-full rounded-md border border-border-strong bg-surface px-[11px] py-2.5 text-[11px] text-text outline-none focus:border-[#8e83de] focus:shadow-[0_0_0_3px_#eeecff] aria-[invalid=true]:border-[#d9534f]";

// Add when `contact` is null, edit otherwise. `initialStage` presets the stage of a new contact
// (the Leads board passes the column it was opened from).
export function ContactFormModal({
  open,
  contact,
  lookups,
  initialStage,
  onClose,
  onSaved,
}: {
  open: boolean;
  contact: Contact | null;
  lookups: Lookups;
  initialStage?: LifecycleStage;
  onClose: () => void;
  onSaved: (contact: Contact) => void;
}) {
  const t = useTranslations("contacts.form");
  const tCommon = useTranslations("common");
  const tStage = useTranslations("lifecycleStages");
  const tSource = useTranslations("sources");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const defaultOwner = lookups.me?.id ?? "";
  const startValues = () => {
    const values = toFormValues(contact, defaultOwner, lookups.companyName(contact?.companyId ?? null) ?? "");
    return !contact && initialStage ? { ...values, lifecycleStage: initialStage } : values;
  };

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: startValues(),
  });

  useEffect(() => {
    if (open) reset(startValues());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contact, defaultOwner, initialStage, reset]);

  // The company names load after the form opens: fill in the contact's company if the field is still empty.
  const loadedName = lookups.companyName(contact?.companyId ?? null);
  useEffect(() => {
    if (open && loadedName && getValues("companyName") === "") setValue("companyName", loadedName);
  }, [open, loadedName, getValues, setValue]);

  // A typed name picks the existing company with that name, or creates a new one.
  const resolveCompany = async (name: string, ownerId: string): Promise<string | null> => {
    if (name.trim() === "") return null;
    const existing = findCompanyByName(lookups.companies, name);
    if (existing) return existing.id;
    const created = await api.companies.create({ name: name.trim(), ...(ownerId ? { ownerId } : {}) });
    return created.id;
  };

  const onSubmit = async (values: ContactFormValues) => {
    try {
      const input = toContactInput(values, await resolveCompany(values.companyName, values.ownerId));
      const saved = contact ? await api.contacts.update(contact.id, input) : await api.contacts.create(input);
      toast(contact ? t("updated") : t("created"));
      onSaved(saved);
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };

  const fieldError = (name: keyof ContactFormValues) => {
    const message = errors[name]?.message;
    return message ? (
      <span id={`${name}-error`} className="text-[10px] text-[#d9534f]">
        {t(`errors.${message}`)}
      </span>
    ) : null;
  };

  const field = (name: keyof ContactFormValues, label: React.ReactNode, input: React.ReactNode, wide = false) => (
    <div className={`grid content-start gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <label htmlFor={`contact-${name}`} className="text-[10px] font-extrabold text-neutral">
        {label}
      </label>
      {input}
      {fieldError(name)}
    </div>
  );

  // id, error state and error link for each input.
  const aria = (name: keyof ContactFormValues) => ({
    id: `contact-${name}`,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  const req = <span className="text-[#c2413d]" aria-hidden> *</span>;

  return (
    <Modal open={open} onClose={onClose} eyebrow={contact ? t("editEyebrow") : t("eyebrow")} title={contact ? t("editTitle") : t("addTitle")}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-3.5 sm:grid-cols-2">
        {field("name", <>{t("name")}{req}</>, <input className={inputClass} autoComplete="off" placeholder={t("namePlaceholder")} aria-required {...register("name")} {...aria("name")} />)}
        {field("email", t("email"), <input type="email" className={inputClass} placeholder={t("emailPlaceholder")} {...register("email")} {...aria("email")} />)}
        {field("phone", t("phone"), <input type="tel" className={inputClass} placeholder={t("phonePlaceholder")} {...register("phone")} {...aria("phone")} />)}
        {field(
          "companyName",
          t("company"),
          <>
            <input
              className={inputClass}
              list="contact-companies"
              autoComplete="off"
              placeholder={t("companyPlaceholder")}
              {...register("companyName")}
              {...aria("companyName")}
            />
            <datalist id="contact-companies">
              {lookups.companies.map((company) => (
                <option key={company.id} value={company.name} />
              ))}
            </datalist>
            <small className="text-[9px] text-text-subtle">{t("companyHint")}</small>
          </>,
        )}
        {field("jobRole", t("jobRole"), <input className={inputClass} placeholder={t("jobRolePlaceholder")} {...register("jobRole")} {...aria("jobRole")} />)}
        {field(
          "source",
          t("source"),
          <select className={inputClass} {...register("source")} {...aria("source")}>
            <option value="">{t("noSource")}</option>
            {knownSources.map((source) => (
              <option key={source} value={source}>
                {tSource(source)}
              </option>
            ))}
            {contact?.source && !(knownSources as readonly string[]).includes(contact.source) && (
              <option value={contact.source}>{contact.source}</option>
            )}
          </select>,
        )}
        {field(
          "lifecycleStage",
          t("stage"),
          <select className={inputClass} {...register("lifecycleStage")} {...aria("lifecycleStage")}>
            {lifecycleStages.map((stage) => (
              <option key={stage} value={stage}>
                {tStage(stage)}
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
        {field("tags", t("tags"), <input className={inputClass} placeholder={t("tagsHint")} {...register("tags")} {...aria("tags")} />, true)}

        <div className="mt-1.5 flex flex-col items-end justify-between gap-3 border-t border-[#efedf4] pt-4 sm:col-span-2 sm:flex-row sm:items-center">
          <span className="text-[10px] text-text-subtle">{t("requiredHint")}</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {contact ? tCommon("save") : t("submit")}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
