"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Contact, LifecycleStage } from "@lulu/shared";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, Card, ConfirmDialog, EmptyState, Skeleton, useToast } from "@/components/ui";
import { ContactDrawer } from "@/features/contacts/ContactDrawer";
import { ContactFormModal } from "@/features/contacts/ContactFormModal";
import { useLookups } from "@/features/contacts/useLookups";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { LeadBoard } from "./LeadBoard";
import { useLeads } from "./useLeads";

export function LeadsPage() {
  const t = useTranslations("leads");
  const tContacts = useTranslations("contacts");
  const tDrawer = useTranslations("contacts.drawer");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const lookups = useLookups();
  const leads = useLeads();

  const [form, setForm] = useState<{ contact: Contact | null; stage?: LifecycleStage } | null>(null);
  const [open, setOpen] = useState<Contact | null>(null);
  const [toDelete, setToDelete] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);

  const move = async (contact: Contact, stage: LifecycleStage) => {
    try {
      await leads.move(contact, stage);
      if (stage === "customer") toast(tDrawer("converted"));
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.contacts.remove(toDelete.id);
      toast(tContacts("deleted", { count: 1 }));
      if (open?.id === toDelete.id) setOpen(null);
      setToDelete(null);
      leads.reload();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <PageHeader page="leads" />
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{t("eyebrow")}</span>
            <h2 className="mt-1.5 text-[17px] font-semibold tracking-tight text-[#363347]">{t("title")}</h2>
            <p className="mt-1.5 max-w-[610px] text-[10px] leading-relaxed text-[#9190a0]">{t("intro")}</p>
          </div>
          <Button icon="＋" onClick={() => setForm({ contact: null, stage: "new" })}>
            {t("addLead")}
          </Button>
        </div>

        {leads.loading ? (
          <div className="mt-5 grid auto-cols-[minmax(220px,1fr)] grid-flow-col gap-2.5 overflow-hidden" role="status" aria-busy="true" aria-label={tCommon("loading")}>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="grid gap-2 rounded-[10px] border border-[#ecebf3] bg-[#fafaff] p-2.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-24 w-full" />
              </div>
            ))}
          </div>
        ) : leads.error ? (
          <EmptyState
            icon="!"
            title={errorMessage(leads.error)}
            action={<Button variant="outline" onClick={leads.reload}>{tCommon("retry")}</Button>}
          />
        ) : (
          <LeadBoard
            contacts={leads.contacts}
            companyName={lookups.companyName}
            onOpen={setOpen}
            onAdd={(stage) => setForm({ contact: null, stage })}
            onMove={move}
          />
        )}
      </Card>

      <ContactFormModal
        open={form !== null}
        contact={form?.contact ?? null}
        initialStage={form?.stage}
        lookups={lookups}
        onClose={() => setForm(null)}
        onSaved={(saved) => {
          setForm(null);
          if (open?.id === saved.id) setOpen(saved);
          leads.remember(saved);
          leads.reload();
        }}
      />

      <ContactDrawer
        contact={open}
        lookups={lookups}
        onClose={() => setOpen(null)}
        onEdit={(contact) => setForm({ contact })}
        onDelete={setToDelete}
        onChanged={(contact) => {
          setOpen(contact);
          leads.remember(contact);
        }}
      />

      <ConfirmDialog
        open={toDelete !== null}
        title={tContacts("deleteTitle", { count: 1 })}
        message={toDelete ? tContacts("deleteOne", { name: toDelete.name }) : ""}
        confirmLabel={tCommon("delete")}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
