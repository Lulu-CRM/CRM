import { z } from "zod";
import { baseRecordSchema, fractionSchema } from "./common.js";
import { roleSchema } from "./user.js";

// CRM settings (docs/api.md, "Settings"). Only owners and admins may change them.

// ---------- Custom fields ----------

export const customFieldTypeSchema = z.enum(["text", "number", "date", "select", "checkbox"]);

export const customFieldSchema = baseRecordSchema.extend({
  entity: z.literal("contact"),
  // Stable key for the value on the record, for example "preferred_language". Set once, never changed.
  key: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/),
  label: z.string().trim().min(1).max(60),
  type: customFieldTypeSchema,
  // Choices for "select" fields; empty for the other types.
  options: z.array(z.string().trim().min(1).max(60)).max(50),
});

const withOptionsRule = <T extends z.ZodType<{ type?: string; options?: string[] }>>(schema: T) =>
  schema.refine((field) => field.type !== "select" || (field.options?.length ?? 0) > 0, {
    message: "CUSTOM_FIELD_OPTIONS_REQUIRED",
    path: ["options"],
  });

// POST /settings/custom-fields
export const customFieldCreateSchema = withOptionsRule(
  z.object({
    key: customFieldSchema.shape.key,
    label: customFieldSchema.shape.label,
    type: customFieldTypeSchema,
    options: customFieldSchema.shape.options.default([]),
  }),
);

// PATCH /settings/custom-fields/:id. The key and type stay as created, so stored values keep their meaning.
export const customFieldUpdateSchema = z.object({
  label: customFieldSchema.shape.label.optional(),
  options: customFieldSchema.shape.options.optional(),
});

// ---------- Stages ----------

// POST /settings/stages. New stages are open stages; every pipeline keeps exactly one won and one lost stage.
export const stageCreateSchema = z.object({
  pipelineId: z.string().min(1),
  name: z.string().trim().min(1).max(40),
  probability: fractionSchema,
});

// PATCH /settings/stages/:id. Renaming a default stage clears its key, so the new name shows in every language.
export const stageUpdateSchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  probability: fractionSchema.optional(),
  order: z.number().int().min(0).optional(),
});

// ---------- Roles and permissions ----------

export const permissionResourceSchema = z.enum(["contacts", "companies", "deals", "tasks", "notes", "segments", "imports", "settings"]);
export const permissionActionSchema = z.enum(["view", "create", "edit", "delete"]);

// What each role may do. The owner can always do everything and is not stored.
export const rolePermissionsSchema = z.record(
  roleSchema.exclude(["owner"]),
  z.record(permissionResourceSchema, z.array(permissionActionSchema)),
);

// ---------- Consent ----------

export const consentSettingsSchema = z.object({
  // Marketing email goes only to contacts with recorded consent.
  requireConsentForMarketing: z.boolean(),
  // Changing consent asks for a note on where it came from (form, call, email).
  requireConsentEvidence: z.boolean(),
  // What imported contacts get. "not_granted" is the safe default (docs/data-model.md, "Consent").
  importedContactsConsent: z.enum(["not_granted", "granted"]),
});

// ---------- Notifications ----------

export const notificationEventSchema = z.enum(["taskAssigned", "taskDue", "dealAssigned", "dealStageChanged", "leadAssigned", "importFinished"]);
export const notificationChannelsSchema = z.object({ inApp: z.boolean(), email: z.boolean() });
export const notificationSettingsSchema = z.record(notificationEventSchema, notificationChannelsSchema);

// ---------- AI switches (shown on the AI Analysis page) ----------

export const aiSettingsSchema = z.object({
  analyzeNewActivity: z.boolean(),
  suggestFollowUps: z.boolean(),
  // AI never saves without the user's confirmation (AGENTS.md rule 7), so this only pre-fills the confirm step.
  autoUpdateFields: z.boolean(),
});

export type CustomFieldType = z.infer<typeof customFieldTypeSchema>;
export type CustomField = z.infer<typeof customFieldSchema>;
export type CustomFieldCreateInput = z.input<typeof customFieldCreateSchema>;
export type CustomFieldUpdateInput = z.infer<typeof customFieldUpdateSchema>;
export type StageCreateInput = z.infer<typeof stageCreateSchema>;
export type StageUpdateInput = z.infer<typeof stageUpdateSchema>;
export type PermissionResource = z.infer<typeof permissionResourceSchema>;
export type PermissionAction = z.infer<typeof permissionActionSchema>;
export type RolePermissions = z.infer<typeof rolePermissionsSchema>;
export type ConsentSettings = z.infer<typeof consentSettingsSchema>;
export type NotificationEvent = z.infer<typeof notificationEventSchema>;
export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;
export type AiSettings = z.infer<typeof aiSettingsSchema>;
