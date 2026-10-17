import { describe, expect, it } from "vitest";
import { dealCreateSchema, dealListQuerySchema, dealUpdateSchema } from "./deal";

describe("dealCreateSchema", () => {
  it("accepts the smallest valid deal", () => {
    expect(dealCreateSchema.parse({ name: "Atlas rollout", value: 42500, stageId: "stage_new" })).toEqual({
      name: "Atlas rollout",
      value: 42500,
      stageId: "stage_new",
    });
  });

  it("rejects money stored as text", () => {
    expect(dealCreateSchema.safeParse({ name: "X", value: "€24,000", stageId: "s" }).success).toBe(false);
  });

  it("rejects a currency that is not an ISO code", () => {
    expect(dealCreateSchema.safeParse({ name: "X", value: 1, currency: "€", stageId: "s" }).success).toBe(false);
  });

  it("rejects negative values and probabilities outside 0 to 1", () => {
    expect(dealCreateSchema.safeParse({ name: "X", value: -1, stageId: "s" }).success).toBe(false);
    expect(dealCreateSchema.safeParse({ name: "X", value: 1, stageId: "s", probability: 70 }).success).toBe(false);
  });

  it("rejects dates without a time zone", () => {
    expect(
      dealCreateSchema.safeParse({ name: "X", value: 1, stageId: "s", expectedCloseAt: "28 Oct" }).success,
    ).toBe(false);
  });

  it("does not take a workspace from the body", () => {
    const parsed = dealCreateSchema.parse({ name: "X", value: 1, stageId: "s", workspaceId: "other" });
    expect(parsed).not.toHaveProperty("workspaceId");
  });
});

describe("dealUpdateSchema", () => {
  it("does not change the stage (that goes through /move)", () => {
    expect(dealUpdateSchema.parse({ stageId: "stage_won", value: 10 })).toEqual({ value: 10 });
  });
});

describe("dealListQuerySchema", () => {
  it("reads numbers from the query string and applies defaults", () => {
    expect(dealListQuerySchema.parse({ page: "2", status: "open" })).toEqual({
      page: 2,
      pageSize: 25,
      status: "open",
    });
  });

  it("caps the page size at 100", () => {
    expect(dealListQuerySchema.safeParse({ pageSize: "500" }).success).toBe(false);
  });
});
