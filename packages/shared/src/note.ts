import { z } from "zod";
import { baseRecordSchema, idSchema, listQuerySchema } from "./common";
import { recordTypeSchema } from "./record";

export const noteVisibilitySchema = z.enum(["shared", "private"]);

export const noteSchema = baseRecordSchema.extend({
    title: z.string().trim().min(1),
    body: z.string(),
    visibility: noteVisibilitySchema,
    authorId: idSchema,
    recordType: recordTypeSchema.nullable(),
    recordId: idSchema.nullable(),
});

// POST /notes. Visibility defaults to "shared" and the author is the current user.
export const noteCreateSchema = z
    .object({
        title: noteSchema.shape.title,
        body: noteSchema.shape.body,
        visibility: noteVisibilitySchema.optional(),
        recordType: recordTypeSchema.nullable().optional(),
        recordId: idSchema.nullable().optional(),
    })
    .refine((note) => (note.recordType == null) === (note.recordId == null), {
        message: "RECORD_LINK_INCOMPLETE",
        path: ["recordId"],
    });

// PATCH /notes/:id. The link and the author never change.
export const noteUpdateSchema = z.object({
    title: noteSchema.shape.title.optional(),
    body: noteSchema.shape.body.optional(),
    visibility: noteVisibilitySchema.optional(),
});

// GET /notes. Private notes are returned only to their author (enforced by the server, not here).
export const noteListQuerySchema = listQuerySchema.extend({
    recordType: recordTypeSchema.optional(),
    recordId: idSchema.optional(),
    visibility: noteVisibilitySchema.optional(),
});

export type NoteVisibility = z.infer<typeof noteVisibilitySchema>;
export type Note = z.infer<typeof noteSchema>;
export type NoteCreateInput = z.infer<typeof noteCreateSchema>;
export type NoteUpdateInput = z.infer<typeof noteUpdateSchema>;
export type NoteListQuery = z.infer<typeof noteListQuerySchema>;