import type { ImportJob } from "@lulu/shared";

// Tells parts of the app that show contact totals (the Contacts badge in the CRM menu) that the number
// may have changed, so they reload at once instead of on the next page load.

type Listener = () => void;
const listeners = new Set<Listener>();

export function onContactsChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyContactsChanged(): void {
  for (const listener of listeners) listener();
}

/** Runs `call`, then notifies when `changed(result)` says contacts were added or removed. */
export function notifyAfter<A extends unknown[], R>(
  call: (...args: A) => Promise<R>,
  changed: (result: R) => boolean = () => true,
): (...args: A) => Promise<R> {
  return async (...args) => {
    const result = await call(...args);
    if (changed(result)) notifyContactsChanged();
    return result;
  };
}

/** An import adds contacts in the background; the wizard sees it finish when the job is done. */
export const importFinished = (job: ImportJob) => job.status === "done";
