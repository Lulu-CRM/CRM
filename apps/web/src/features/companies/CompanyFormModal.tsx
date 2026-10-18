"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { companySizes, type Company, type CompanyListItem } from "@lulu/shared";
import { Button, Modal, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import type { Lookups } from "@/features/contacts/useLookups";
import { companyFormSchema, toCompanyInput, toFormValues, type CompanyFormValues } from "./companyForm";

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
  const defaultOwner = lookups.me?.id ?? "";

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: toFormValues(company, defaultOwner),
  });

  useEffect(() => {
    if (open) reset(toFormValues(company, defaultOwner));
  }, [open, company, defaultOwner, reset]);

  const onSubmit = async (values: CompanyFormValues) => {
    try {
      const input = toCompanyInput(values);
      const saved = company ? await api.companies.update(company.id, input) : await api.companies.create(input);
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
