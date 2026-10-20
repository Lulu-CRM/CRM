import {
  ERROR_CODES,
  segmentCreateSchema,
  segmentSchema,
  type Contact,
  type ListQuery,
  type Segment,
  type SegmentCreateInput,
  type SegmentListItem,
  type SegmentUpdateInput,
} from '@lulu/shared';
import { scopedDb, type ScopedDb } from '../db/scoped';
import type { Segment as SegmentRow } from '../generated/prisma/client';
import { AppError } from '../lib/errors';
import type { RequestContext } from '../middleware/requestContext';
import { listContacts } from './contacts';
import { loadMembershipData, memberIds } from './segmentMembership';

// Segments (docs/api.md, "Segments"). A segment stores rules, not a list: members are worked out when
// asked, with the shared rules, so counts are always live and a new matching contact counts at once.

const iso = (date: Date | null): string | null => (date === null ? null : date.toISOString());

export function toSharedSegment(row: SegmentRow): Segment {
  return segmentSchema.parse({
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    description: row.description,
    rules: row.rules,
    color: row.color,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: iso(row.deletedAt),
  });
}

async function findSegment(scoped: ScopedDb, id: string) {
  const row = await scoped.segment.findFirst({ where: { id } });
  if (row === null) throw AppError.notFound(ERROR_CODES.SEGMENT_NOT_FOUND);
  return row;
}

/** GET /segments: every segment with its live member count (contacts and deals loaded once for all). */
export async function listSegments(ctx: RequestContext): Promise<SegmentListItem[]> {
  const scoped = scopedDb(ctx.workspaceId);
  const rows = await scoped.segment.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  if (rows.length === 0) return [];
  const data = await loadMembershipData(scoped);
  return rows.map((row) => ({
    ...toSharedSegment(row),
    memberCount: memberIds(data, row.rules).length,
  }));
}

export async function createSegment(
  ctx: RequestContext,
  input: SegmentCreateInput,
): Promise<Segment> {
  const segment = segmentCreateSchema.parse(input);
  const row = await scopedDb(ctx.workspaceId).segment.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: segment.name,
      description: segment.description ?? null,
      rules: segment.rules,
      color: segment.color ?? 'violet',
    },
  });
  return toSharedSegment(row);
}

export async function updateSegment(
  ctx: RequestContext,
  id: string,
  input: SegmentUpdateInput,
): Promise<Segment> {
  const scoped = scopedDb(ctx.workspaceId);
  await findSegment(scoped, id);
  const row = await scoped.segment.update({
    where: { id },
    data: {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.rules === undefined ? {} : { rules: input.rules }),
      ...(input.color === undefined ? {} : { color: input.color }),
    },
  });
  return toSharedSegment(row);
}

export async function deleteSegment(ctx: RequestContext, id: string): Promise<void> {
  const scoped = scopedDb(ctx.workspaceId);
  await findSegment(scoped, id);
  await scoped.segment.delete({ where: { id } });
}

/** GET /segments/:id/contacts: the members, most recently touched first, paged like GET /contacts. */
export async function segmentContacts(
  ctx: RequestContext,
  id: string,
  query: ListQuery,
): Promise<{ items: Contact[]; total: number }> {
  await findSegment(scopedDb(ctx.workspaceId), id);
  return listContacts(ctx, { ...query, segmentId: id, sort: query.sort ?? '-lastTouchAt' });
}
