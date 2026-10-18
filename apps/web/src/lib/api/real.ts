import { z } from "zod";
import {
  activitySchema,
  companyListItemSchema,
  contactSchema,
  dealSchema,
  dealSummarySchema,
  pipelineWithStagesSchema,
  taskSchema,
  userSchema,
  type ActivityListQuery,
  type ContactCreateInput,
  type ContactListQuery,
  type ContactUpdateInput,
  type TaskCreateInput,
  type TaskListQuery,
  type TaskUpdateInput,
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
    list: () => getList(companyListItemSchema, "/companies"),
  },

  tasks: {
    list: (query: Partial<TaskListQuery> = {}) => getList(taskSchema, "/tasks", query),
    create: (input: TaskCreateInput) => write(taskSchema, "POST", "/tasks", input),
    update: (id: string, input: TaskUpdateInput) => write(taskSchema, "PATCH", `/tasks/${id}`, input),
  },

  activities: {
    list: (query: Partial<ActivityListQuery> = {}) => getList(activitySchema, "/activities", query),
  },

  pipelines: () => getOne(z.array(pipelineWithStagesSchema), "/pipelines"),

  deals: {
    list: () => getList(dealSchema, "/deals", { pageSize: 100 }),
    summary: () => getOne(dealSummarySchema, "/deals/summary"),
    move: (id: string, stageId: string) => write(dealSchema, "POST", `/deals/${id}/move`, { stageId }),
  },
};
