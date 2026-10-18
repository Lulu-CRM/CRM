import { describe, expect, it } from "vitest";
import { demoCompanies, demoContacts } from "./fixtures/contacts.js";
import { importConfirmSchema, importMappingSchema } from "./import.js";
import { findDuplicate, guessMapping, mapRow, mergeIntoContact, parseCsv, planImport } from "./import-logic.js";

describe("parseCsv", () => {
  it("reads quoted fields, doubled quotes and line breaks inside quotes", () => {
    const { columns, rows } = parseCsv('name,notes\r\n"Laurent, Sophie","She said ""yes""\nthen left"\r\nDaniel Chen,\r\n');
    expect(columns).toEqual(["name", "notes"]);
    expect(rows).toEqual([
      { name: "Laurent, Sophie", notes: 'She said "yes"\nthen left' },
      { name: "Daniel Chen", notes: "" },
    ]);
  });

  it("detects semicolons (German Excel) and tabs, and drops the byte order mark", () => {
    expect(parseCsv("﻿Name;E-Mail\nTobias Klein;tobias@klarwerk.de").rows).toEqual([
      { Name: "Tobias Klein", "E-Mail": "tobias@klarwerk.de" },
    ]);
    expect(parseCsv("name\temail\nMila\tmila@roamandroot.com").rows[0].email).toBe("mila@roamandroot.com");
  });

  it("skips empty lines and names blank or repeated headers", () => {
    const { columns, rows } = parseCsv("email,,email\n\na@b.co,x,c@d.co\n , , \n");
    expect(columns).toEqual(["email", "column_2", "email_2"]);
    expect(rows).toHaveLength(1);
  });
});

describe("guessMapping", () => {
  it("recognises English, German and Chinese headers and uses each field once", () => {
    expect(guessMapping(["full_name", "work_email", "company", "job_title", "phone", "notes"])).toEqual({
      full_name: "name",
      work_email: "email",
      company: "company",
      job_title: "jobRole",
      phone: "phone",
      notes: "ignore",
    });
    expect(guessMapping(["Vorname", "Nachname", "E-Mail", "Firma"])).toEqual({
      Vorname: "firstName",
      Nachname: "lastName",
      "E-Mail": "email",
      Firma: "company",
    });
    expect(guessMapping(["姓名", "邮箱", "公司"])).toEqual({ 姓名: "name", 邮箱: "email", 公司: "company" });
    expect(guessMapping(["email", "Email Address"])).toEqual({ email: "email", "Email Address": "ignore" });
  });

  it("produces a mapping the API accepts", () => {
    expect(() => importMappingSchema.parse(guessMapping(["name", "x"]))).not.toThrow();
  });
});

describe("mapRow", () => {
  const mapping = guessMapping(["first", "last", "email", "stage", "tags", "company"]);

  it("joins first and last name, lowercases email, reads stage words and splits tags", () => {
    const { contact, problems } = mapRow(
      { first: "Ada", last: "Lovelace", email: "Ada@Example.COM", stage: "Kunde", tags: "VIP; Warm, VIP", company: "Analytical" },
      mapping,
    );
    expect(problems).toEqual([]);
    expect(contact).toMatchObject({ name: "Ada Lovelace", email: "ada@example.com", lifecycleStage: "customer", tags: ["VIP", "Warm"], companyName: "Analytical" });
  });

  it("reports a missing name, a bad email and an unknown stage", () => {
    expect(mapRow({ first: "", last: "", email: "not-an-email", stage: "maybe" }, mapping).problems).toEqual([
      "nameMissing",
      "emailInvalid",
      "stageUnknown",
    ]);
  });
});

describe("findDuplicate", () => {
  const base = { name: "", email: null, phone: null, companyName: null, jobRole: null, source: null, lifecycleStage: null, tags: [] };

  it("matches email first, ignoring case", () => {
    expect(findDuplicate({ ...base, name: "S. L.", email: "SOPHIE@northstar.studio" }, demoContacts, demoCompanies)).toEqual({
      contactId: "contact_sophie",
      match: "email",
    });
  });

  it("then name plus company", () => {
    expect(findDuplicate({ ...base, name: "daniel chen", companyName: "Atlas Logistics" }, demoContacts, demoCompanies)).toEqual({
      contactId: "contact_daniel",
      match: "nameAndCompany",
    });
    // Same name at another company is a different person.
    expect(findDuplicate({ ...base, name: "Daniel Chen", companyName: "Klarwerk GmbH" }, demoContacts, demoCompanies)).toBeNull();
  });

  it("ignores deleted contacts", () => {
    const deleted = demoContacts.map((c) => ({ ...c, deletedAt: "2026-10-17T00:00:00.000Z" }));
    expect(findDuplicate({ ...base, name: "x", email: "sophie@northstar.studio" }, deleted, demoCompanies)).toBeNull();
  });
});

describe("planImport", () => {
  it("handles a 1,000-row file: new rows, duplicates and problems", () => {
    const lines = ["full_name,work_email,company"];
    for (let i = 1; i <= 1000; i++) {
      if (i % 100 === 0) lines.push(`Sophie Laurent ${i},sophie@northstar.studio,Northstar Studio`); // duplicate by email
      else if (i % 250 === 1) lines.push(`,missing${i}@example.com,`); // no name
      else lines.push(`Person ${i},person${i}@example.com,Company ${i % 7}`);
    }
    const { columns, rows } = parseCsv(lines.join("\n"));
    const started = Date.now();
    const plan = planImport(rows, guessMapping(columns), demoContacts, demoCompanies);
    const elapsed = Date.now() - started;

    expect(plan).toHaveLength(1000);
    expect(plan.filter((r) => r.duplicateOfContactId === "contact_sophie")).toHaveLength(10);
    expect(plan.filter((r) => r.problems.includes("nameMissing"))).toHaveLength(4);
    expect(plan.filter((r) => !r.duplicateOfContactId && r.problems.length === 0)).toHaveLength(986);
    expect(plan[0].rowNumber).toBe(1);
    expect(elapsed).toBeLessThan(2000);
  });
});

describe("mergeIntoContact", () => {
  const sophie = demoContacts.find((c) => c.id === "contact_sophie")!;
  const incoming = { name: "Sophie L.", email: "sophie@northstar.studio", phone: "+49 000", companyName: null, jobRole: "CEO", source: null, lifecycleStage: "customer" as const, tags: ["Import", "Warm"] };

  it("fill keeps what the contact has and only adds tags", () => {
    expect(mergeIntoContact(sophie, incoming, "fill", null)).toMatchObject({
      name: "Sophie Laurent",
      phone: sophie.phone,
      jobRole: "Creative Director",
      lifecycleStage: "qualified",
      tags: ["Design", "Warm", "Import"],
    });
  });

  it("overwrite replaces fields the import has", () => {
    expect(mergeIntoContact(sophie, incoming, "overwrite", null)).toMatchObject({
      name: "Sophie L.",
      phone: "+49 000",
      jobRole: "CEO",
      lifecycleStage: "customer",
      companyId: sophie.companyId,
    });
  });
});

describe("importConfirmSchema", () => {
  it("holds duplicates unless told otherwise", () => {
    expect(importConfirmSchema.parse({}).duplicateHandling).toBe("hold");
  });
});
