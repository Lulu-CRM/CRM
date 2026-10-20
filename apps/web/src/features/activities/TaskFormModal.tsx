"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import type { Company, Contact, Deal, Task, TaskCreateInput, User } from "@lulu/shared";
import { Button, Modal } from "@/components/ui";
import { taskFormSchema, toFormValues, toTaskInput, type TaskFormValues } from "./taskForm";

const inputClass =
  "w-full rounded-md border border-border-strong bg-surface px-[11px] py-2.5 text-[11px] text-text outline-none focus:border-[#8e83de] focus:shadow-[0_0_0_3px_#eeecff] aria-[invalid=true]:border-[#d9534f] disabled:bg-surface-muted";

const priorities = ["high", "normal", "low"] as const;

// New task when `task` is null, edit otherwise.
export function TaskFormModal({
  open,
  task,
  users,
  contacts,
  companies,
  deals,
  defaultOwnerId,
  onClose,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  task: Task | null;
  users: User[];
  contacts: Contact[];
  companies: Company[];
  deals: Deal[];
  defaultOwnerId: string;
  onClose: () => void;
  onSubmit: (input: TaskCreateInput) => Promise<void>;
  onDelete: () => void;
}) {
  const t = useTranslations("tasks.form");
  const tPriority = useTranslations("tasks.priority");
  const tCommon = useTranslations("common");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: toFormValues(task, defaultOwnerId),
  });

  useEffect(() => {
    if (open) reset(toFormValues(task, defaultOwnerId));
  }, [open, task, defaultOwnerId, reset]);

  const fieldError = (name: keyof TaskFormValues) => {
    const message = errors[name]?.message;
    return message ? (
      <span id={`task-${name}-error`} className="text-[10px] text-[#d9534f]">
        {t(`errors.${message}`)}
      </span>
    ) : null;
  };

  const aria = (name: keyof TaskFormValues) => ({
    id: `task-${name}`,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `task-${name}-error` : undefined,
  });

  const field = (name: keyof TaskFormValues, label: React.ReactNode, input: React.ReactNode, wide = false) => (
    <div className={`grid content-start gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <label htmlFor={`task-${name}`} className="text-[10px] font-extrabold text-neutral">
        {label}
      </label>
      {input}
      {fieldError(name)}
    </div>
  );

  const companyName = (id: string | null) => companies.find((c) => c.id === id)?.name;
  const req = <span className="text-[#c2413d]" aria-hidden> *</span>;

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={task ? t("editEyebrow") : t("newEyebrow")}
      title={task ? t("editTitle") : t("newTitle")}
    >
      <form
        onSubmit={handleSubmit((values) => onSubmit(toTaskInput(values)))}
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
          "related",
          t("related"),
          // The link is set when the task is created; PATCH /tasks/:id does not change it.
          <select className={inputClass} disabled={task !== null} {...register("related")} {...aria("related")}>
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
        {field("due", t("due"), <input type="date" className={inputClass} {...register("due")} {...aria("due")} />)}
        {field(
          "ownerId",
          t("owner"),
          <select className={inputClass} {...register("ownerId")} {...aria("ownerId")}>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>,
        )}
        {field(
          "priority",
          t("priority"),
          <select className={inputClass} {...register("priority")} {...aria("priority")}>
            {priorities.map((p) => (
              <option key={p} value={p}>
                {tPriority(p)}
              </option>
            ))}
          </select>,
        )}

        <div className="mt-1.5 flex flex-col items-end justify-between gap-3 border-t border-[#efedf4] pt-4 sm:col-span-2 sm:flex-row sm:items-center">
          {task ? (
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
              {task ? tCommon("save") : t("create")}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
