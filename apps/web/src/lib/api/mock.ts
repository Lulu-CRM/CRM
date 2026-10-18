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
  demoSegments,
  guessMapping,
  importConfirmSchema,
  mergeIntoContact,
  parseCsv,
  planImport,
  MAX_IMPORT_ROWS,
  segmentMembers,
  canSeeNote,
  filterNotes,
  buildOverview,
  companyDetail,
  summarizeCompany,
  moveDeal,
  setTaskDone,
  sortTimeline,
  summarizeDeals,
  type ActivityListQuery,
  type Company,
  type CompanyCreateInput,
  type CompanyListItem,
  type CompanyListQuery,
  type CompanyUpdateInput,
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
  type ListQuery,
  type Segment,
  type SegmentCreateInput,
  type SegmentListItem,
  type SegmentUpdateInput,
  type HeldRow,
  type ImportConfirmInput,
  type ImportedContact,
  type ImportJob,
  type ImportMapping,
  type ImportPreview,
  type ImportResolveAction,
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
  segments: structuredClone(demoSegments),
  imports: new Map<string, { job: ImportJob; rows: Record<string, string>[]; held: HeldRow[] }>(),
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

function findCompany(id: string) {
  const company = alive(db.companies).find((c) => c.id === id);
  if (!company) throw new ApiError("COMPANY_NOT_FOUND", 404);
  return company;
}

const summarize = (company: Company) =>
  summarizeCompany(company, alive(db.contacts), alive(db.deals), demoPipeline.stages, CURRENCY);

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

function findSegmentIndex(id: string) {
  const index = db.segments.findIndex((s) => s.id === id && !s.deletedAt);
  if (index < 0) throw new ApiError("SEGMENT_NOT_FOUND", 404);
  return index;
}

// Live members, worked out with the same shared rules the server uses.
function members(segment: Segment) {
  return segmentMembers(alive(db.contacts), segment.rules, {
    now: new Date(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    tasks: alive(db.tasks).filter((t) => !t.done),
    deals: alive(db.deals),
    stages: demoPipeline.stages,
  });
}

// ---------- Import (stands in for the API's import.process background job) ----------

// How long the pretend background job takes, so the page has to wait for it like the real one.
export const MOCK_IMPORT_DELAY_MS = 600;

// Browsers and Node have file.text(); the jsdom test environment only has FileReader.
function readText(file: File) {
  if (typeof file.text === "function") return file.text();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new ApiError("IMPORT_FILE_UNREADABLE", 422));
    reader.readAsText(file);
  });
}

function findImport(id: string) {
  const entry = db.imports.get(id);
  if (!entry || entry.job.deletedAt) throw new ApiError("IMPORT_NOT_FOUND", 404);
  return entry;
}

