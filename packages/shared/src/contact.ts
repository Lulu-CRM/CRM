import { z } from "zod";
import { baseRecordSchema, idSchema, listQuerySchema, timestampSchema } from "./common";

// See docs/data-model.md, "Enums". The UI translates these keys (lifecycleStages.<key>).
export const lifecycleStageSchema = z.enum(["new", "qualified", "follow_up", "customer"]);

// Known sources are translated (sources.<key>). Workspaces can add their own, shown as typed.
export const contactSourceSchema = z.string().trim().min(1);

export const contactSchema = baseRecordSchema.extend({
  name: z.string().trim().min(1),
  email: z.email().nullable(),
  phone: z.string().trim().min(1).nullable(),
  companyId: idSchema.nullable(),
  jobRole: z.string().trim().min(1).nullable(),
  source: contactSourceSchema.nullable(),
  lifecycleStage: lifecycleStageSchema,
  ownerId: idSchema,
  tags: z.array(z.string().trim().min(1)),
  marketingConsent: z.boolean(),
  consentUpdatedAt: timestampSchema.nullable(),
  lastTouchAt: timestampSchema.nullable(),
});

// POST /contacts. The owner defaults to the current user, the stage to "new".
export const contactCreateSchema = z.object({
  name: contactSchema.shape.name,
  email: contactSchema.shape.email.optional(),
  phone: contactSchema.shape.phone.optional(),
  companyId: idSchema.nullable().optional(),
  jobRole: contactSchema.shape.jobRole.optional(),
  source: contactSchema.shape.source.optional(),
  lifecycleStage: lifecycleStageSchema.optional(),
  ownerId: idSchema.optional(),
  tags: contactSchema.shape.tags.optional(),
  marketingConsent: z.boolean().optional(),
});

// PATCH /contacts/:id
export const contactUpdateSchema = contactCreateSchema.partial();

// GET /contacts
export const contactListQuerySchema = listQuerySchema.extend({
  stage: lifecycleStageSchema.optional(),
  ownerId: idSchema.optional(),
  companyId: idSchema.optional(),
  tag: z.string().min(1).optional(),
  needsFollowUp: z.stringbool().optional(),
  createdSince: timestampSchema.optional(),
  segmentId: idSchema.optional(),
});

export type LifecycleStage = z.infer<typeof lifecycleStageSchema>;
export type Contact = z.infer<typeof contactSchema>;
export type ContactCreateInput = z.infer<typeof contactCreateSchema>;
export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>;
export type ContactListQuery = z.infer<typeof contactListQuerySchema>;
