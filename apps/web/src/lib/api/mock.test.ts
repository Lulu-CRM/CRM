import { beforeEach, describe, expect, it, vi } from "vitest";
import { contactSchema, dealSchema, dealSummarySchema } from "@lulu/shared";

// Fresh copy of the in-memory data for every test.
let mockApi: typeof import("./mock").mockApi;
beforeEach(async () => {
  vi.resetModules();
  ({ mockApi } = await import("./mock"));
});

describe("mock contacts", () => {
  it("lists the design's sample contacts, newest touch first", async () => {
    const result = await mockApi.contacts.list();
    expect(result.meta).toEqual({ page: 1, pageSize: 25, total: 5 });
    expect(result.data[0].name).toBe("Sophie Laurent");
    result.data.forEach((c) => contactSchema.parse(c));
  });

  it("searches name, email, company and tags", async () => {
    expect((await mockApi.contacts.list({ q: "atlas" })).data.map((c) => c.name)).toEqual(["Daniel Chen"]);
    expect((await mockApi.contacts.list({ q: "vip" })).meta.total).toBe(1);
    expect((await mockApi.contacts.list({ q: "nobody" })).meta.total).toBe(0);
  });

  it("filters by stage, owner and follow-up", async () => {
    expect((await mockApi.contacts.list({ stage: "qualified" })).meta.total).toBe(2);
    expect((await mockApi.contacts.list({ ownerId: "user_alex" })).meta.total).toBe(2);
    expect((await mockApi.contacts.list({ needsFollowUp: true })).data[0].name).toBe("Tobias Klein");
  });

  it("pages", async () => {
    const page2 = await mockApi.contacts.list({ page: 2, pageSize: 2 });
    expect(page2.data).toHaveLength(2);
    expect(page2.meta).toEqual({ page: 2, pageSize: 2, total: 5 });
  });

  it("creates, edits, converts and soft deletes", async () => {
    const created = await mockApi.contacts.create({ name: "Ada Lovelace", email: "ada@example.com" });
    expect(contactSchema.parse(created).lifecycleStage).toBe("new");
    expect((await mockApi.contacts.update(created.id, { jobRole: "Engineer" })).jobRole).toBe("Engineer");
    expect((await mockApi.contacts.convert(created.id)).lifecycleStage).toBe("customer");
    await mockApi.contacts.remove(created.id);
    await expect(mockApi.contacts.get(created.id)).rejects.toMatchObject({ code: "CONTACT_NOT_FOUND" });
    expect((await mockApi.contacts.list()).meta.total).toBe(5);
  });
});

describe("mock deals", () => {
  it("moving a deal changes the summary", async () => {
    const before = dealSummarySchema.parse(await mockApi.deals.summary());
    const deal = (await mockApi.deals.list()).data.find((d) => !d.closedAt)!;
    await mockApi.deals.move(deal.id, "stage_won");
    const after = await mockApi.deals.summary();
    expect(after.activeDeals).toBe(before.activeDeals - 1);
    expect(after.openValue.amount).toBe(before.openValue.amount - deal.value);
  });

  it("creates a deal with the stage's probability and the workspace currency", async () => {
    const deal = await mockApi.deals.create({ name: "Pilot", value: 5000, stageId: "stage_proposal" });
    expect(dealSchema.parse(deal)).toMatchObject({ probability: 0.7, currency: "EUR", closedAt: null });
    expect((await mockApi.deals.summary()).openValue.amount).toBe(97900 + 5000);
  });

  it("creating a deal in a won stage closes it", async () => {
    const deal = await mockApi.deals.create({ name: "Done", value: 1, stageId: "stage_won" });
    expect(deal.closedAt).not.toBeNull();
  });

  it("rejects a deal in an unknown stage", async () => {
    await expect(mockApi.deals.create({ name: "X", value: 1, stageId: "stage_nope" })).rejects.toMatchObject({
      code: "STAGE_NOT_FOUND",
    });
  });

  it("edits and soft deletes a deal", async () => {
    expect((await mockApi.deals.update("deal_roam", { value: 20000 })).value).toBe(20000);
    await mockApi.deals.remove("deal_roam");
    expect((await mockApi.deals.list()).data.map((d) => d.id)).not.toContain("deal_roam");
    await expect(mockApi.deals.update("deal_roam", { value: 1 })).rejects.toMatchObject({ code: "DEAL_NOT_FOUND" });
  });

  it("rejects an unknown deal", async () => {
    await expect(mockApi.deals.move("deal_nope", "stage_won")).rejects.toMatchObject({ code: "DEAL_NOT_FOUND" });
  });
});

describe("mock companies", () => {
  it("adds contact counts and open deal value", async () => {
    const atlas = (await mockApi.companies.list()).data.find((c) => c.id === "company_atlas")!;
    expect(atlas.contactCount).toBe(1);
    expect(atlas.openDealValue.currency).toBe("EUR");
  });

  it("sorts by open deal value and searches name, domain and industry", async () => {
    const all = await mockApi.companies.list();
    expect(all.data.map((c) => c.id).slice(0, 2)).toEqual(["company_atlas", "company_northstar"]);
    expect((await mockApi.companies.list({ q: "klarwerk.de" })).data.map((c) => c.id)).toEqual(["company_klarwerk"]);
    expect((await mockApi.companies.list({ q: "hospitality" })).meta.total).toBe(1);
    expect((await mockApi.companies.list({ sort: "name" })).data[0].name).toBe("Atlas Logistics");
    expect((await mockApi.companies.list({ ownerId: "user_alex" })).meta.total).toBe(2);
  });

  it("creates, edits, shows and deletes a company", async () => {
    const created = await mockApi.companies.create({ name: "Acme", domain: "acme.com", size: "1-10" });
    expect(created).toMatchObject({ contactCount: 0, health: "new", ownerId: "user_jamie" });
    await mockApi.companies.update(created.id, { industry: "Retail" });
    const detail = await mockApi.companies.get(created.id);
    expect(detail).toMatchObject({ industry: "Retail", contacts: [], deals: [] });
    await mockApi.companies.remove(created.id);
    await expect(mockApi.companies.get(created.id)).rejects.toMatchObject({ code: "COMPANY_NOT_FOUND" });
  });

  it("returns a company's people and deals", async () => {
    const detail = await mockApi.companies.get("company_northstar");
    expect(detail.contacts.map((c) => c.name)).toEqual(["Sophie Laurent"]);
    expect(detail.deals.map((d) => d.id)).toEqual(["deal_northstar"]);
  });
});
