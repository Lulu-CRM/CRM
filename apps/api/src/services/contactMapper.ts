import type { Contact } from '@lulu/shared';

const iso = (date: Date | null): string | null => (date === null ? null : date.toISOString());

export interface ContactRow {
  id: string;
  workspaceId: string;
  name: string;
  email: string | null;
  phone: string | null;
  companyId: string | null;
  companyIds: string[];
  jobRole: string | null;
  language: string | null;
  country: string | null;
  source: string | null;
  lifecycleStage: Contact['lifecycleStage'];
  ownerId: string | null;
  tags: string[];
  marketingConsent: boolean;
  consentUpdatedAt: Date | null;
  lastTouchAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export function toSharedContact(row: ContactRow): Contact {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    companyId: row.companyId,
    companyIds: row.companyIds,
    jobRole: row.jobRole,
    language: row.language,
    country: row.country,
    source: row.source,
    lifecycleStage: row.lifecycleStage,
    // The database allows a null owner, the shared schema does not.
    ownerId: row.ownerId ?? '',
    tags: row.tags,
    marketingConsent: row.marketingConsent,
    consentUpdatedAt: iso(row.consentUpdatedAt),
    lastTouchAt: iso(row.lastTouchAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: iso(row.deletedAt),
  };
}