function companyIdFor(name: string | null, ownerId: string) {
  if (!name) return null;
  const existing = alive(db.companies).find((c) => c.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  if (existing) return existing.id;
  const now = new Date().toISOString();
  const company: Company = {
    id: newId("company"),
    workspaceId: DEMO_WORKSPACE_ID,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    name,
    domain: null,
    industry: null,
    size: null,
    ownerId,
  };
  db.companies.push(company);
  return company.id;
}

function addImportedContact(incoming: ImportedContact, ownerId: string, tag: string | null) {
  const now = new Date().toISOString();
  db.contacts.push({
    id: newId("contact"),
    workspaceId: DEMO_WORKSPACE_ID,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    name: incoming.name,
    email: incoming.email,
    phone: incoming.phone,
    companyId: companyIdFor(incoming.companyName, ownerId),
    jobRole: incoming.jobRole,
    source: incoming.source ?? "import",
    lifecycleStage: incoming.lifecycleStage ?? "new",
    ownerId,
    tags: [...new Set([...incoming.tags, ...(tag ? [tag] : [])])],
    // Imported contacts follow the workspace consent rules; without a rule, no marketing consent.
    marketingConsent: false,
    consentUpdatedAt: null,
    lastTouchAt: null,
  });
}

function mergeImported(contactId: string, incoming: ImportedContact, mode: "fill" | "overwrite", tag: string | null) {
  const contact = findContact(contactId);
  const withTag = { ...incoming, tags: [...incoming.tags, ...(tag ? [tag] : [])] };
  Object.assign(contact, mergeIntoContact(contact, withTag, mode, companyIdFor(incoming.companyName, contact.ownerId)), {
    updatedAt: new Date().toISOString(),
  });
}

function runImport(id: string) {
  const entry = findImport(id);
  const { job } = entry;
  const ownerId = job.ownerId ?? CURRENT_USER_ID;
  for (const row of planImport(entry.rows, job.mapping, alive(db.contacts), alive(db.companies))) {
    if (row.problems.length > 0) {
      job.rowsSkipped++;
    } else if (row.duplicateOfContactId) {
      if (job.duplicateHandling === "skip") job.rowsSkipped++;
      else if (job.duplicateHandling === "update") {
        mergeImported(row.duplicateOfContactId, row.contact, "overwrite", job.tag);
        job.rowsUpdated++;
      } else {
        entry.held.push({
          id: newId("row"),
          importJobId: job.id,
          rowNumber: row.rowNumber,
          contact: row.contact,
          duplicateOfContactId: row.duplicateOfContactId,
          duplicateMatch: row.duplicateMatch!,
          status: "held",
        });
        job.rowsHeld++;
      }
    } else {
      addImportedContact(row.contact, ownerId, job.tag);
      job.rowsAdded++;
    }
  }
  job.status = "done";
  job.updatedAt = new Date().toISOString();
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
    list(query: Partial<CompanyListQuery> = {}): Promise<ListResult<CompanyListItem>> {
      const q = query.q?.toLowerCase();
      let rows = alive(db.companies)
        .map(summarize)
        .filter((c) => {
          if (q && ![c.name, c.domain, c.industry].join(" ").toLowerCase().includes(q)) return false;
          if (query.ownerId && c.ownerId !== query.ownerId) return false;
          if (query.industry && c.industry !== query.industry) return false;
          if (query.health && c.health !== query.health) return false;
          return true;
        });
      // openDealValue sorts by amount, like the server.
      const sort = query.sort ?? "-openDealValue";
      const byAmount = rows.map((c) => ({ row: c, openDealValue: c.openDealValue.amount, name: c.name, contactCount: c.contactCount, lastTouchAt: c.lastTouchAt }));
      rows = sortBy(byAmount, sort).map((entry) => entry.row);
      return delay(paginate(rows, query.page, query.pageSize));
    },
    get: async (id: string) =>
      delay(companyDetail(findCompany(id), alive(db.contacts), alive(db.deals), demoPipeline.stages, CURRENCY)),
    create(input: CompanyCreateInput) {
      const now = new Date().toISOString();
      const company: Company = {
        id: newId("company"),
        workspaceId: DEMO_WORKSPACE_ID,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        name: input.name,
        domain: input.domain ?? null,
        industry: input.industry ?? null,
        size: input.size ?? null,
        ownerId: input.ownerId ?? CURRENT_USER_ID,
      };
      db.companies.push(company);
      return delay(summarize(company));
    },
    async update(id: string, input: CompanyUpdateInput) {
      const company = findCompany(id);
      Object.assign(company, input, { updatedAt: new Date().toISOString() });
      return delay(summarize(company));
    },
    async remove(id: string) {
      findCompany(id).deletedAt = new Date().toISOString();
      return delay(undefined);
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

  overview: () =>
    delay(
      buildOverview(
        {
          contacts: db.contacts,
          companies: db.companies,
          deals: db.deals,
          stages: demoPipeline.stages,
          tasks: db.tasks,
          activities: db.activities,
          currency: CURRENCY,
        },
        new Date(),
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      ),
    ),

  segments: {
    list(): Promise<ListResult<SegmentListItem>> {
      const rows = alive(db.segments).map((segment) => ({ ...segment, memberCount: members(segment).length }));
      return delay(paginate(rows, 1, 100));
    },
    async create(input: SegmentCreateInput) {
      const now = new Date().toISOString();
      const segment: Segment = {
        id: newId("segment"),
        workspaceId: DEMO_WORKSPACE_ID,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        name: input.name,
        description: input.description ?? null,
        rules: input.rules,
        color: input.color ?? "violet",
      };
      db.segments.push(segment);
      return delay(segment);
    },
    async update(id: string, input: SegmentUpdateInput) {
      const index = findSegmentIndex(id);
      db.segments[index] = { ...db.segments[index], ...input, updatedAt: new Date().toISOString() };
      return delay(db.segments[index]);
    },
    async remove(id: string) {
      db.segments[findSegmentIndex(id)].deletedAt = new Date().toISOString();
      return delay(undefined);
    },
    async contacts(id: string, query: Partial<ListQuery> = {}) {
      const rows = sortBy(members(db.segments[findSegmentIndex(id)]), "-lastTouchAt");
      return delay(paginate(rows, query.page, query.pageSize));
    },
  },

  imports: {
    async create(file: File) {
      // The server reads CSV and XLSX. The mock reads CSV only.
      if (!/\.csv$/i.test(file.name)) throw new ApiError("IMPORT_MOCK_CSV_ONLY", 422);
      const { columns, rows } = parseCsv(await readText(file));
      if (rows.length === 0) throw new ApiError("IMPORT_EMPTY", 422);
      if (rows.length > MAX_IMPORT_ROWS) throw new ApiError("IMPORT_TOO_MANY_ROWS", 422);
      const now = new Date().toISOString();
      const job: ImportJob = {
        id: newId("import"),
        workspaceId: DEMO_WORKSPACE_ID,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        fileName: file.name,
        status: "uploaded",
        columns,
        sampleRow: rows[0] ?? null,
        mapping: guessMapping(columns),
        rowsTotal: rows.length,
        rowsAdded: 0,
        rowsUpdated: 0,
        rowsHeld: 0,
        rowsSkipped: 0,
        ownerId: null,
        tag: null,
        duplicateHandling: null,
        error: null,
      };
      db.imports.set(job.id, { job, rows, held: [] });
      return delay({ ...job });
    },
    async get(id: string) {
      return delay({ ...findImport(id).job });
    },
    async saveMapping(id: string, mapping: ImportMapping) {
      const { job } = findImport(id);
      job.mapping = { ...mapping };
      job.updatedAt = new Date().toISOString();
      return delay({ ...job });
    },
    // The first rows, with every row counted.
    async preview(id: string): Promise<ImportPreview> {
      const entry = findImport(id);
      const plan = planImport(entry.rows, entry.job.mapping, alive(db.contacts), alive(db.companies));
      const problems = plan.filter((r) => r.problems.length > 0).length;
      const duplicates = plan.filter((r) => r.duplicateOfContactId).length;
      return delay({
        rowsTotal: plan.length,
        newCount: plan.length - problems - duplicates,
        duplicateCount: duplicates,
        problemCount: problems,
        rows: plan.slice(0, 20),
      });
    },
    async confirm(id: string, input: ImportConfirmInput) {
      const { job } = findImport(id);
      if (job.status !== "uploaded") throw new ApiError("IMPORT_ALREADY_STARTED", 409);
      const options = importConfirmSchema.parse(input);
      Object.assign(job, {
        status: "processing",
        ownerId: options.ownerId ?? CURRENT_USER_ID,
        tag: options.tag ?? null,
        duplicateHandling: options.duplicateHandling,
        updatedAt: new Date().toISOString(),
      });
      setTimeout(() => runImport(id), MOCK_IMPORT_DELAY_MS);
      return delay({ ...job });
    },
    async held(id: string) {
      return delay(paginate(findImport(id).held.filter((r) => r.status === "held"), 1, 100));
    },
    async resolve(id: string, rowId: string, action: ImportResolveAction) {
      const entry = findImport(id);
      const row = entry.held.find((r) => r.id === rowId && r.status === "held");
      if (!row) throw new ApiError("IMPORT_ROW_NOT_FOUND", 404);
      if (action === "create") {
        addImportedContact(row.contact, entry.job.ownerId ?? CURRENT_USER_ID, entry.job.tag);
        row.status = "added";
        entry.job.rowsAdded++;
      } else if (action === "merge") {
        mergeImported(row.duplicateOfContactId, row.contact, "fill", entry.job.tag);
        row.status = "merged";
        entry.job.rowsUpdated++;
      } else {
        row.status = "skipped";
        entry.job.rowsSkipped++;
      }
      entry.job.rowsHeld--;
      return delay({ ...row });
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
