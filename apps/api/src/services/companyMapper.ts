import type { Company } from '@lulu/shared';

const iso = (date: Date | null): string | null => (date === null ? null : date.toISOString());

export interface CompanyRow {
  id: string;
  workspaceId: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  ownerId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export function toSharedCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    domain: row.domain,
    industry: row.industry,
    // The database stores size as a plain string; the shared schema restricts it to the known bands.
    size: row.size as Company['size'],
    // The database allows a null owner, the shared schema does not.
    ownerId: row.ownerId ?? '',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: iso(row.deletedAt),
  };
}
