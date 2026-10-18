import type { Deal } from "../deal.js";
import type { PipelineWithStages, Stage } from "../pipeline.js";

// Sample data from the MagicPath design (design/src/components/generated/LuluCRM.tsx),
// for mock mode and the seed script. Ids are stable so other fixtures can link to them.

export const DEMO_WORKSPACE_ID = "ws_demo";

const CREATED = "2026-10-01T09:00:00.000Z";

const base = {
  workspaceId: DEMO_WORKSPACE_ID,
  createdAt: CREATED,
  updatedAt: CREATED,
  deletedAt: null,
};

const stage = (
  key: string,
  name: string,
  order: number,
  probability: number,
  type: Stage["type"] = "open",
): Stage => ({
  ...base,
  id: `stage_${key}`,
  pipelineId: "pipeline_default",
  key,
  name,
  order,
  probability,
  type,
});

export const demoStages: Stage[] = [
  stage("new", "New", 0, 0.2),
  stage("qualified", "Qualified", 1, 0.4),
  stage("proposal", "Proposal", 2, 0.7),
  stage("negotiation", "Negotiation", 3, 0.85),
  stage("won", "Won", 4, 1, "won"),
  stage("lost", "Lost", 5, 0, "lost"),
];

export const demoPipeline: PipelineWithStages = {
  ...base,
  id: "pipeline_default",
  key: "sales",
  name: "Sales pipeline",
  isDefault: true,
  stages: demoStages,
};

export const demoDeals: Deal[] = [
  {
    ...base,
    id: "deal_northstar",
    name: "Northstar annual workspace",
    value: 24000,
    currency: "EUR",
    stageId: "stage_proposal",
    probability: 0.7,
    expectedCloseAt: "2026-10-28T12:00:00.000Z",
    contactId: "contact_sophie",
    companyId: "company_northstar",
    ownerId: "user_jamie",
    closedAt: null,
  },
  {
    ...base,
    id: "deal_atlas",
    name: "Atlas operations rollout",
    value: 42500,
    currency: "EUR",
    stageId: "stage_negotiation",
    probability: 0.85,
    expectedCloseAt: "2026-11-04T12:00:00.000Z",
    contactId: "contact_daniel",
    companyId: "company_atlas",
    ownerId: "user_jamie",
    closedAt: null,
  },
  {
    ...base,
    id: "deal_roam",
    name: "Roam & Root launch",
    value: 12800,
    currency: "EUR",
    stageId: "stage_qualified",
    probability: 0.4,
    expectedCloseAt: "2026-11-18T12:00:00.000Z",
    contactId: "contact_mila",
    companyId: "company_roam",
    ownerId: "user_alex",
    closedAt: null,
  },
  {
    ...base,
    id: "deal_klarwerk",
    name: "Klarwerk finance workspace",
    value: 18600,
    currency: "EUR",
    stageId: "stage_new",
    probability: 0.2,
    expectedCloseAt: "2026-12-02T12:00:00.000Z",
    contactId: "contact_tobias",
    companyId: "company_klarwerk",
    ownerId: "user_jamie",
    closedAt: null,
  },
];
