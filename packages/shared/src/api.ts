import { z } from 'zod';
import { ERROR_CODES } from './errors.js';
import type { PaginationMeta } from './common.js';

export const errorSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.unknown().nullable(),
  }),
});

export const paginationMetaSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
});

// Success envelope from AGENTS.md: { "data": { }, "meta": { } } with meta only on lists.
export const successSchema = z.object({
  data: z.unknown(),
  meta: paginationMetaSchema.optional(),
});

export type SuccessEnvelope = z.infer<typeof successSchema>;
export type ErrorEnvelope = z.infer<typeof errorSchema>;
export type { PaginationMeta };
