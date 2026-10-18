"use client";

import { useMemo, useState } from "react";
import type { Note, NoteCreateInput, NoteUpdateInput } from "@lulu/shared";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useLookups } from "@/features/contacts/useLookups";

// Notes and the names they refer to (authors, linked contacts, companies and deals).
export function useNotesPage() {
  const lookups = useLookups();
  const notes = useApi(() => api.notes.list({ pageSize: 100 }), []);
  const contacts = useApi(() => api.contacts.list({ pageSize: 100 }), []);
  const deals = useApi(() => api.deals.list(), []);

  // Notes saved on this page since the list last loaded. A deleted note maps to null.
  const [changed, setChanged] = useState<Map<string, Note | null>>(new Map());
  const remember = (id: string, note: Note | null) => setChanged((map) => new Map(map).set(id, note));

  const list = useMemo(() => {
    const loaded = notes.data?.data ?? [];
    const merged = loaded
      .map((note) => (changed.has(note.id) ? changed.get(note.id) : note))
      .filter((note): note is Note => note != null);
    const added = [...changed.values()].filter((note): note is Note => note != null && !loaded.some((n) => n.id === note.id));
    return [...added, ...merged];
  }, [notes.data, changed]);

  const create = async (input: NoteCreateInput) => {
    const note = await api.notes.create(input);
    remember(note.id, note);
  };

  const update = async (note: Note, input: NoteUpdateInput) => remember(note.id, await api.notes.update(note.id, input));

  const remove = async (note: Note) => {
    await api.notes.remove(note.id);
    remember(note.id, null);
  };

  const contactList = contacts.data?.data ?? [];
  const dealList = deals.data?.data ?? [];
  const recordName = (note: Pick<Note, "recordType" | "recordId">) => {
    if (!note.recordId) return undefined;
    if (note.recordType === "contact") return contactList.find((c) => c.id === note.recordId)?.name;
    if (note.recordType === "company") return lookups.companyName(note.recordId);
    return dealList.find((d) => d.id === note.recordId)?.name;
  };

  return {
    lookups,
    contacts: contactList,
    deals: dealList,
    notes: { list, loading: notes.loading && !notes.data, error: notes.error, reload: notes.reload },
    recordName,
    create,
    update,
    remove,
  };
}
