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
  aiAcceptSchema,
  simulateCompanyNotes,
  simulateInsight,
  aiSettingsSchema,
  consentSettingsSchema,
  customFieldCreateSchema,
  defaultAiSettings,
  defaultConsentSettings,
  defaultNotificationSettings,
  defaultPermissions,
  notificationSettingsSchema,
  rolePermissionsSchema,
  guessMapping,
  importConfirmSchema,
  mergeIntoContact,
  withCompanyLink,
  withMainCompany,
  withCompanies,
  belongsTo,
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
  type CompanyContactsInput,
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
  type AuthSession,
  type LoginInput,
  type AiAcceptInput,
  type AiInsight,
  type AiRun,
  type AiSettings,
  type ConsentSettings,
  type CustomField,
  type CustomFieldCreateInput,
  type CustomFieldUpdateInput,
  type NotificationSettings,
  type RolePermissions,
  type Stage,
  type StageCreateInput,
  type StageUpdateInput,
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
  pipeline: structuredClone(demoPipeline),
  customFields: [] as CustomField[],
  permissions: structuredClone(defaultPermissions),
  consent: { ...defaultConsentSettings },
  notifications: structuredClone(defaultNotificationSettings),
  ai: { ...defaultAiSettings },
  aiInsights: [] as AiInsight[],
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
  summarizeCompany(company, alive(db.contacts), alive(db.deals), liveStages(), CURRENCY);

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
    stages: liveStages(),
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
    aiNotesUpdatedAt: null,
    leadStatus: null,
    whatsapp: null,
    instagram: null,
    facebook: null,
    productService: null,
    aiNotes: null,
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
    ...withMainCompany({ companyId: null, companyIds: [] }, companyIdFor(incoming.companyName, ownerId)),
    jobRole: incoming.jobRole,
    language: null,
    country: null,
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
  const { companyId, ...edit } = mergeIntoContact(contact, withTag, mode, companyIdFor(incoming.companyName, contact.ownerId));
  Object.assign(contact, edit, companyId === undefined ? {} : withMainCompany(contact, companyId), {
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

// ---------- Settings ----------

const now = () => new Date().toISOString();

// Stages in order, without deleted ones.
function liveStages() {
  return alive(db.pipeline.stages).sort((a, b) => a.order - b.order);
}

// Open stages first in their order, then won, then lost; numbered from 0 again.
function renumberStages() {
  const live = liveStages();
  const open = live.filter((s) => s.type === "open");
  const rank = (type: string) => (type === "won" ? 0 : 1);
  const closed = live.filter((s) => s.type !== "open").sort((a, b) => rank(a.type) - rank(b.type));
  [...open, ...closed].forEach((stage, index) => {
    stage.order = index;
  });
}

function findStage(id: string) {
  const stage = liveStages().find((s) => s.id === id);
  if (!stage) throw new ApiError("STAGE_NOT_FOUND", 404);
  return stage;
}

function findField(id: string) {
  const field = alive(db.customFields).find((f) => f.id === id);
  if (!field) throw new ApiError("CUSTOM_FIELD_NOT_FOUND", 404);
  return field;
}

// ---------- AI analysis (stands in for the API's ai.analyze job and the simulated provider) ----------

export const MOCK_AI_DELAY_MS = 500;

function findInsight(id: string) {
  const insight = alive(db.aiInsights).find((i) => i.id === id);
  if (!insight) throw new ApiError("AI_INSIGHT_NOT_FOUND", 404);
  if (insight.status !== "suggested") throw new ApiError("AI_INSIGHT_CLOSED", 409);
  return insight;
}

export const mockApi = {
  // Mock sign-in: any demo user's email with any password (sample data only, never real accounts).
  auth: {
    async login(input: LoginInput): Promise<AuthSession> {
      const user = demoUsers.find((u) => u.email === input.email.trim().toLowerCase());
      if (!user || !input.password) throw new ApiError("UNAUTHORIZED", 401);
      return delay({ token: `mock-${user.id}`, expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() });
    },
    async logout() {
      return delay(undefined);
    },
  },

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
        if (query.companyId && !belongsTo(c, query.companyId)) return false;
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
        ...(input.companyIds !== undefined
          ? withCompanies(input.companyIds)
          : { companyId: input.companyId ?? null, companyIds: input.companyId ? [input.companyId] : [] }),
        jobRole: input.jobRole ?? null,
        language: input.language ?? null,
        country: input.country ?? null,
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
      const { companyId, companyIds, ...edit } = input;
      // Same rules as the server: companyIds replaces the links; companyId alone replaces the main company.
      const links =
        companyIds !== undefined ? withCompanies(companyIds) : companyId === undefined ? {} : withMainCompany(contact, companyId);
      Object.assign(contact, edit, links, {
        updatedAt: new Date().toISOString(),
      });
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
      delay(companyDetail(findCompany(id), alive(db.contacts), alive(db.deals), liveStages(), CURRENCY)),
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
        leadStatus: input.leadStatus ?? null,
        whatsapp: input.whatsapp ?? null,
        instagram: input.instagram ?? null,
        facebook: input.facebook ?? null,
        productService: input.productService ?? null,
        aiNotes: null,
        aiNotesUpdatedAt: null,
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
    // Same rules as the server: listed contacts are linked, the others unlinked (Dave, Oct 24, 2026).
    async setContacts(id: string, input: CompanyContactsInput) {
      const company = findCompany(id);
      const wanted = new Set(input.contactIds);
      if (input.contactIds.some((contactId) => !alive(db.contacts).some((c) => c.id === contactId))) {
        throw new ApiError("VALIDATION_ERROR", 400);
      }
      for (const contact of alive(db.contacts)) {
        if (wanted.has(contact.id) || belongsTo(contact, company.id)) {
          Object.assign(contact, withCompanyLink(contact, company.id, wanted.has(contact.id)));
        }
      }
      return delay(companyDetail(company, alive(db.contacts), alive(db.deals), liveStages(), CURRENCY));
    },
    // Same rules as the server's ai.company_notes job, run after a short delay like a background job.
    async aiNotes(id: string): Promise<AiRun> {
      const company = findCompany(id);
      setTimeout(() => {
        const records = (r: { recordType: string | null; recordId: string | null }) =>
          (r.recordType === "company" && r.recordId === company.id) ||
          (r.recordType === "contact" && alive(db.contacts).some((c) => c.id === r.recordId && belongsTo(c, company.id)));
        company.aiNotes = simulateCompanyNotes({
          company,
          contacts: alive(db.contacts).filter((c) => belongsTo(c, company.id)),
          deals: alive(db.deals),
          stages: liveStages(),
          tasks: alive(db.tasks).filter(records),
          notes: alive(db.notes).filter((n) => n.visibility === "shared" && records(n)),
          activities: db.activities.filter(records),
          now: new Date(),
          language: "en",
        });
        company.aiNotesUpdatedAt = new Date().toISOString();
      }, MOCK_AI_DELAY_MS);
      return delay({ jobId: newId("job"), status: "queued" });
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
    async remove(id: string) {
      const task = db.tasks.find((t) => t.id === id && !t.deletedAt);
      if (!task) throw new ApiError("TASK_NOT_FOUND", 404);
      task.deletedAt = new Date().toISOString();
      return delay(undefined);
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
          stages: liveStages(),
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

  settings: {
    customFields: {
      list: () => delay(paginate(alive(db.customFields), 1, 100)),
      async create(input: CustomFieldCreateInput) {
        const parsed = customFieldCreateSchema.parse(input);
        if (alive(db.customFields).some((f) => f.key === parsed.key)) throw new ApiError("CUSTOM_FIELD_KEY_TAKEN", 409);
        const field: CustomField = {
          id: newId("field"),
          workspaceId: DEMO_WORKSPACE_ID,
          createdAt: now(),
          updatedAt: now(),
          deletedAt: null,
          entity: "contact",
          ...parsed,
        };
        db.customFields.push(field);
        return delay(field);
      },
      async update(id: string, input: CustomFieldUpdateInput) {
        const field = findField(id);
        Object.assign(field, input, { updatedAt: now() });
        return delay({ ...field });
      },
      async remove(id: string) {
        findField(id).deletedAt = now();
        return delay(undefined);
      },
    },
    stages: {
      async create(input: StageCreateInput) {
        const stage: Stage = {
          id: newId("stage"),
          workspaceId: DEMO_WORKSPACE_ID,
          createdAt: now(),
          updatedAt: now(),
          deletedAt: null,
          pipelineId: input.pipelineId,
          key: null,
          name: input.name,
          // After the last open stage; renumberStages keeps won and lost at the end.
          order: liveStages().filter((s) => s.type === "open").length - 0.5,
          probability: input.probability,
          type: "open",
        };
        db.pipeline.stages.push(stage);
        renumberStages();
        return delay({ ...stage });
      },
      async update(id: string, input: StageUpdateInput) {
        const stage = findStage(id);
        if (input.name !== undefined && input.name !== stage.name) {
          stage.name = input.name;
          // A renamed default stage shows the new name in every language.
          stage.key = null;
        }
        if (input.probability !== undefined) stage.probability = input.probability;
        if (input.order !== undefined && stage.type === "open") {
          const open = liveStages().filter((s) => s.type === "open" && s.id !== id);
          open.splice(Math.min(input.order, open.length), 0, stage);
          open.forEach((s, index) => {
            s.order = index;
          });
          renumberStages();
        }
        stage.updatedAt = now();
        return delay({ ...stage });
      },
      async remove(id: string) {
        const stage = findStage(id);
        // Every pipeline keeps its won and lost stage, and a stage with deals cannot go.
        if (stage.type !== "open") throw new ApiError("STAGE_LOCKED", 409);
        if (alive(db.deals).some((d) => d.stageId === id)) throw new ApiError("STAGE_IN_USE", 409);
        stage.deletedAt = now();
        renumberStages();
        return delay(undefined);
      },
    },
    roles: {
      get: () => delay(structuredClone(db.permissions)),
      async put(input: RolePermissions) {
        db.permissions = rolePermissionsSchema.parse(input);
        return delay(structuredClone(db.permissions));
      },
    },
    consent: {
      get: () => delay({ ...db.consent }),
      async put(input: ConsentSettings) {
        db.consent = consentSettingsSchema.parse(input);
        return delay({ ...db.consent });
      },
    },
    notifications: {
      get: () => delay(structuredClone(db.notifications)),
      async put(input: NotificationSettings) {
        db.notifications = notificationSettingsSchema.parse(input);
        return delay(structuredClone(db.notifications));
      },
    },
    ai: {
      get: () => delay({ ...db.ai }),
      async put(input: AiSettings) {
        db.ai = aiSettingsSchema.parse(input);
        return delay({ ...db.ai });
      },
    },
  },

  ai: {
    async run(contactId: string): Promise<AiRun> {
      const contact = findContact(contactId);
      const jobId = newId("job");
      setTimeout(() => {
        const content = simulateInsight({
          contact,
          company: alive(db.companies).find((c) => c.id === contact.companyId) ?? null,
          tasks: alive(db.tasks),
          deals: alive(db.deals),
          stages: liveStages(),
          now: new Date(),
          language: "en",
        });
        db.aiInsights.push({
          id: newId("insight"),
          workspaceId: DEMO_WORKSPACE_ID,
          createdAt: now(),
          updatedAt: now(),
          deletedAt: null,
          contactId,
          status: "suggested",
          ...content,
        });
      }, MOCK_AI_DELAY_MS);
      return delay({ jobId, status: "queued" });
    },
    // The newest insight for a contact, or null.
    async latest(contactId: string): Promise<AiInsight | null> {
      findContact(contactId);
      const insights = alive(db.aiInsights).filter((i) => i.contactId === contactId);
      return delay(insights.length ? { ...insights[insights.length - 1] } : null);
    },
    // Saves only what the user ticked. This is the only way an insight changes a record.
    async accept(id: string, input: AiAcceptInput) {
      const insight = findInsight(id);
      const options = aiAcceptSchema.parse(input);
      const contact = findContact(insight.contactId);
      if (options.createTask && insight.suggestedTask) {
        await mockApi.tasks.create({
          title: options.taskTitle!,
          dueAt: insight.suggestedTask.dueAt,
          ownerId: contact.ownerId,
          recordType: "contact",
          recordId: contact.id,
        });
      }
      if (options.applyStage && insight.suggestedStage) {
        Object.assign(contact, { lifecycleStage: insight.suggestedStage, updatedAt: now() });
      }
      Object.assign(insight, { status: "accepted", updatedAt: now() });
      return delay({ ...insight });
    },
    async dismiss(id: string) {
      Object.assign(findInsight(id), { status: "dismissed", updatedAt: now() });
      return delay(undefined);
    },
  },

  pipelines: () => delay([{ ...db.pipeline, stages: liveStages() }]),

  deals: {
    list: () => delay(paginate(alive(db.deals), 1, 100)),
    summary: () => delay(summarizeDeals(alive(db.deals), liveStages(), CURRENCY)),
    async create(input: DealCreateInput) {
      const stage = liveStages().find((s) => s.id === input.stageId);
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
      const moved: Deal = moveDeal(db.deals[index], stageId, liveStages());
      db.deals[index] = moved;
      return delay(moved);
    },
  },
};
