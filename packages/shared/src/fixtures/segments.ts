import type { Segment } from "../segment.js";
import { DEMO_WORKSPACE_ID } from "./pipeline.js";

// The four sample segments from the MagicPath design (renderSegments), as real rules.

const CREATED = "2026-10-01T09:00:00.000Z";
const base = { workspaceId: DEMO_WORKSPACE_ID, createdAt: CREATED, updatedAt: CREATED, deletedAt: null };

export const demoSegments: Segment[] = [
  {
    ...base,
    id: "segment_high_intent",
    name: "High-intent leads",
    description: "Qualified leads with recent activity.",
    color: "violet",
    rules: {
      match: "all",
      conditions: [
        { field: "lifecycleStage", op: "is", value: "qualified" },
        { field: "lastTouch", op: "within_days", value: 14 },
      ],
    },
  },
  {
    ...base,
    id: "segment_follow_up",
    name: "Needs follow-up",
    description: "People with a next action that is due or overdue.",
    color: "coral",
    rules: { match: "all", conditions: [{ field: "followUp", op: "due" }] },
  },
  {
    ...base,
    id: "segment_at_risk",
    name: "Customers at risk",
    description: "Customers whose last touchpoint is more than 30 days old.",
    color: "blue",
    rules: {
      match: "all",
      conditions: [
        { field: "lifecycleStage", op: "is", value: "customer" },
        { field: "lastTouch", op: "older_than_days", value: 30 },
      ],
    },
  },
  {
    ...base,
    id: "segment_newsletter",
    name: "Newsletter consent",
    description: "Contacts who opted into marketing communication.",
    color: "mint",
    rules: { match: "all", conditions: [{ field: "marketingConsent", op: "is", value: true }] },
  },
];
