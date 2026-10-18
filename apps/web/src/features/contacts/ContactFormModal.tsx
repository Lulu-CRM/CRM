"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import type { Contact } from "@lulu/shared";
import { Button, Modal, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { contactFormSchema, toContactInput, toFormValues, type ContactFormValues } from "./contactForm";
import { knownSources, lifecycleStages } from "./options";
import type { Lookups } from "./useLookups";

const inputClass =
  "w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-xs text-text outline-none focus:border-primary aria-[invalid=true]:border-[#d9534f]";

// Add when `contact` is null, edit otherwise.
export function ContactFormModal({
  open,
  contact,
  lookups,
  onClose,
  onSaved,
}: {
  open: boolean;
  contact: Contact | null;
  lookups: Lookups;
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

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: toFormValues(contact, defaultOwner),
  });

  useEffect(() => {
    if (open) reset(toFormValues(contact, defaultOwner));
  }, [open, contact, defaultOwner, reset]);

  const onSubmit = async (values: ContactFormValues) => {
    try {
      const input = toContactInput(values);
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

  const field = (name: keyof ContactFormValues, label: string, input: React.ReactNode, wide = false) => (
    <div className={`grid gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <label htmlFor={`contact-${name}`} className="text-[10px] font-bold text-text-strong">
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={t("eyebrow")}
      title={contact ? t("editTitle") : t("addTitle")}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2">
        {field("name", t("name"), <input className={inputClass} autoComplete="off" {...register("name")} {...aria("name")} />, true)}
        {field("email", t("email"), <input type="email" className={inputClass} {...register("email")} {...aria("email")} />)}
        {field("phone", t("phone"), <input type="tel" className={inputClass} {...register("phone")} {...aria("phone")} />)}
        {field(
          "companyId",
          t("company"),
          <select className={inputClass} {...register("companyId")} {...aria("companyId")}>
            <option value="">{t("noCompany")}</option>
            {lookups.companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>,
        )}
        {field("jobRole", t("jobRole"), <input className={inputClass} {...register("jobRole")} {...aria("jobRole")} />)}
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
        {field("tags", t("tags"), <input className={inputClass} placeholder={t("tagsHint")} {...register("tags")} {...aria("tags")} />)}

        <div className="flex justify-end gap-2 border-t border-border pt-4 sm:col-span-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {contact ? tCommon("save") : t("addTitle")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
