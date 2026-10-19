import type { Deal, Stage } from '@lulu/shared';

interface DecimalLike {
  toNumber(): number;
}

export interface DealRow {
  id: string;
  workspaceId: string;
  name: string;
  value: DecimalLike;
  currency: string;
  stageId: string;
  probability: DecimalLike;
  expectedCloseAt: Date | null;
  contactId: string | null;
  companyId: string | null;
  ownerId: string | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface StageRow {
  id: string;
  workspaceId: string;
  pipelineId: string;
  key: string | null;
  name: string;
  order: number;
  probability: DecimalLike;
  type: 'open' | 'won' | 'lost';
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

const iso = (date: Date | null): string | null => (date === null ? null : date.toISOString());

export function toSharedDeal(row: DealRow): Deal {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    value: row.value.toNumber(),
    currency: row.currency,
    stageId: row.stageId,
    probability: row.probability.toNumber(),
    expectedCloseAt: iso(row.expectedCloseAt),
    contactId: row.contactId,
    companyId: row.companyId,
    // The database allows a null owner, the shared schema does not. The shared logic never reads it.
    ownerId: row.ownerId ?? '',
    closedAt: iso(row.closedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: iso(row.deletedAt),
  };
}

export function toSharedStage(row: StageRow): Stage {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    pipelineId: row.pipelineId,
    key: row.key,
    name: row.name,
    order: row.order,
    probability: row.probability.toNumber(),
    type: row.type,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: iso(row.deletedAt),
  };
}
