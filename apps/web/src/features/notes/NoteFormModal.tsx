"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import type { Company, Contact, Deal, Note, NoteCreateInput } from "@lulu/shared";
import { Button, Modal } from "@/components/ui";
import { noteFormSchema, toFormValues, toNoteInput, type NoteFormValues } from "./noteForm";

const inputClass =
  "w-full rounded-md border border-border-strong bg-surface px-[11px] py-2.5 text-[11px] text-text outline-none focus:border-[#8e83de] focus:shadow-[0_0_0_3px_#eeecff] aria-[invalid=true]:border-[#d9534f]";

const visibilities = ["shared", "private"] as const;

// New note when `note` is null, edit otherwise.
export function NoteFormModal({
  open,
  note,
  contacts,
  companies,
  deals,
  onClose,
  onSubmit,
  onDelete,
  related = "",
}: {
  open: boolean;
  note: Note | null;
  contacts: Contact[];
  companies: Company[];
  deals: Deal[];
  onClose: () => void;
  onSubmit: (input: NoteCreateInput) => Promise<void>;
  onDelete: () => void;
  // Pre-links a new note to a record ("contact:<id>" or "company:<id>").
  related?: string;
}) {
  const t = useTranslations("notes.form");
  const tVisibility = useTranslations("notes.visibility");
  const tCommon = useTranslations("common");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NoteFormValues>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: toFormValues(note, related),
  });

  useEffect(() => {
    if (open) reset(toFormValues(note, related));
  }, [open, note, related, reset]);

  const field = (name: keyof NoteFormValues, label: React.ReactNode, input: React.ReactNode, wide = false) => {
    const message = errors[name]?.message;
    return (
      <div className={`grid content-start gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
        <label htmlFor={`note-${name}`} className="text-[10px] font-extrabold text-neutral">
          {label}
        </label>
        {input}
        {message && (
          <span id={`note-${name}-error`} className="text-[10px] text-[#d9534f]">
            {t(`errors.${message}`)}
          </span>
        )}
      </div>
    );
  };

  const aria = (name: keyof NoteFormValues) => ({
    id: `note-${name}`,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `note-${name}-error` : undefined,
  });

  const companyName = (id: string | null) => companies.find((c) => c.id === id)?.name;
  const req = <span className="text-[#c2413d]" aria-hidden> *</span>;

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={note ? t("editEyebrow") : t("newEyebrow")}
      title={note ? t("editTitle") : t("newTitle")}
    >
      <form
        onSubmit={handleSubmit((values) => onSubmit(toNoteInput(values)))}
        noValidate
        className="grid gap-3.5 sm:grid-cols-2"
      >
        {field(
          "title",
          <>{t("title")}{req}</>,
          <input className={inputClass} autoComplete="off" placeholder={t("titlePlaceholder")} aria-required {...register("title")} {...aria("title")} />,
          true,
        )}
        {field(
          "body",
          t("body"),
          <textarea rows={6} className={inputClass} placeholder={t("bodyPlaceholder")} {...register("body")} {...aria("body")} />,
          true,
        )}
        {field(
          "visibility",
          t("visibility"),
          <select className={inputClass} {...register("visibility")} {...aria("visibility")}>
            {visibilities.map((v) => (
              <option key={v} value={v}>
                {tVisibility(v)}
              </option>
            ))}
          </select>,
        )}
        {field(
          "related",
          t("related"),
          <select className={inputClass} {...register("related")} {...aria("related")}>
            <option value="">{t("none")}</option>
            <optgroup label={t("contacts")}>
              {contacts.map((c) => (
                <option key={c.id} value={`contact:${c.id}`}>
                  {[c.name, companyName(c.companyId)].filter(Boolean).join(" · ")}
                </option>
              ))}
            </optgroup>
            <optgroup label={t("companies")}>
              {companies.map((c) => (
                <option key={c.id} value={`company:${c.id}`}>
                  {c.name}
                </option>
              ))}
            </optgroup>
            <optgroup label={t("deals")}>
              {deals.map((d) => (
                <option key={d.id} value={`deal:${d.id}`}>
                  {d.name}
                </option>
              ))}
            </optgroup>
          </select>,
        )}

        <div className="mt-1.5 flex flex-col items-end justify-between gap-3 border-t border-[#efedf4] pt-4 sm:col-span-2 sm:flex-row sm:items-center">
          {note ? (
            <Button variant="ghost" onClick={onDelete} disabled={isSubmitting} className="text-[#c2413d]">
              {t("delete")}
            </Button>
          ) : (
            <span className="text-[10px] text-text-subtle">{t("hint")}</span>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {note ? tCommon("save") : t("create")}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
