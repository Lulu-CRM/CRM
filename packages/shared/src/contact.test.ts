import { describe, expect, it } from "vitest";
import { companySchema } from "./company";
import { contactCreateSchema, contactListQuerySchema, contactSchema } from "./contact";
import { demoCompanies, demoContacts, demoUsers } from "./fixtures/contacts";
import { demoDeals } from "./fixtures/pipeline";
import { userSchema } from "./user";

describe("contact fixtures", () => {
  it("match the schemas", () => {
    for (const c of demoContacts) expect(contactSchema.parse(c)).toEqual(c);
    for (const c of demoCompanies) expect(companySchema.parse(c)).toEqual(c);
    for (const u of demoUsers) expect(userSchema.parse(u)).toEqual(u);
  });

  it("link to records that exist", () => {
    const companyIds = new Set(demoCompanies.map((c) => c.id));
    const contactIds = new Set(demoContacts.map((c) => c.id));
    const userIds = new Set(demoUsers.map((u) => u.id));
    for (const c of demoContacts) {
      expect(userIds).toContain(c.ownerId);
      if (c.companyId) expect(companyIds).toContain(c.companyId);
    }
    for (const d of demoDeals) {
      expect(userIds).toContain(d.ownerId);
      if (d.contactId) expect(contactIds).toContain(d.contactId);
      if (d.companyId) expect(companyIds).toContain(d.companyId);
    }
  });
});

describe("contactCreateSchema", () => {
  it("needs a name", () => {
    expect(contactCreateSchema.safeParse({ name: "  " }).success).toBe(false);
    expect(contactCreateSchema.safeParse({ name: "Ada" }).success).toBe(true);
  });

  it("rejects a bad email", () => {
    expect(contactCreateSchema.safeParse({ name: "Ada", email: "nope" }).success).toBe(false);
  });
});

describe("contactListQuerySchema", () => {
  it("reads query string values", () => {
    const q = contactListQuerySchema.parse({ page: "2", needsFollowUp: "true", stage: "new" });
    expect(q).toMatchObject({ page: 2, pageSize: 25, needsFollowUp: true, stage: "new" });
  });
});
