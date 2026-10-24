import { describe, expect, it } from "vitest";
import { companySchema } from "./company";
import { belongsTo, contactCreateSchema, contactListQuerySchema, contactSchema, withCompanyLink, withMainCompany } from "./contact";
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

describe("company links (Dave, Oct 24, 2026)", () => {
  const none = { companyId: null, companyIds: [] };
  const two = { companyId: "a", companyIds: ["a", "b"] };

  it("links a first company as the main one, and later ones after it", () => {
    expect(withCompanyLink(none, "a", true)).toEqual({ companyId: "a", companyIds: ["a"] });
    expect(withCompanyLink({ companyId: "a", companyIds: ["a"] }, "b", true)).toEqual(two);
    expect(withCompanyLink(two, "b", true)).toEqual(two);
  });

  it("unlinks a company and promotes the next one when it was the main one", () => {
    expect(withCompanyLink(two, "b", false)).toEqual({ companyId: "a", companyIds: ["a"] });
    expect(withCompanyLink(two, "a", false)).toEqual({ companyId: "b", companyIds: ["b"] });
    expect(withCompanyLink({ companyId: "a", companyIds: ["a"] }, "a", false)).toEqual(none);
  });

  it("replaces the main company and keeps the others; clearing it drops only the main one", () => {
    expect(withMainCompany(two, "c")).toEqual({ companyId: "c", companyIds: ["c", "b"] });
    expect(withMainCompany(two, "b")).toEqual({ companyId: "b", companyIds: ["b"] });
    expect(withMainCompany(two, null)).toEqual({ companyId: "b", companyIds: ["b"] });
    // Older rows may have a main company without the list.
    expect(withMainCompany({ companyId: "a", companyIds: [] }, "c")).toEqual({ companyId: "c", companyIds: ["c"] });
  });

  it("counts a person as belonging to their main and their other companies", () => {
    expect(belongsTo(two, "b")).toBe(true);
    expect(belongsTo({ companyId: "a", companyIds: [] }, "a")).toBe(true);
    expect(belongsTo(two, "c")).toBe(false);
  });
});
