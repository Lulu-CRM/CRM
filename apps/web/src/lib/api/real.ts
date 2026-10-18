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
} from "@lulu/shared";
import { getList, getOne, remove, write } from "./http";

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
