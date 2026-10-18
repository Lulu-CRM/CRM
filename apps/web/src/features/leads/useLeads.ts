"use client";

import { useMemo, useState } from "react";
import type { Contact, LifecycleStage } from "@lulu/shared";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";

/**
 * Contacts for the Leads board. A lead is a contact in an early lifecycle stage (docs/data-model.md),
 * and converting one sets the stage to "customer".
 * Moves are optimistic: the card changes column at once and goes back if the API refuses.
 */
export function useLeads() {
  const list = useApi(() => api.contacts.list({ pageSize: 100 }), []);
  // Contacts changed on this page, newest version wins over what the list last loaded.
  const [changed, setChanged] = useState<Map<string, Contact>>(new Map());

  const contacts = useMemo(
    () =>
      (list.data?.data ?? []).map((contact) => {
        const local = changed.get(contact.id);
        return local && local.updatedAt >= contact.updatedAt ? local : contact;
      }),
    [list.data, changed],
  );

  const remember = (contact: Contact) => setChanged((map) => new Map(map).set(contact.id, contact));
  const forget = (id: string) =>
    setChanged((map) => {
      const next = new Map(map);
      next.delete(id);
      return next;
    });

  const move = async (contact: Contact, stage: LifecycleStage) => {
    if (contact.lifecycleStage === stage) return;
    remember({ ...contact, lifecycleStage: stage, updatedAt: new Date().toISOString() });
    try {
      // Customer goes through the convert endpoint (POST /contacts/:id/convert), so the server can
      // apply whatever converting a lead means; other stages are a plain edit.
      const saved =
        stage === "customer"
          ? await api.contacts.convert(contact.id)
          : await api.contacts.update(contact.id, { lifecycleStage: stage });
      remember(saved);
      return saved;
    } catch (error) {
      forget(contact.id);
      throw error;
    }
  };

  return {
    contacts,
    loading: list.loading && !list.data,
    error: list.error,
    // Local copies stay: whichever version is newer wins once the list is back.
    reload: list.reload,
    remember,
    move,
  };
}
