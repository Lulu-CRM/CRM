import { z } from "zod";
import {
  activitySchema,
  companyDetailSchema,
  companyListItemSchema,
  contactSchema,
  dealSchema,
  dealSummarySchema,
  overviewSchema,
  pipelineWithStagesSchema,
  noteSchema,
  taskSchema,
  userSchema,
  type ActivityListQuery,
  type CompanyContactsInput,
  type CompanyCreateInput,
  type CompanyListQuery,
  type CompanyUpdateInput,
  type ContactCreateInput,
  type ContactListQuery,
  type ContactUpdateInput,
  type NoteCreateInput,
  type NoteListQuery,
  type NoteUpdateInput,
  type TaskCreateInput,
  type TaskListQuery,
  type TaskUpdateInput,
  type DealCreateInput,
  type DealUpdateInput,
  segmentListItemSchema,
  authSessionSchema,
  type LoginInput,
  aiInsightSchema,
  aiRunSchema,
  type AiAcceptInput,
  aiSettingsSchema,
  consentSettingsSchema,
  customFieldSchema,
  notificationSettingsSchema,
  rolePermissionsSchema,
  stageSchema,
  type AiSettings,
  type ConsentSettings,
  type CustomFieldCreateInput,
  type CustomFieldUpdateInput,
  type NotificationSettings,
  type RolePermissions,
  type StageCreateInput,
  type StageUpdateInput,
  heldRowSchema,
  importJobSchema,
  importPreviewSchema,
  type ImportConfirmInput,
  type ImportMapping,
  type ImportResolveAction,
  segmentSchema,
  type ListQuery,
  type SegmentCreateInput,
  type SegmentUpdateInput,
} from "@lulu/shared";
import { getList, getOne, post, remove, upload, write } from "./http";

