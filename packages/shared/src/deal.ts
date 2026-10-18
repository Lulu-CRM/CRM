import { z } from "zod";
import {
  baseRecordSchema,
  currencySchema,
  fractionSchema,
  idSchema,
  listQuerySchema,
  moneySchema,
  timestampSchema,
} from "./common";
import { stageTypeSchema } from "./pipeline";

export const dealSchema = baseRecordSchema.extend({
  name: z.string().trim().min(1),
  value: z.number().finite().min(0),
  currency: currencySchema,
  stageId: idSchema,
  probability: fractionSchema,
  expectedCloseAt: timestampSchema.nullable(),
  contactId: idSchema.nullable(),
  companyId: idSchema.nullable(),
  ownerId: idSchema,
  closedAt: timestampSchema.nullable(),
});

// POST /deals. The server fills in what is left out:
// currency from the workspace, probability from the stage, owner from the current user.
export const dealCreateSchema = z.object({
  name: dealSchema.shape.name,
  value: dealSchema.shape.value,
  currency: currencySchema.optional(),
  stageId: idSchema,
  probability: fractionSchema.optional(),
  expectedCloseAt: timestampSchema.nullable().optional(),
  contactId: idSchema.nullable().optional(),
  companyId: idSchema.nullable().optional(),
  ownerId: idSchema.optional(),
});

// PATCH /deals/:id. The stage changes only through POST /deals/:id/move, which also sets probability and closedAt.
export const dealUpdateSchema = dealCreateSchema.omit({ stageId: true }).partial();

// POST /deals/:id/move
export const dealMoveSchema = z.object({
  stageId: idSchema,
});

// GET /deals/summary. The default pipeline is used when pipelineId is left out.
export const dealSummaryQuerySchema = z.object({
  pipelineId: idSchema.optional(),
});


// GET /deals
export const dealListQuerySchema = listQuerySchema.extend({
  stageId: idSchema.optional(),
  ownerId: idSchema.optional(),
  companyId: idSchema.optional(),
  contactId: idSchema.optional(),
  status: stageTypeSchema.optional(),
});

// GET /deals/summary. Money totals are in one currency (the workspace default);
// open deals in other currencies are counted in `otherCurrencyDeals` instead of being converted.
export const dealSummarySchema = z.object({
  openValue: moneySchema,
  weightedValue: moneySchema,
  winRate: fractionSchema.nullable(),
  activeDeals: z.number().int().min(0),
  averageDaysToClose: z.number().min(0).nullable(),
  otherCurrencyDeals: z.number().int().min(0),
});

export type Deal = z.infer<typeof dealSchema>;
export type DealCreateInput = z.infer<typeof dealCreateSchema>;
export type DealUpdateInput = z.infer<typeof dealUpdateSchema>;
export type DealMoveInput = z.infer<typeof dealMoveSchema>;
export type DealListQuery = z.infer<typeof dealListQuerySchema>;
export type DealSummary = z.infer<typeof dealSummarySchema>;
export type DealSummaryQuery = z.infer<typeof dealSummaryQuerySchema>;
