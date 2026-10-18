import {
  DEMO_WORKSPACE_ID,
  demoCompanies,
  demoContacts,
  demoDeals,
  demoPipeline,
  demoUsers,
  demoActivities,
  demoTasks,
  moveDeal,
  setTaskDone,
  sortTimeline,
  summarizeDeals,
  type ActivityListQuery,
  type Company,
  type CompanyListItem,
  type Contact,
  type ContactCreateInput,
  type ContactListQuery,
  type ContactUpdateInput,
  type Deal,
  type Task,
  type TaskCreateInput,
  type TaskListQuery,
  type TaskUpdateInput,
} from "@lulu/shared";
import { ApiError, type ListResult } from "./types";

// In-memory copy of the design's sample data. It resets on page reload.
const db = {
  contacts: structuredClone(demoContacts),
  companies: structuredClone(demoCompanies),
  deals: structuredClone(demoDeals),
  tasks: demoTasks(),
  activities: demoActivities(),
};

const CURRENCY = "EUR";
const CURRENT_USER_ID = "user_jamie";

const delay = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), 150));
const alive = <T extends { deletedAt: string | null }>(rows: T[]) => rows.filter((r) => !r.deletedAt);
const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

function paginate<T>(rows: T[], page = 1, pageSize = 25): ListResult<T> {
  const start = (page - 1) * pageSize;
  return { data: rows.slice(start, start + pageSize), meta: { page, pageSize, total: rows.length } };
}

function sortBy<T>(rows: T[], sort: string | undefined) {
  if (!sort) return rows;
  const desc = sort.startsWith("-");
  const key = (desc ? sort.slice(1) : sort) as keyof T;
  return [...rows].sort((a, b) => {
    const x = a[key] ?? "";
    const y = b[key] ?? "";
    return (x < y ? -1 : x > y ? 1 : 0) * (desc ? -1 : 1);
  });
}

function findContact(id: string) {
  const contact = alive(db.contacts).find((c) => c.id === id);
  if (!contact) throw new ApiError("CONTACT_NOT_FOUND", 404);
  return contact;
}

