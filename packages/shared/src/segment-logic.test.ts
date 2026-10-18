import { describe, expect, it } from "vitest";
import type { Contact } from "./contact.js";
import { demoContacts } from "./fixtures/contacts.js";
import { demoDeals, demoStages } from "./fixtures/pipeline.js";
import { demoSegments } from "./fixtures/segments.js";
import { demoTasks } from "./fixtures/tasks.js";
import { segmentCreateSchema, segmentSchema, type SegmentRules } from "./segment.js";
import { segmentMembers, type SegmentContext } from "./segment-logic.js";

// Saturday 17 October 2026, the design's "today".
const NOW = new Date("2026-10-17T10:00:00.000Z");
const context: SegmentContext = { now: NOW, timeZone: "UTC", tasks: demoTasks(NOW), deals: demoDeals, stages: demoStages };

const names = (rules: SegmentRules, contacts: Contact[] = demoContacts, ctx = context) =>
  segmentMembers(contacts, rules, ctx).map((c) => c.name).sort();
const one = (condition: SegmentRules["conditions"][number]): SegmentRules => ({ match: "all", conditions: [condition] });

describe("segment schemas", () => {
  it("accept the design's sample segments", () => {
    for (const s of demoSegments) expect(() => segmentSchema.parse(s)).not.toThrow();
  });

  it("reject rules that do not fit their field", () => {
    const bad = (condition: unknown) => segmentCreateSchema.safeParse({ name: "X", rules: { match: "all", conditions: [condition] } }).success;
    expect(bad({ field: "lifecycleStage", op: "is", value: "vip" })).toBe(false);
    expect(bad({ field: "lastTouch", op: "within_days" })).toBe(false);
    expect(bad({ field: "marketingConsent", op: "is_not", value: true })).toBe(false);
    expect(bad({ field: "unknown", op: "is", value: 1 })).toBe(false);
    expect(segmentCreateSchema.safeParse({ name: "X", rules: { match: "all", conditions: [] } }).success).toBe(false);
  });
});

describe("segmentMembers", () => {
  it("matches the design's sample segments", () => {
    const byId = Object.fromEntries(demoSegments.map((s) => [s.id, names(s.rules)]));
    expect(byId.segment_high_intent).toEqual(["Elena Schmidt", "Sophie Laurent"]);
    // Sophie's proposal task is due today.
    expect(byId.segment_follow_up).toEqual(["Sophie Laurent"]);
    expect(byId.segment_at_risk).toEqual([]);
    expect(byId.segment_newsletter).toEqual([]);
  });

  it("filters by stage, owner and tag", () => {
    expect(names(one({ field: "lifecycleStage", op: "is_not", value: "qualified" }))).toEqual([
      "Daniel Chen",
      "Mila Rossi",
      "Tobias Klein",
    ]);
    expect(names(one({ field: "ownerId", op: "is", value: "user_alex" }))).toEqual(["Elena Schmidt", "Mila Rossi"]);
    // Tags match without caring about case.
    expect(names(one({ field: "tag", op: "has", value: "vip" }))).toEqual(["Daniel Chen"]);
    expect(names(one({ field: "tag", op: "has_not", value: "VIP" }))).toHaveLength(4);
  });

  it("filters by last touch", () => {
    // Tobias and Elena were last touched on 13 October, four days before "now".
    expect(names(one({ field: "lastTouch", op: "older_than_days", value: 3 }))).toEqual(["Elena Schmidt", "Tobias Klein"]);
    expect(names(one({ field: "lastTouch", op: "within_days", value: 3 }))).toHaveLength(3);
    const untouched = { ...demoContacts[0], id: "c_new", name: "New Person", lastTouchAt: null };
    expect(names(one({ field: "lastTouch", op: "never" }), [...demoContacts, untouched])).toEqual(["New Person"]);
    // Never touched also counts as "more than N days ago".
    expect(names(one({ field: "lastTouch", op: "older_than_days", value: 3 }), [untouched])).toEqual(["New Person"]);
  });

  it("finds contacts on open deals and with consent", () => {
    // Daniel's Atlas deal, Sophie's, Mila's and Tobias's are open.
    expect(names(one({ field: "openDeal", op: "exists" }))).toEqual(["Daniel Chen", "Mila Rossi", "Sophie Laurent", "Tobias Klein"]);
    expect(names(one({ field: "openDeal", op: "none" }))).toEqual(["Elena Schmidt"]);
    const won = demoDeals.map((d) => (d.id === "deal_atlas" ? { ...d, stageId: "stage_won" } : d));
    expect(names(one({ field: "openDeal", op: "exists" }), demoContacts, { ...context, deals: won })).not.toContain("Daniel Chen");

    const consenting = demoContacts.map((c) => (c.id === "contact_mila" ? { ...c, marketingConsent: true } : c));
    expect(names(one({ field: "marketingConsent", op: "is", value: true }), consenting)).toEqual(["Mila Rossi"]);
  });

  it("follow-up due ignores done tasks and tasks not linked to a contact", () => {
    const tasks = demoTasks(NOW).map((t) => (t.id === "task_sophie_proposal" ? { ...t, done: true } : t));
    expect(names(one({ field: "followUp", op: "due" }), demoContacts, { ...context, tasks })).toEqual([]);
  });

  it("combines conditions with all or any", () => {
    const conditions: SegmentRules["conditions"] = [
      { field: "lifecycleStage", op: "is", value: "new" },
      { field: "lifecycleStage", op: "is", value: "customer" },
    ];
    expect(names({ match: "all", conditions })).toEqual([]);
    expect(names({ match: "any", conditions })).toEqual(["Daniel Chen", "Mila Rossi"]);
  });

  it("leaves out deleted contacts", () => {
    const deleted = demoContacts.map((c) => (c.id === "contact_mila" ? { ...c, deletedAt: NOW.toISOString() } : c));
    expect(names(one({ field: "lifecycleStage", op: "is", value: "new" }), deleted)).toEqual([]);
  });
});
