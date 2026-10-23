import { ERROR_CODES, type RecordType } from '@lulu/shared';
import type { DbTx } from '../db/scoped';
import { AppError } from '../lib/errors';

/** RECORD_NOT_FOUND answers 422, the same as the web mock. */
export const recordNotFound = () => new AppError(ERROR_CODES.RECORD_NOT_FOUND, 422);

/** A link sent by the client must point at a record in the same workspace (never trust ids). */
export async function assertRecordExists(
  scoped: DbTx,
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
  if (row === null) throw recordNotFound();
}
