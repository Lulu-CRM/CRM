import type { Company } from "./company";
import type { Contact, ContactUpdateInput, LifecycleStage } from "./contact";
import type {
  DuplicateMatch,
  ImportedContact,
  ImportField,
  ImportMapping,
  ImportPreviewRow,
  ImportRowProblem,
} from "./import";

// Pure import logic, shared by the API's import.process job and the web app's mock, so the
// preview, the duplicate check and the final import follow the same rules.

// ---------- CSV ----------

/**
 * Reads CSV text: quoted fields, quotes doubled inside quotes, line breaks inside quotes, CRLF or LF,
 * and comma, semicolon or tab as the separator (whichever the header line uses most; Excel in Germany
 * writes semicolons). A UTF-8 byte order mark is dropped. Empty lines are skipped.
 */
export function parseCsv(text: string): { columns: string[]; rows: Record<string, string>[] } {
  const source = text.replace(/^﻿/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const separator = [",", ";", "\t"].reduce((best, s) => (count(firstLine, s) > count(firstLine, best) ? s : best), ",");

  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === "") quoted = true;
    else if (char === separator) {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else field += char;
  }
  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  return tableFromRecords(records);
}

/**
 * A table from rows of cells, the first row being the headers. Shared by CSV and spreadsheet reading,
 * so both get the same rules: empty rows are skipped, blank or repeated headers get a number, cells are trimmed.
 */
export function tableFromRecords(records: string[][]): { columns: string[]; rows: Record<string, string>[] } {
  const nonEmpty = records.filter((r) => r.some((cell) => cell.trim() !== ""));
  const [header = [], ...body] = nonEmpty;
  const columns = uniqueHeaders(header.map((h) => h.trim()));
  const rows = body.map((cells) => Object.fromEntries(columns.map((column, i) => [column, (cells[i] ?? "").trim()])));
  return { columns, rows };
}

function count(text: string, char: string) {
  return text.split(char).length - 1;
}

// Blank or repeated headers get a number, so every column can be mapped on its own.
function uniqueHeaders(headers: string[]) {
  const seen = new Map<string, number>();
  return headers.map((header, i) => {
    const base = header || `column_${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}_${n}`;
  });
}

// ---------- Mapping ----------

const normalise = (header: string) => header.toLocaleLowerCase().replace(/[^a-z0-9À-ɏ一-鿿]/g, "");

// Header names we recognise, in English, German and Chinese.
const synonyms: Record<Exclude<ImportField, "ignore">, string[]> = {
  name: ["name", "fullname", "contactname", "contact", "vollständigername", "姓名", "名字", "联系人"],
  firstName: ["firstname", "givenname", "first", "vorname", "名"],
  lastName: ["lastname", "surname", "familyname", "last", "nachname", "姓"],
  email: ["email", "emailaddress", "workemail", "mail", "e-mail", "emailadresse", "邮箱", "电子邮件", "邮件"],
  phone: ["phone", "phonenumber", "mobile", "telephone", "tel", "telefon", "handy", "电话", "手机"],
  company: ["company", "companyname", "organisation", "organization", "account", "firma", "unternehmen", "公司"],
  jobRole: ["jobtitle", "title", "role", "position", "job", "rolle", "funktion", "职位", "职务"],
  source: ["source", "leadsource", "quelle", "来源"],
  lifecycleStage: ["stage", "lifecyclestage", "status", "phase", "阶段", "状态"],
  tags: ["tags", "tag", "labels", "schlagwörter", "标签"],
};

/** A first guess at which Lulu field each column feeds. Each field is used at most once. */
export function guessMapping(columns: string[]): ImportMapping {
  const used = new Set<ImportField>();
  const mapping: ImportMapping = {};
  for (const column of columns) {
    const key = normalise(column);
    const field = (Object.keys(synonyms) as Exclude<ImportField, "ignore">[]).find(
      (f) => !used.has(f) && synonyms[f].some((s) => normalise(s) === key),
    );
    mapping[column] = field ?? "ignore";
    if (field) used.add(field);
  }
  return mapping;
}

// ---------- Rows ----------

