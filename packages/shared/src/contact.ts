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
  // The person's main company (deals and imports use it). `companyIds` is every company the person
  // belongs to, main one first: one person can own several businesses (Dave, Oct 24, 2026).
  companyId: idSchema.nullable(),
  companyIds: z.array(idSchema),
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

/**
 * The contact's company links after its main company is replaced by `companyId` (PATCH /contacts/:id).
 * The new main company goes first; clearing it drops the old main company and promotes the next one.
 */
export function withMainCompany(
  current: Pick<Contact, "companyId" | "companyIds">,
  companyId: string | null,
): Pick<Contact, "companyId" | "companyIds"> {
  const others = current.companyIds.filter((id) => id !== companyId && id !== current.companyId);
  if (companyId !== null) return { companyId, companyIds: [companyId, ...others] };
  return { companyId: others[0] ?? null, companyIds: others };
}

/** The contact's company links after it is linked to, or unlinked from, one company (PUT /companies/:id/contacts). */
export function withCompanyLink(
  current: Pick<Contact, "companyId" | "companyIds">,
  companyId: string,
  linked: boolean,
): Pick<Contact, "companyId" | "companyIds"> {
  const ids = current.companyIds.filter((id) => id !== companyId);
  if (linked) {
    const companyIds = current.companyId === null ? [companyId, ...ids] : [...ids, companyId];
    return { companyId: companyIds[0]!, companyIds };
  }
  return { companyId: ids[0] ?? null, companyIds: ids };
}

/** Whether the person belongs to the company (as their main company or another one). */
export const belongsTo = (contact: Pick<Contact, "companyId" | "companyIds">, companyId: string) =>
  contact.companyId === companyId || contact.companyIds.includes(companyId);

export type LifecycleStage = z.infer<typeof lifecycleStageSchema>;
export type Contact = z.infer<typeof contactSchema>;
export type ContactCreateInput = z.infer<typeof contactCreateSchema>;
export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>;
export type ContactListQuery = z.infer<typeof contactListQuerySchema>;
