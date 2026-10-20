import { ERROR_CODES, type RecordType } from '@lulu/shared';
import type { ScopedDb } from '../db/scoped';
import { AppError } from '../lib/errors';

/** A link sent by the client must point at a record in the same workspace (never trust ids). */
export async function assertRecordExists(
  scoped: ScopedDb,
  recordType: RecordType | null | undefined,
  recordId: string | null | undefined,
): Promise<void> {
  if (recordType == null || recordId == null) return;
  const where = { id: recordId };
  const row =
    recordType === 'contact'
      ? await scoped.contact.findFirst({ where })
      : recordType === 'company'
        ? await scoped.company.findFirst({ where })
        : await scoped.deal.findFirst({ where });
  if (row === null) throw AppError.notFound(ERROR_CODES.RECORD_NOT_FOUND);
}