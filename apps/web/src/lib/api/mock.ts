import {
  DEMO_WORKSPACE_ID,
  demoCompanies,
  demoContacts,
  demoDeals,
  demoPipeline,
  demoUsers,
  demoActivities,
  demoTasks,
  demoNotes,
  canSeeNote,
  filterNotes,
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
  type Note,
  type NoteCreateInput,
  type NoteListQuery,
  type NoteUpdateInput,
  type RecordType,
  type Task,
  type TaskCreateInput,
  type TaskListQuery,
  type TaskUpdateInput,
  type DealCreateInput,
  type DealUpdateInput,
} from "@lulu/shared";
import { ApiError, type ListResult } from "./types";

// In-memory copy of the design's sample data. It resets on page reload.
const db = {
  contacts: structuredClone(demoContacts),
  companies: structuredClone(demoCompanies),
  deals: structuredClone(demoDeals),
  tasks: demoTasks(),
  activities: demoActivities(),
  notes: demoNotes(),
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

function findDealIndex(id: string) {
  const index = db.deals.findIndex((d) => d.id === id && !d.deletedAt);
  if (index < 0) throw new ApiError("DEAL_NOT_FOUND", 404);
  return index;
}

// Someone else's private note answers NOT_FOUND, like the server, so its existence is not revealed.
function findNoteIndex(id: string) {
  const index = db.notes.findIndex((n) => n.id === id && canSeeNote(n, CURRENT_USER_ID));
  if (index < 0) throw new ApiError("NOTE_NOT_FOUND", 404);
  return index;
}

function checkRecord(recordType: RecordType | null | undefined, recordId: string | null | undefined) {
  if (!recordType || !recordId) return;
  const rows: { id: string; deletedAt: string | null }[] =
    recordType === "contact" ? db.contacts : recordType === "company" ? db.companies : db.deals;
  if (!alive(rows).some((r) => r.id === recordId)) throw new ApiError("RECORD_NOT_FOUND", 422);
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

  notes: {
    list(query: Partial<NoteListQuery> = {}) {
      const rows = filterNotes(db.notes, CURRENT_USER_ID, query);
      return delay(paginate(rows, query.page, query.pageSize ?? 100));
    },
    async create(input: NoteCreateInput) {
      checkRecord(input.recordType, input.recordId);
      const now = new Date().toISOString();
      const note: Note = {
        id: newId("note"),
        workspaceId: DEMO_WORKSPACE_ID,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        title: input.title,
        body: input.body ?? "",
        visibility: input.visibility ?? "shared",
        authorId: CURRENT_USER_ID,
        recordType: input.recordType ?? null,
        recordId: input.recordId ?? null,
      };
      db.notes.push(note);
      return delay(note);
    },
    async update(id: string, input: NoteUpdateInput) {
      const index = findNoteIndex(id);
      checkRecord(input.recordType, input.recordId);
      db.notes[index] = { ...db.notes[index], ...input, updatedAt: new Date().toISOString() };
      return delay(db.notes[index]);
    },
    async remove(id: string) {
      db.notes[findNoteIndex(id)].deletedAt = new Date().toISOString();
      return delay(undefined);
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
    async create(input: DealCreateInput) {
      const stage = demoPipeline.stages.find((s) => s.id === input.stageId);
      if (!stage) throw new ApiError("STAGE_NOT_FOUND", 422);
      const now = new Date().toISOString();
      const deal: Deal = {
        id: newId("deal"),
        workspaceId: DEMO_WORKSPACE_ID,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        name: input.name,
        value: input.value,
        currency: input.currency ?? CURRENCY,
        stageId: stage.id,
        probability: input.probability ?? stage.probability,
        expectedCloseAt: input.expectedCloseAt ?? null,
        contactId: input.contactId ?? null,
        companyId: input.companyId ?? null,
        ownerId: input.ownerId ?? CURRENT_USER_ID,
        closedAt: stage.type === "open" ? null : now,
      };
      db.deals.push(deal);
      return delay(deal);
    },
    async update(id: string, input: DealUpdateInput) {
      const index = findDealIndex(id);
      db.deals[index] = { ...db.deals[index], ...input, updatedAt: new Date().toISOString() };
      return delay(db.deals[index]);
    },
    async remove(id: string) {
      db.deals[findDealIndex(id)].deletedAt = new Date().toISOString();
      return delay(undefined);
    },
    async move(id: string, stageId: string) {
      const index = findDealIndex(id);
      const moved: Deal = moveDeal(db.deals[index], stageId, demoPipeline.stages);
      db.deals[index] = moved;
      return delay(moved);
    },
  },
};
