import { describe, expect, it } from "vitest";
import { aiAcceptSchema, aiInsightSchema } from "./ai";
import { dataQuality, simulateInsight, simulatedProvider, type AiContext } from "./ai-logic";
import { demoCompanies, demoContacts } from "./fixtures/contacts";
import { demoDeals, demoStages } from "./fixtures/pipeline";
import { demoTasks } from "./fixtures/tasks";

const NOW = new Date("2026-10-17T10:00:00.000Z");
const contact = (id: string) => demoContacts.find((c) => c.id === id)!;
const context = (id: string, overrides: Partial<AiContext> = {}): AiContext => ({
  contact: contact(id),
  company: demoCompanies.find((c) => c.id === contact(id).companyId) ?? null,
  tasks: demoTasks(NOW),
  deals: demoDeals,
  stages: demoStages,
  now: NOW,
  language: "en",
  ...overrides,
});

describe("dataQuality", () => {
  it("scores the five checked fields", () => {
    expect(dataQuality(contact("contact_sophie"))).toEqual({ score: 1, missing: [] });
    expect(dataQuality({ ...contact("contact_sophie"), phone: null, source: null })).toEqual({ score: 0.6, missing: ["phone", "source"] });
  });
});

describe("simulateInsight", () => {
  it("returns content that fits the insight schema", async () => {
    const content = await simulatedProvider.analyze(context("contact_sophie"));
    const now = NOW.toISOString();
    expect(() =>
      aiInsightSchema.parse({ ...content, id: "i", workspaceId: "w", createdAt: now, updatedAt: now, deletedAt: null, contactId: "contact_sophie", status: "suggested" }),
    ).not.toThrow();
  });

  it("asks to finish a task that is due before anything else", () => {
    // Sophie's proposal task is due today.
    const insight = simulateInsight(context("contact_sophie"));
    expect(insight.nextStep.title).toEqual({ key: "nextFinishTask", params: {} });
    expect(insight.nextStep.detail).toEqual({ key: "nextFinishTaskDetail", params: { task: "Send proposal to Sophie Laurent" } });
    expect(insight.suggestedTask).toBeNull();
  });

  it("follows up an open deal", () => {
    const insight = simulateInsight(context("contact_tobias"));
    expect(insight.summary).toMatchObject({ key: "summaryDeal", params: { deal: "Klarwerk finance workspace" } });
    expect(insight.suggestedTask).toEqual({
      title: { key: "taskFollowUpDeal", params: { name: "Tobias Klein", deal: "Klarwerk finance workspace" } },
      dueAt: "2026-10-19T12:00:00.000Z",
    });
  });

  it("suggests qualifying a new, active lead", () => {
    const insight = simulateInsight(context("contact_mila", { deals: [] }));
    expect(insight.suggestedStage).toBe("qualified");
    expect(insight.nextStep.title).toEqual({ key: "nextQualify", params: {} });
  });

  it("suggests reconnecting when the contact has gone quiet", () => {
    const quiet = { ...contact("contact_elena"), lastTouchAt: "2026-08-01T10:00:00.000Z" };
    const insight = simulateInsight(context("contact_elena", { contact: quiet }));
    expect(insight.summary).toMatchObject({ key: "summaryQuiet" });
    expect(insight.nextStep.title).toEqual({ key: "nextReconnect", params: {} });
  });

  it("recognises customers", () => {
    expect(simulateInsight(context("contact_daniel", { deals: [] })).summary).toMatchObject({ key: "summaryCustomer" });
  });
});

describe("aiAcceptSchema", () => {
  it("needs a task title when a task is created", () => {
    expect(aiAcceptSchema.safeParse({ createTask: true, applyStage: false }).success).toBe(false);
    expect(aiAcceptSchema.safeParse({ createTask: true, taskTitle: "Call", applyStage: false }).success).toBe(true);
    expect(aiAcceptSchema.safeParse({ createTask: false, applyStage: true }).success).toBe(true);
  });
});
