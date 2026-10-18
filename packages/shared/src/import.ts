import { z } from "zod";
import { baseRecordSchema, idSchema } from "./common.js";
import { contactSchema } from "./contact.js";

// Contact import (docs/api.md, "Import"). The server reads CSV and XLSX; rows go through the
// shared logic in import-logic.ts, so the preview and the background job agree.

export const MAX_IMPORT_ROWS = 10_000;

// The Lulu fields a source column can feed. "ignore" leaves the column out.
export const importFieldSchema = z.enum([
  "name",
  "firstName",
  "lastName",
  "email",
  "phone",
  "company",
  "jobRole",
  "source",
  "lifecycleStage",
  "tags",
  "ignore",
]);

// Source column header -> Lulu field.
export const importMappingSchema = z.record(z.string(), importFieldSchema);

export const duplicateHandlingSchema = z.enum(["hold", "skip", "update"]);

export const importStatusSchema = z.enum(["uploaded", "processing", "done", "failed"]);

export const importJobSchema = baseRecordSchema.extend({
  fileName: z.string().min(1),
  status: importStatusSchema,
  columns: z.array(z.string()),
  // The first data row, so the mapping step can show an example value for each column.
  sampleRow: z.record(z.string(), z.string()).nullable(),
  mapping: importMappingSchema,
  rowsTotal: z.number().int().min(0).max(MAX_IMPORT_ROWS),
  rowsAdded: z.number().int().min(0),
  rowsUpdated: z.number().int().min(0),
  rowsHeld: z.number().int().min(0),
  rowsSkipped: z.number().int().min(0),
  ownerId: idSchema.nullable(),
  tag: z.string().trim().min(1).nullable(),
  duplicateHandling: duplicateHandlingSchema.nullable(),
  // Translation key when status is "failed", for example IMPORT_TOO_MANY_ROWS.
  error: z.string().nullable(),
});

// PUT /imports/:id/mapping
export const importMappingInputSchema = z.object({ mapping: importMappingSchema });

// POST /imports/:id/confirm
export const importConfirmSchema = z.object({
  ownerId: idSchema.optional(),
  tag: z.string().trim().min(1).max(60).optional(),
  duplicateHandling: duplicateHandlingSchema.default("hold"),
});

// What a row will become. Problems are translation keys under import.problems.
export const importRowProblemSchema = z.enum(["nameMissing", "emailInvalid", "stageUnknown"]);

export const importedContactSchema = z.object({
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  companyName: z.string().nullable(),
  jobRole: z.string().nullable(),
  source: z.string().nullable(),
  lifecycleStage: contactSchema.shape.lifecycleStage.nullable(),
  tags: z.array(z.string()),
});

export const duplicateMatchSchema = z.enum(["email", "nameAndCompany"]);

export const importPreviewRowSchema = z.object({
  rowNumber: z.number().int().min(1),
  contact: importedContactSchema,
  problems: z.array(importRowProblemSchema),
  duplicateOfContactId: idSchema.nullable(),
  duplicateMatch: duplicateMatchSchema.nullable(),
});

// GET /imports/:id/preview: counts for the whole file, rows for the first page.
export const importPreviewSchema = z.object({
  rowsTotal: z.number().int().min(0),
  newCount: z.number().int().min(0),
  duplicateCount: z.number().int().min(0),
  problemCount: z.number().int().min(0),
  rows: z.array(importPreviewRowSchema),
});

export const importRowStatusSchema = z.enum(["added", "updated", "held", "skipped", "merged"]);

// GET /imports/:id/held
export const heldRowSchema = z.object({
  id: idSchema,
  importJobId: idSchema,
  rowNumber: z.number().int().min(1),
  contact: importedContactSchema,
  duplicateOfContactId: idSchema,
  duplicateMatch: duplicateMatchSchema,
  status: importRowStatusSchema,
});

// POST /imports/:id/held/:rowId/resolve
export const importResolveSchema = z.object({ action: z.enum(["skip", "create", "merge"]) });

export type ImportField = z.infer<typeof importFieldSchema>;
export type ImportMapping = z.infer<typeof importMappingSchema>;
export type DuplicateHandling = z.infer<typeof duplicateHandlingSchema>;
export type ImportJob = z.infer<typeof importJobSchema>;
export type ImportConfirmInput = z.input<typeof importConfirmSchema>;
export type ImportRowProblem = z.infer<typeof importRowProblemSchema>;
export type ImportedContact = z.infer<typeof importedContactSchema>;
export type DuplicateMatch = z.infer<typeof duplicateMatchSchema>;
export type ImportPreviewRow = z.infer<typeof importPreviewRowSchema>;
export type ImportPreview = z.infer<typeof importPreviewSchema>;
export type HeldRow = z.infer<typeof heldRowSchema>;
export type ImportResolveAction = z.infer<typeof importResolveSchema>["action"];
