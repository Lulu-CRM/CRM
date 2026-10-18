import { z } from "zod";
import { taskPrioritySchema, type RecordType, type Task, type TaskCreateInput, type TaskPriority } from "@lulu/shared";

// The form works with plain strings. Messages are translation keys under tasks.form.errors.
export const taskFormSchema = z.object({
  title: z.string().trim().min(1, "titleRequired"),
  // "" for no link, otherwise "<recordType>:<recordId>", for example "contact:contact_sophie".
  // Missing when editing: the field is disabled then, and disabled fields are left out of the values.
  related: z.string().optional(),
  // yyyy-mm-dd from the date input, or "".
  due: z.string(),
  ownerId: z.string().min(1, "ownerRequired"),
  priority: taskPrioritySchema,
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

export function toFormValues(task: Task | null, defaultOwnerId: string): TaskFormValues {
  return {
    title: task?.title ?? "",
    related: task?.recordType && task.recordId ? `${task.recordType}:${task.recordId}` : "",
    // Date-only due dates are stored at 12:00 UTC (docs/data-model.md), so the first 10 characters are the day.
    due: task?.dueAt?.slice(0, 10) ?? "",
    ownerId: task?.ownerId ?? defaultOwnerId,
    priority: (task?.priority ?? "normal") as TaskPriority,
  };
}

export function toTaskInput(values: TaskFormValues): TaskCreateInput {
  const [recordType, recordId] = values.related ? values.related.split(":", 2) : [null, null];
  return {
    title: values.title.trim(),
    dueAt: values.due ? `${values.due}T12:00:00.000Z` : null,
    ownerId: values.ownerId,
    priority: values.priority,
    recordType: (recordType as RecordType | null) ?? null,
    recordId: recordId ?? null,
  };
}
