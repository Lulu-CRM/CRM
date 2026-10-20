import { z } from "zod";
import { baseRecordSchema, idSchema, listQuerySchema, timestampSchema } from "./common";
import { recordTypeSchema } from "./record";

export const activityTypeSchema = z.enum([
  "email",
  "meeting",
  "task",
  "note",
  "ai_signal",
  "created",
  "stage_changed",
  // Events from the Marketplace module (POST /events).
  "marketplace",
]);

export const sourceModuleSchema = z.enum(["crm", "email", "calendar", "online_presence", "marketplace"]);

// Activities store facts, not sentences. The UI builds the line from `type` and `payload`
// through the translation files (activities.<type>), so the timeline reads in the user's language.
export const activitySchema = baseRecordSchema.extend({
  type: activityTypeSchema,
  recordType: recordTypeSchema.nullable(),
  recordId: idSchema.nullable(),
  occurredAt: timestampSchema,
  sourceModule: sourceModuleSchema,
  actorId: idSchema.nullable(),
  payload: z.record(z.string(), z.unknown()),
});

// POST /activities (logged by hand in the CRM).
export const activityCreateSchema = z.object({
  type: activityTypeSchema,
  recordType: recordTypeSchema,
  recordId: idSchema,
  occurredAt: timestampSchema.optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

// GET /activities
export const activityListQuerySchema = listQuerySchema.extend({
  recordType: recordTypeSchema.optional(),
  recordId: idSchema.optional(),
  type: activityTypeSchema.optional(),
});

// POST /events from other modules (format in docs/api.md).
export const moduleEventSchema = z.object({
  type: z.string().regex(/^(email|calendar|marketplace)\.[a-z_]+$/),
  sourceModule: sourceModuleSchema.exclude(["crm"]),
  occurredAt: timestampSchema,
  contact: z.object({ email: z.email() }),
  summary: z.string().trim().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export type ActivityType = z.infer<typeof activityTypeSchema>;
export type SourceModule = z.infer<typeof sourceModuleSchema>;
export type Activity = z.infer<typeof activitySchema>;
export type ActivityCreateInput = z.infer<typeof activityCreateSchema>;
export type ActivityListQuery = z.infer<typeof activityListQuerySchema>;
export type ModuleEvent = z.infer<typeof moduleEventSchema>;