const stageWords: Record<string, LifecycleStage> = {
  new: "new",
  lead: "new",
  neu: "new",
  qualified: "qualified",
  qualifiziert: "qualified",
  followup: "follow_up",
  nachfassen: "follow_up",
  customer: "customer",
  client: "customer",
  kunde: "customer",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** One source row as a contact, with what is wrong with it. */
export function mapRow(raw: Record<string, string>, mapping: ImportMapping): { contact: ImportedContact; problems: ImportRowProblem[] } {
  const value = (field: ImportField) => {
    const column = Object.keys(mapping).find((c) => mapping[c] === field);
    const text = column ? (raw[column] ?? "").trim() : "";
    return text === "" ? null : text;
  };
  const problems: ImportRowProblem[] = [];

  const name = value("name") ?? ([value("firstName"), value("lastName")].filter(Boolean).join(" ") || null);
  if (!name) problems.push("nameMissing");

  const email = value("email")?.toLocaleLowerCase() ?? null;
  if (email && !EMAIL.test(email)) problems.push("emailInvalid");

  const stageText = value("lifecycleStage");
  const lifecycleStage = stageText ? (stageWords[normalise(stageText)] ?? null) : null;
  if (stageText && !lifecycleStage) problems.push("stageUnknown");

  const tags = (value("tags") ?? "")
    .split(/[,;|]/)
    .map((tag) => tag.trim())
    .filter(Boolean);

  return {
    contact: {
      name: name ?? "",
      email,
      phone: value("phone"),
      companyName: value("company"),
      jobRole: value("jobRole"),
      source: value("source"),
      lifecycleStage,
      tags: [...new Set(tags)],
    },
    problems,
  };
}

// ---------- Duplicates ----------

const same = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/**
 * Finds an existing contact this row may duplicate: same email first, then same name at the same company
 * (docs/data-model.md, "Duplicates"). Rows are checked against contacts already in the workspace,
 * not against each other.
 */
export function findDuplicate(
  contact: ImportedContact,
  existing: Contact[],
  companies: Company[],
): { contactId: string; match: DuplicateMatch } | null {
  const live = existing.filter((c) => !c.deletedAt);
  if (contact.email) {
    const byEmail = live.find((c) => same(c.email, contact.email));
    if (byEmail) return { contactId: byEmail.id, match: "email" };
  }
  if (contact.name && contact.companyName) {
    const companyIds = new Set(companies.filter((co) => same(co.name, contact.companyName)).map((co) => co.id));
    const byName = live.find((c) => same(c.name, contact.name) && c.companyId !== null && companyIds.has(c.companyId));
    if (byName) return { contactId: byName.id, match: "nameAndCompany" };
  }
  return null;
}

/** Every row of a file, mapped and checked. Row numbers count data rows from 1. */
export function planImport(
  rows: Record<string, string>[],
  mapping: ImportMapping,
  existing: Contact[],
  companies: Company[],
): ImportPreviewRow[] {
  return rows.map((raw, i) => {
    const { contact, problems } = mapRow(raw, mapping);
    const duplicate = problems.length === 0 ? findDuplicate(contact, existing, companies) : null;
    return {
      rowNumber: i + 1,
      contact,
      problems,
      duplicateOfContactId: duplicate?.contactId ?? null,
      duplicateMatch: duplicate?.match ?? null,
    };
  });
}

/**
 * The edit that merges an imported row into an existing contact. "fill" (resolving a held duplicate
 * with merge) only fills empty fields; "overwrite" (duplicate handling "update") replaces them.
 * Tags are always added, never removed.
 */
export function mergeIntoContact(
  existing: Contact,
  incoming: ImportedContact,
  mode: "fill" | "overwrite",
  companyId: string | null,
): ContactUpdateInput {
  const pick = <T>(current: T | null, next: T | null) => (mode === "overwrite" ? (next ?? current) : (current ?? next));
  return {
    name: mode === "overwrite" && incoming.name ? incoming.name : existing.name,
    email: pick(existing.email, incoming.email),
    phone: pick(existing.phone, incoming.phone),
    companyId: pick(existing.companyId, companyId),
    jobRole: pick(existing.jobRole, incoming.jobRole),
    source: pick(existing.source, incoming.source),
    lifecycleStage: mode === "overwrite" && incoming.lifecycleStage ? incoming.lifecycleStage : existing.lifecycleStage,
    tags: [...new Set([...existing.tags, ...incoming.tags])],
  };
}
