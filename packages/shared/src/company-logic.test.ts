import { describe, expect, it } from "vitest";
import { companyCreateSchema, companyDetailSchema, companyListItemSchema } from "./company.js";
import { companyDetail, companyHealth, summarizeCompany } from "./company-logic.js";
import type { Deal } from "./deal.js";
import { demoCompanies, demoContacts } from "./fixtures/contacts.js";
import { demoDeals, demoStages } from "./fixtures/pipeline.js";

const NOW = new Date("2026-10-18T12:00:00.000Z");
const company = (id: string) => demoCompanies.find((c) => c.id === id)!;
const summary = (id: string, deals: Deal[] = demoDeals) =>
  summarizeCompany(company(id), demoContacts, deals, demoStages, "EUR", NOW);
const deal = (fields: Partial<Deal>): Deal => ({ ...demoDeals[0], companyId: "company_haus", ...fields });

describe("summarizeCompany", () => {
  it("counts people and open deal value from the data", () => {
    const atlas = summary("company_atlas");
    expect(companyListItemSchema.parse(atlas)).toEqual(atlas);
    expect(atlas.contactCount).toBe(1);
    expect(atlas.openDealValue).toEqual({ amount: 42500, currency: "EUR" });
    expect(atlas.openDealCount).toBe(1);
    expect(atlas.lastTouchAt).toBe("2026-10-16T16:18:00.000Z");
  });

  it("leaves out closed, deleted and other-currency deals, and counts the other currency", () => {
    const deals = [
      deal({ id: "a", value: 1000.1, stageId: "stage_proposal" }),
      deal({ id: "b", value: 2000.2, stageId: "stage_new" }),
      deal({ id: "c", value: 5000, stageId: "stage_won", closedAt: NOW.toISOString() }),
      deal({ id: "d", value: 7000, deletedAt: NOW.toISOString() }),
      deal({ id: "e", value: 9000, currency: "USD" }),
    ];
    const haus = summary("company_haus", deals);
    expect(haus.openDealValue.amount).toBe(3000.3);
    expect(haus.openDealCount).toBe(3);
    expect(haus.otherCurrencyDeals).toBe(1);
  });

  it("has no last touch and zero value for a company with nobody linked", () => {
    const empty = summarizeCompany({ ...company("company_haus"), id: "company_empty" }, demoContacts, demoDeals, demoStages, "EUR", NOW);
    expect(empty.contactCount).toBe(0);
    expect(empty.lastTouchAt).toBeNull();
    expect(empty.openDealValue.amount).toBe(0);
    expect(empty.health).toBe("new");
  });
});

describe("companyHealth", () => {
  it("matches the design for the sample companies", () => {
    expect(summary("company_northstar").health).toBe("strong");
    expect(summary("company_atlas").health).toBe("strong");
    expect(summary("company_roam").health).toBe("watch");
    expect(summary("company_klarwerk").health).toBe("new");
    expect(summary("company_haus").health).toBe("new");
  });

  it("drops a strong account to watch when nobody was touched for a month", () => {
    const deals = [deal({ stageId: "stage_proposal", probability: 0.7 })];
    expect(companyHealth(deals, demoStages, "2026-10-01T00:00:00.000Z", NOW)).toBe("strong");
    expect(companyHealth(deals, demoStages, "2026-09-01T00:00:00.000Z", NOW)).toBe("watch");
    expect(companyHealth(deals, demoStages, null, NOW)).toBe("watch");
  });

  it("counts a won deal as strong and ignores lost ones", () => {
    const touched = "2026-10-15T00:00:00.000Z";
    expect(companyHealth([deal({ stageId: "stage_won", probability: 1 })], demoStages, touched, NOW)).toBe("strong");
    expect(companyHealth([deal({ stageId: "stage_lost", probability: 0 })], demoStages, touched, NOW)).toBe("new");
  });
});

describe("companyDetail", () => {
  it("lists the company's people and deals", () => {
    const detail = companyDetail(company("company_northstar"), demoContacts, demoDeals, demoStages, "EUR", NOW);
    expect(companyDetailSchema.parse(detail)).toEqual(detail);
    expect(detail.contacts.map((c) => c.id)).toEqual(["contact_sophie"]);
    expect(detail.deals.map((d) => d.id)).toEqual(["deal_northstar"]);
  });
});

describe("companyCreateSchema", () => {
  it("needs a name", () => {
    expect(companyCreateSchema.safeParse({ name: " " }).success).toBe(false);
    expect(companyCreateSchema.safeParse({ name: "Acme" }).success).toBe(true);
  });

  it("takes a bare domain and a known size only", () => {
    expect(companyCreateSchema.parse({ name: "Acme", domain: " Acme.COM " }).domain).toBe("acme.com");
    expect(companyCreateSchema.safeParse({ name: "Acme", domain: "https://acme.com" }).success).toBe(false);
    expect(companyCreateSchema.safeParse({ name: "Acme", domain: "acme" }).success).toBe(false);
    expect(companyCreateSchema.safeParse({ name: "Acme", size: "11-50" }).success).toBe(true);
    expect(companyCreateSchema.safeParse({ name: "Acme", size: "lots" }).success).toBe(false);
  });
});
