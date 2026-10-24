import { z } from "zod";
import { baseRecordSchema, idSchema, listQuerySchema, moneySchema, timestampSchema } from "./common";
import { aiTextSchema } from "./ai";
import { contactSchema, lifecycleStageSchema } from "./contact";
import { dealSchema } from "./deal";

// Head-count bands from the design. They are numbers, so the UI shows them as they are.
export const companySizes = ["1-10", "11-50", "51-200", "201+"] as const;
export const companySizeSchema = z.enum(companySizes);

// How the account is doing, computed by the server (see companyHealth in company-logic.ts).
export const companyHealthSchema = z.enum(["strong", "watch", "new"]);

export const companySchema = baseRecordSchema.extend({
  name: z.string().trim().min(1),
  // A bare host name such as "northstar.studio": no scheme, path or spaces.
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/)
    .nullable(),
  industry: z.string().trim().min(1).nullable(),
  size: companySizeSchema.nullable(),
  ownerId: idSchema,
  // Added at Dave's request (Oct 23, 2026). Lead status uses the contact lifecycle stages.
  leadStatus: lifecycleStageSchema.nullable(),
  whatsapp: z.string().trim().min(1).max(40).nullable(),
  // A handle (@name) or a profile link, as typed.
  instagram: z.string().trim().min(1).max(200).nullable(),
  facebook: z.string().trim().min(1).max(200).nullable(),
  productService: z.string().trim().min(1).max(200).nullable(),
  // Written by the AI from everything the CRM holds about the account (Dave, Oct 24, 2026), one line
  // per point; never typed by people. POST /companies/:id/ai-notes writes a new version.
  aiNotes: z.array(aiTextSchema).nullable(),
  aiNotesUpdatedAt: timestampSchema.nullable(),
});

// GET /companies returns each company with numbers computed from its contacts and deals.
export const companyListItemSchema = companySchema.extend({
  contactCount: z.number().int().min(0),
  // Open deals in the workspace currency. Deals in another currency are counted in otherCurrencyDeals.
  openDealValue: moneySchema,
  openDealCount: z.number().int().min(0),
  otherCurrencyDeals: z.number().int().min(0),
  // Most recent lastTouchAt among the company's contacts.
  lastTouchAt: timestampSchema.nullable(),
  health: companyHealthSchema,
});

// GET /companies/:id adds the people and deals behind the numbers.
export const companyDetailSchema = companyListItemSchema.extend({
  contacts: z.array(contactSchema),
  deals: z.array(dealSchema),
});

// POST /companies
export const companyCreateSchema = z.object({
  name: companySchema.shape.name,
  domain: companySchema.shape.domain.optional(),
  industry: companySchema.shape.industry.optional(),
  size: companySchema.shape.size.optional(),
  ownerId: idSchema.optional(),
  leadStatus: companySchema.shape.leadStatus.optional(),
  whatsapp: companySchema.shape.whatsapp.optional(),
  instagram: companySchema.shape.instagram.optional(),
  facebook: companySchema.shape.facebook.optional(),
  productService: companySchema.shape.productService.optional(),
});

// PATCH /companies/:id
export const companyUpdateSchema = companyCreateSchema.partial();

// sort: name, contactCount, openDealValue or lastTouchAt, with "-" for descending. Default -openDealValue.
export const companyListQuerySchema = listQuerySchema.extend({
  ownerId: idSchema.optional(),
  industry: z.string().trim().min(1).optional(),
  health: companyHealthSchema.optional(),
});

// PUT /companies/:id/contacts: the people who belong to the company (Dave, Oct 24, 2026). Contacts not
// listed are unlinked from it; a person can belong to several companies.
export const companyContactsSchema = z.object({
  contactIds: z.array(idSchema).max(500),
});

export type CompanyContactsInput = z.infer<typeof companyContactsSchema>;
export type CompanySize = z.infer<typeof companySizeSchema>;
export type CompanyHealth = z.infer<typeof companyHealthSchema>;
export type Company = z.infer<typeof companySchema>;
export type CompanyListItem = z.infer<typeof companyListItemSchema>;
export type CompanyDetail = z.infer<typeof companyDetailSchema>;
export type CompanyCreateInput = z.infer<typeof companyCreateSchema>;
export type CompanyUpdateInput = z.infer<typeof companyUpdateSchema>;
export type CompanyListQuery = z.infer<typeof companyListQuerySchema>;
