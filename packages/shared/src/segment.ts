import { z } from "zod";
import { baseRecordSchema, idSchema, listQuerySchema } from "./common";
import { lifecycleStageSchema } from "./contact";

// One condition of a segment rule. Each field has its own operators, so a rule can never be half valid.
export const segmentConditionSchema = z.union([
  z.object({ field: z.literal("lifecycleStage"), op: z.enum(["is", "is_not"]), value: lifecycleStageSchema }),
  z.object({ field: z.literal("ownerId"), op: z.enum(["is", "is_not"]), value: idSchema }),
  z.object({ field: z.literal("tag"), op: z.enum(["has", "has_not"]), value: z.string().trim().min(1) }),
  z.object({ field: z.literal("marketingConsent"), op: z.literal("is"), value: z.boolean() }),
  // Last touch: within the last N days, more than N days ago, or never touched.
  z.object({ field: z.literal("lastTouch"), op: z.enum(["within_days", "older_than_days"]), value: z.number().int().min(1).max(3650) }),
  z.object({ field: z.literal("lastTouch"), op: z.literal("never") }),
  // An open task linked to the contact is due today or earlier.
  z.object({ field: z.literal("followUp"), op: z.literal("due") }),
  // The contact is on at least one open deal, or on none.
  z.object({ field: z.literal("openDeal"), op: z.enum(["exists", "none"]) }),
]);

export const segmentRulesSchema = z.object({
  match: z.enum(["all", "any"]),
  conditions: z.array(segmentConditionSchema).min(1).max(20),
});

export const segmentColorSchema = z.enum(["violet", "coral", "blue", "mint", "peach"]);

export const segmentSchema = baseRecordSchema.extend({
  name: z.string().trim().min(1),
  description: z.string().trim().nullable(),
  rules: segmentRulesSchema,
  color: segmentColorSchema,
});

// GET /segments returns each segment with its live member count.
export const segmentListItemSchema = segmentSchema.extend({
  memberCount: z.number().int().min(0),
});

// POST /segments
export const segmentCreateSchema = z.object({
  name: segmentSchema.shape.name,
  description: segmentSchema.shape.description.optional(),
  rules: segmentRulesSchema,
  color: segmentColorSchema.optional(),
});

// PATCH /segments/:id
export const segmentUpdateSchema = segmentCreateSchema.partial();

// GET /segments/:id/contacts
export const segmentContactsQuerySchema = listQuerySchema;

export type SegmentCondition = z.infer<typeof segmentConditionSchema>;
export type SegmentRules = z.infer<typeof segmentRulesSchema>;
export type SegmentColor = z.infer<typeof segmentColorSchema>;
export type Segment = z.infer<typeof segmentSchema>;
export type SegmentListItem = z.infer<typeof segmentListItemSchema>;
export type SegmentCreateInput = z.infer<typeof segmentCreateSchema>;
export type SegmentUpdateInput = z.infer<typeof segmentUpdateSchema>;
