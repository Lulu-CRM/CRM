import { ERROR_CODES, type RecordType } from '@lulu/shared';
import type { ScopedDb } from '../db/scoped';
import { AppError } from '../lib/errors';

// Tasks, notes and activities can point at a contact, company or deal (recordType + recordId).
// The link must be a live record in the same workspace; the web mock answers the same code and status.

export async function assertRecord(
  scoped: ScopedDb,
  recordType: RecordType | null | undefined,
  recordId: string | null | undefined,
): Promise<void> {
  if (!recordType || !recordId) return;
  const where = { where: { id: recordId }, select: { id: true } };
  const found =
    recordType === 'contact'
      ? await scoped.contact.findFirst(where)
      : recordType === 'company'
        ? await scoped.company.findFirst(where)
        : await scoped.deal.findFirst(where);
  if (found === null) throw new AppError(ERROR_CODES.RECORD_NOT_FOUND, 422);
}

/** A user of this workspace, for ownerId fields. */
export async function assertUser(scoped: ScopedDb, path: string, userId: string | undefined) {
  if (userId === undefined) return;
  const user = await scoped.user.findFirst({ where: { id: userId }, select: { id: true } });
  if (user === null) {
    throw AppError.validation([{ path, code: 'custom', message: 'errors.validation.custom' }]);
  }
}