export const mockApi = {
  me: () => delay(demoUsers.find((u) => u.id === CURRENT_USER_ID)!),
  users: () => delay(paginate(demoUsers)),

  contacts: {
    list(query: Partial<ContactListQuery> = {}) {
      const q = query.q?.toLowerCase();
      let rows = alive(db.contacts).filter((c) => {
        const company = db.companies.find((co) => co.id === c.companyId);
        if (q) {
          const haystack = [c.name, c.email, company?.name, ...c.tags].join(" ").toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        if (query.stage && c.lifecycleStage !== query.stage) return false;
        if (query.ownerId && c.ownerId !== query.ownerId) return false;
        if (query.companyId && c.companyId !== query.companyId) return false;
        if (query.tag && !c.tags.includes(query.tag)) return false;
        if (query.needsFollowUp && c.lifecycleStage !== "follow_up") return false;
        if (query.createdSince && c.createdAt < query.createdSince) return false;
        return true;
      });
      rows = sortBy(rows, query.sort ?? "-lastTouchAt");
      return delay(paginate(rows, query.page, query.pageSize));
    },
    get: async (id: string) => delay(findContact(id)),
    create(input: ContactCreateInput) {
      const now = new Date().toISOString();
      const contact: Contact = {
        id: newId("contact"),
        workspaceId: DEMO_WORKSPACE_ID,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        companyId: input.companyId ?? null,
        jobRole: input.jobRole ?? null,
        source: input.source ?? null,
        lifecycleStage: input.lifecycleStage ?? "new",
        ownerId: input.ownerId ?? CURRENT_USER_ID,
        tags: input.tags ?? [],
        marketingConsent: input.marketingConsent ?? false,
        consentUpdatedAt: input.marketingConsent === undefined ? null : now,
        lastTouchAt: null,
      };
      db.contacts.push(contact);
      return delay(contact);
    },
    async update(id: string, input: ContactUpdateInput) {
      const contact = findContact(id);
      Object.assign(contact, input, { updatedAt: new Date().toISOString() });
      return delay(contact);
    },
    async remove(id: string) {
      const contact = findContact(id);
      contact.deletedAt = new Date().toISOString();
      return delay(undefined);
    },
    convert(id: string) {
      return mockApi.contacts.update(id, { lifecycleStage: "customer" });
    },
  },

  companies: {
    list(): Promise<ListResult<CompanyListItem>> {
      const rows = alive(db.companies).map((company: Company) => ({
        ...company,
        contactCount: alive(db.contacts).filter((c) => c.companyId === company.id).length,
        openDealValue: {
          amount: alive(db.deals)
            .filter((d) => d.companyId === company.id && d.currency === CURRENCY && !d.closedAt)
            .reduce((sum, d) => sum + d.value, 0),
          currency: CURRENCY,
        },
      }));
      return delay(paginate(rows));
    },
  },

  tasks: {
    list(query: Partial<TaskListQuery> = {}) {
      const rows = alive(db.tasks).filter(
        (t) =>
          (!query.ownerId || t.ownerId === query.ownerId) &&
          (query.done === undefined || t.done === query.done) &&
          (!query.recordType || t.recordType === query.recordType) &&
          (!query.recordId || t.recordId === query.recordId),
      );
      return delay(paginate(sortBy(rows, "dueAt"), query.page, query.pageSize ?? 100));
    },
    create(input: TaskCreateInput) {
      const now = new Date().toISOString();
      const task: Task = {
        id: newId("task"),
        workspaceId: DEMO_WORKSPACE_ID,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        title: input.title,
        dueAt: input.dueAt ?? null,
        priority: input.priority ?? "normal",
        ownerId: input.ownerId ?? CURRENT_USER_ID,
        done: false,
        doneAt: null,
        recordType: input.recordType ?? null,
        recordId: input.recordId ?? null,
      };
      db.tasks.push(task);
      return delay(task);
    },
    async update(id: string, input: TaskUpdateInput) {
      const index = db.tasks.findIndex((t) => t.id === id && !t.deletedAt);
      if (index < 0) throw new ApiError("TASK_NOT_FOUND", 404);
      const { done, ...rest } = input;
      let task: Task = { ...db.tasks[index], ...rest, updatedAt: new Date().toISOString() };
      if (done !== undefined && done !== task.done) {
        // Same rule as the server: ticking a task sets doneAt and logs an activity.
        const result = setTaskDone(task, done, CURRENT_USER_ID, new Date());
        task = result.task;
        const now = new Date().toISOString();
        if (result.activity) {
          db.activities.push({
            ...result.activity,
            id: newId("activity"),
            workspaceId: DEMO_WORKSPACE_ID,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          });
        }
      }
      db.tasks[index] = task;
      return delay(task);
    },
  },

  activities: {
    list(query: Partial<ActivityListQuery> = {}) {
      const rows = db.activities.filter(
        (a) =>
          (!query.recordType || a.recordType === query.recordType) &&
          (!query.recordId || a.recordId === query.recordId) &&
          (!query.type || a.type === query.type),
      );
      return delay(paginate(sortTimeline(rows), query.page, query.pageSize ?? 50));
    },
  },

  pipelines: () => delay([demoPipeline]),

  deals: {
    list: () => delay(paginate(alive(db.deals), 1, 100)),
    summary: () => delay(summarizeDeals(alive(db.deals), demoPipeline.stages, CURRENCY)),
    async move(id: string, stageId: string) {
      const index = db.deals.findIndex((d) => d.id === id && !d.deletedAt);
      if (index < 0) throw new ApiError("DEAL_NOT_FOUND", 404);
      const moved: Deal = moveDeal(db.deals[index], stageId, demoPipeline.stages);
      db.deals[index] = moved;
      return delay(moved);
    },
  },
};
