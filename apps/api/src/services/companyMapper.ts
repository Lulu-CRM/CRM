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
  leadStatus: Company['leadStatus'];
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
  productService: string | null;
  aiNotes: unknown;
  aiNotesUpdatedAt: Date | null;
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
    leadStatus: row.leadStatus,
    whatsapp: row.whatsapp,
    instagram: row.instagram,
    facebook: row.facebook,
    productService: row.productService,
    aiNotes: (row.aiNotes ?? null) as Company['aiNotes'],
    aiNotesUpdatedAt: iso(row.aiNotesUpdatedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: iso(row.deletedAt),
  };
}