// Endpoints from docs/api.md. Keep the same shape as mock.ts.
export const realApi = {
  auth: {
    login: (input: LoginInput) => write(authSessionSchema, "POST", "/auth/login", input),
    logout: () => post("/auth/logout"),
  },

  me: () => getOne(userSchema, "/me"),
  users: () => getList(userSchema, "/users"),

  contacts: {
    list: (query: Partial<ContactListQuery> = {}) => getList(contactSchema, "/contacts", query),
    get: (id: string) => getOne(contactSchema, `/contacts/${id}`),
    create: (input: ContactCreateInput) => write(contactSchema, "POST", "/contacts", input),
    update: (id: string, input: ContactUpdateInput) =>
      write(contactSchema, "PATCH", `/contacts/${id}`, input),
    remove: (id: string) => remove(`/contacts/${id}`),
    convert: (id: string) => write(contactSchema, "POST", `/contacts/${id}/convert`, {}),
  },

  companies: {
    list: (query: Partial<CompanyListQuery> = {}) => getList(companyListItemSchema, "/companies", query),
    get: (id: string) => getOne(companyDetailSchema, `/companies/${id}`),
    create: (input: CompanyCreateInput) => write(companyListItemSchema, "POST", "/companies", input),
    update: (id: string, input: CompanyUpdateInput) =>
      write(companyListItemSchema, "PATCH", `/companies/${id}`, input),
    remove: (id: string) => remove(`/companies/${id}`),
    setContacts: (id: string, input: CompanyContactsInput) =>
      write(companyDetailSchema, "PUT", `/companies/${id}/contacts`, input),
    // Queues the AI to write the company's AI notes; poll get(id) for aiNotesUpdatedAt.
    aiNotes: (id: string) => write(aiRunSchema, "POST", `/companies/${id}/ai-notes`, {}),
  },

  tasks: {
    list: (query: Partial<TaskListQuery> = {}) => getList(taskSchema, "/tasks", query),
    create: (input: TaskCreateInput) => write(taskSchema, "POST", "/tasks", input),
    update: (id: string, input: TaskUpdateInput) => write(taskSchema, "PATCH", `/tasks/${id}`, input),
    remove: (id: string) => remove(`/tasks/${id}`),
  },

  notes: {
    list: (query: Partial<NoteListQuery> = {}) => getList(noteSchema, "/notes", query),
    create: (input: NoteCreateInput) => write(noteSchema, "POST", "/notes", input),
    update: (id: string, input: NoteUpdateInput) => write(noteSchema, "PATCH", `/notes/${id}`, input),
    remove: (id: string) => remove(`/notes/${id}`),
  },

  activities: {
    list: (query: Partial<ActivityListQuery> = {}) => getList(activitySchema, "/activities", query),
  },

  overview: () => getOne(overviewSchema, "/overview"),

  segments: {
    list: () => getList(segmentListItemSchema, "/segments", { pageSize: 100 }),
    create: (input: SegmentCreateInput) => write(segmentSchema, "POST", "/segments", input),
    update: (id: string, input: SegmentUpdateInput) => write(segmentSchema, "PATCH", `/segments/${id}`, input),
    remove: (id: string) => remove(`/segments/${id}`),
    contacts: (id: string, query: Partial<ListQuery> = {}) => getList(contactSchema, `/segments/${id}/contacts`, query),
  },

  imports: {
    create: (file: File) => upload(importJobSchema, "/imports", file),
    get: (id: string) => getOne(importJobSchema, `/imports/${id}`),
    saveMapping: (id: string, mapping: ImportMapping) => write(importJobSchema, "PUT", `/imports/${id}/mapping`, { mapping }),
    preview: (id: string) => getOne(importPreviewSchema, `/imports/${id}/preview`),
    confirm: (id: string, input: ImportConfirmInput) => write(importJobSchema, "POST", `/imports/${id}/confirm`, input),
    held: (id: string) => getList(heldRowSchema, `/imports/${id}/held`, { pageSize: 100 }),
    resolve: (id: string, rowId: string, action: ImportResolveAction) =>
      write(heldRowSchema, "POST", `/imports/${id}/held/${rowId}/resolve`, { action }),
  },

  settings: {
    customFields: {
      list: () => getList(customFieldSchema, "/settings/custom-fields", { pageSize: 100 }),
      create: (input: CustomFieldCreateInput) => write(customFieldSchema, "POST", "/settings/custom-fields", input),
      update: (id: string, input: CustomFieldUpdateInput) =>
        write(customFieldSchema, "PATCH", `/settings/custom-fields/${id}`, input),
      remove: (id: string) => remove(`/settings/custom-fields/${id}`),
    },
    stages: {
      create: (input: StageCreateInput) => write(stageSchema, "POST", "/settings/stages", input),
      update: (id: string, input: StageUpdateInput) => write(stageSchema, "PATCH", `/settings/stages/${id}`, input),
      remove: (id: string) => remove(`/settings/stages/${id}`),
    },
    roles: {
      get: () => getOne(rolePermissionsSchema, "/settings/roles"),
      put: (input: RolePermissions) => write(rolePermissionsSchema, "PUT", "/settings/roles", input),
    },
    consent: {
      get: () => getOne(consentSettingsSchema, "/settings/consent"),
      put: (input: ConsentSettings) => write(consentSettingsSchema, "PUT", "/settings/consent", input),
    },
    notifications: {
      get: () => getOne(notificationSettingsSchema, "/settings/notifications"),
      put: (input: NotificationSettings) => write(notificationSettingsSchema, "PUT", "/settings/notifications", input),
    },
    ai: {
      get: () => getOne(aiSettingsSchema, "/settings/ai"),
      put: (input: AiSettings) => write(aiSettingsSchema, "PUT", "/settings/ai", input),
    },
  },

  ai: {
    run: (contactId: string) => write(aiRunSchema, "POST", `/contacts/${contactId}/ai-analysis`, {}),
    latest: (contactId: string) => getOne(aiInsightSchema.nullable(), `/contacts/${contactId}/ai-insights`),
    accept: (id: string, input: AiAcceptInput) => write(aiInsightSchema, "POST", `/ai-insights/${id}/accept`, input),
    // 204, no body.
    dismiss: (id: string) => post(`/ai-insights/${id}/dismiss`),
  },

  pipelines: () => getOne(z.array(pipelineWithStagesSchema), "/pipelines"),

  deals: {
    list: () => getList(dealSchema, "/deals", { pageSize: 100 }),
    summary: () => getOne(dealSummarySchema, "/deals/summary"),
    create: (input: DealCreateInput) => write(dealSchema, "POST", "/deals", input),
    update: (id: string, input: DealUpdateInput) => write(dealSchema, "PATCH", `/deals/${id}`, input),
    remove: (id: string) => remove(`/deals/${id}`),
    move: (id: string, stageId: string) => write(dealSchema, "POST", `/deals/${id}/move`, { stageId }),
  },
};
