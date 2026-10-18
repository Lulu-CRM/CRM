import { z } from "zod";
import {
  companyListItemSchema,
  contactSchema,
  dealSchema,
  dealSummarySchema,
  pipelineWithStagesSchema,
  userSchema,
  type ContactCreateInput,
  type ContactListQuery,
  type ContactUpdateInput,
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

  pipelines: () => getOne(z.array(pipelineWithStagesSchema), "/pipelines"),

  deals: {
    list: () => getList(dealSchema, "/deals", { pageSize: 100 }),
    summary: () => getOne(dealSummarySchema, "/deals/summary"),
    move: (id: string, stageId: string) => write(dealSchema, "POST", `/deals/${id}/move`, { stageId }),
  },
};
