import { z } from "zod";
import { baseRecordSchema, idSchema, listQuerySchema, timestampSchema } from "./common.js";
import { recordTypeSchema } from "./record.js";

export const taskPrioritySchema = z.enum(["high", "normal", "low"]);

export const taskSchema = baseRecordSchema.extend({
  title: z.string().trim().min(1),
  // A due date picked without a time is stored at 12:00 UTC, so it stays on the same calendar day in every time zone we serve.
  dueAt: timestampSchema.nullable(),
  priority: taskPrioritySchema,
  ownerId: idSchema,
  done: z.boolean(),
  doneAt: timestampSchema.nullable(),
  recordType: recordTypeSchema.nullable(),
  recordId: idSchema.nullable(),
});

// POST /tasks. Owner defaults to the current user, priority to "normal".
export const taskCreateSchema = z
  .object({
    title: taskSchema.shape.title,
    dueAt: timestampSchema.nullable().optional(),
    priority: taskPrioritySchema.optional(),
    ownerId: idSchema.optional(),
    recordType: recordTypeSchema.nullable().optional(),
    recordId: idSchema.nullable().optional(),
  })
  .refine((task) => (task.recordType == null) === (task.recordId == null), {
    message: "RECORD_LINK_INCOMPLETE",
    path: ["recordId"],
  });

// PATCH /tasks/:id. Setting `done` lets the server set doneAt and log the activity.
export const taskUpdateSchema = z.object({
  title: taskSchema.shape.title.optional(),
  dueAt: timestampSchema.nullable().optional(),
  priority: taskPrioritySchema.optional(),
  ownerId: idSchema.optional(),
  done: z.boolean().optional(),
});

// GET /tasks. Query strings arrive as text, so "true"/"false" are read explicitly.
const booleanParam = z.enum(["true", "false"]).transform((value) => value === "true");

export const taskListQuerySchema = listQuerySchema.extend({
  ownerId: idSchema.optional(),
  done: booleanParam.optional(),
  dueBefore: timestampSchema.optional(),
  recordType: recordTypeSchema.optional(),
  recordId: idSchema.optional(),
});

export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type Task = z.infer<typeof taskSchema>;
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
export type TaskListQuery = z.infer<typeof taskListQuerySchema>;
