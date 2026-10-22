"use client";

import { useEffect, useState } from "react";
import { api, onContactsChanged } from "@/lib/api";

/**
 * Contacts plus companies, for the badge on Contacts & Companies in the menu. Reloads as soon as a
 * contact is added, deleted or imported anywhere in the app.
 */
export function useRecordCount() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      Promise.all([api.contacts.list({ pageSize: 1 }), api.companies.list({ pageSize: 1 })])
        .then(([contacts, companies]) => !cancelled && setCount(contacts.meta.total + companies.meta.total))
        .catch(() => {}); // The badge is optional, so a failed count just hides it.
    void load();
    const stop = onContactsChanged(() => void load());
    return () => {
      cancelled = true;
      stop();
    };
  }, []);
  return count;
}
