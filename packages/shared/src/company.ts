import { z } from "zod";
import { baseRecordSchema, idSchema, listQuerySchema, moneySchema } from "./common";

export const companySchema = baseRecordSchema.extend({
  name: z.string().trim().min(1),
  domain: z.string().trim().min(1).nullable(),
  industry: z.string().trim().min(1).nullable(),
  size: z.string().trim().min(1).nullable(),
  ownerId: idSchema,
});

// GET /companies returns each company with its contact count and open deal value.
export const companyListItemSchema = companySchema.extend({
  contactCount: z.number().int().min(0),
  openDealValue: moneySchema,
});

// POST /companies
export const companyCreateSchema = z.object({
  name: companySchema.shape.name,
  domain: companySchema.shape.domain.optional(),
  industry: companySchema.shape.industry.optional(),
  size: companySchema.shape.size.optional(),
  ownerId: idSchema.optional(),
});

// PATCH /companies/:id
export const companyUpdateSchema = companyCreateSchema.partial();

export const companyListQuerySchema = listQuerySchema.extend({
  ownerId: idSchema.optional(),
});

export type Company = z.infer<typeof companySchema>;
export type CompanyListItem = z.infer<typeof companyListItemSchema>;
export type CompanyCreateInput = z.infer<typeof companyCreateSchema>;
export type CompanyUpdateInput = z.infer<typeof companyUpdateSchema>;
export type CompanyListQuery = z.infer<typeof companyListQuerySchema>;
