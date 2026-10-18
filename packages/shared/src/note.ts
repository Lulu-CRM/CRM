import { z } from "zod";
import { baseRecordSchema, idSchema, listQuerySchema } from "./common.js";
import { recordTypeSchema } from "./record.js";

// Shared notes are seen by the whole workspace. Private notes only by their author.
export const noteVisibilitySchema = z.enum(["shared", "private"]);

export const noteSchema = baseRecordSchema.extend({
  title: z.string().trim().min(1).max(200),
  body: z.string().max(10000),
  visibility: noteVisibilitySchema,
  authorId: idSchema,
  recordType: recordTypeSchema.nullable(),
  recordId: idSchema.nullable(),
});

const linkComplete = (note: { recordType?: unknown; recordId?: unknown }) =>
  (note.recordType == null) === (note.recordId == null);
const linkIssue = { message: "RECORD_LINK_INCOMPLETE", path: ["recordId"] };

// POST /notes. The author is the current user, visibility defaults to "shared".
export const noteCreateSchema = z
  .object({
    title: noteSchema.shape.title,
    body: noteSchema.shape.body.optional(),
    visibility: noteVisibilitySchema.optional(),
    recordType: recordTypeSchema.nullable().optional(),
    recordId: idSchema.nullable().optional(),
  })
  .refine(linkComplete, linkIssue);

// PATCH /notes/:id. The link can be changed or removed (send both fields as null), but not half set.
export const noteUpdateSchema = z
  .object({
    title: noteSchema.shape.title.optional(),
    body: noteSchema.shape.body.optional(),
    visibility: noteVisibilitySchema.optional(),
    recordType: recordTypeSchema.nullable().optional(),
    recordId: idSchema.nullable().optional(),
  })
  .refine((note) => (note.recordType === undefined) === (note.recordId === undefined) && linkComplete(note), linkIssue);

// GET /notes. Private notes of other users are never returned.
export const noteListQuerySchema = listQuerySchema.extend({
  visibility: noteVisibilitySchema.optional(),
  recordType: recordTypeSchema.optional(),
  recordId: idSchema.optional(),
});

export type NoteVisibility = z.infer<typeof noteVisibilitySchema>;
export type Note = z.infer<typeof noteSchema>;
export type NoteCreateInput = z.infer<typeof noteCreateSchema>;
export type NoteUpdateInput = z.infer<typeof noteUpdateSchema>;
export type NoteListQuery = z.infer<typeof noteListQuerySchema>;
