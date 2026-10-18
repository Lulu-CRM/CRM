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
import { getList, getOne, remove, upload, write } from "./http";

// Endpoints from docs/api.md. Keep the same shape as mock.ts.
export const realApi = {
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
  },

  tasks: {
    list: (query: Partial<TaskListQuery> = {}) => getList(taskSchema, "/tasks", query),
    create: (input: TaskCreateInput) => write(taskSchema, "POST", "/tasks", input),
    update: (id: string, input: TaskUpdateInput) => write(taskSchema, "PATCH", `/tasks/${id}`, input),
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
