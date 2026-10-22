"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { CompanyListItem, Contact } from "@lulu/shared";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar, Button, Card, ConfirmDialog, EmptyState, Pill, SkeletonRows, Table, useToast, type Column, type PillTone } from "@/components/ui";
import { CompanyDrawer } from "@/features/companies/CompanyDrawer";
import { CompanyFormModal } from "@/features/companies/CompanyFormModal";
import { companyMark } from "@/features/companies/options";
import { ContactDrawer } from "@/features/contacts/ContactDrawer";
import { ContactFormModal } from "@/features/contacts/ContactFormModal";
import { stageTone } from "@/features/contacts/options";
import { useLookups } from "@/features/contacts/useLookups";
import { useFormat } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { avatarTone, initials } from "@/lib/initials";
import { useApi } from "@/lib/useApi";
import { DirectoryActions } from "./DirectoryActions";

const tabs = ["all", "contacts", "companies", "followUp"] as const;
type Tab = (typeof tabs)[number];

type Row = { kind: "contact"; id: string; contact: Contact } | { kind: "company"; id: string; company: CompanyListItem };

const healthTone: Record<CompanyListItem["health"], PillTone> = { strong: "success", watch: "warning", new: "violet" };

/**
 * Contacts & Companies (MagicPath design update): people and company accounts in one table, with
 * Notes and AI Analysis cards under it. The older Contacts and Companies pages stay at their links.
 */
export function DirectoryPage() {
  const t = useTranslations("directory");
  const tStage = useTranslations("lifecycleStages");
  const tCompanies = useTranslations("companies");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const format = useFormat();
  const lookups = useLookups();

  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const q = search.trim() || undefined;

  const list = useApi(
    () =>
      Promise.all([
        tab === "companies" ? null : api.contacts.list({ q, pageSize: 100, ...(tab === "followUp" ? { needsFollowUp: true } : {}) }),
        tab === "contacts" || tab === "followUp" ? null : api.companies.list({ q, pageSize: 100 }),
      ]),
    [tab, q],
  );
  // Totals for the tab badges, independent of the search.
  const counts = useApi(
    () =>
      Promise.all([
        api.contacts.list({ pageSize: 1 }),
        api.companies.list({ pageSize: 1 }),
        api.contacts.list({ pageSize: 1, needsFollowUp: true }),
      ]),
    [],
  );
  const countOf: Record<Tab, number | undefined> = {
    all: counts.data ? counts.data[0].meta.total + counts.data[1].meta.total : undefined,
    contacts: counts.data?.[0].meta.total,
    companies: counts.data?.[1].meta.total,
    followUp: counts.data?.[2].meta.total,
  };

  const [contacts, companies] = list.data ?? [null, null];
  const rows: Row[] = [
    ...(contacts?.data ?? []).map((contact) => ({ kind: "contact" as const, id: `contact:${contact.id}`, contact })),
    ...(companies?.data ?? []).map((company) => ({ kind: "company" as const, id: `company:${company.id}`, company })),
  ];
  const total = (contacts?.meta.total ?? 0) + (companies?.meta.total ?? 0);

  const [openContact, setOpenContact] = useState<Contact | null>(null);
  const [openCompany, setOpenCompany] = useState<CompanyListItem | null>(null);
  const [contactForm, setContactForm] = useState<{ contact: Contact | null } | null>(null);
  const [companyForm, setCompanyForm] = useState<{ company: CompanyListItem | null } | null>(null);
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  const reload = () => {
    list.reload();
    counts.reload();
  };
  const open = (row: Row) => (row.kind === "contact" ? setOpenContact(row.contact) : setOpenCompany(row.company));
  const nameOf = (row: Row) => (row.kind === "contact" ? row.contact.name : row.company.name);

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      if (toDelete.kind === "contact") await api.contacts.remove(toDelete.contact.id);
      else await api.companies.remove(toDelete.company.id);
      toast(t("deleted", { name: nameOf(toDelete) }));
      setToDelete(null);
      setOpenContact(null);
      setOpenCompany(null);
      reload();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setDeleting(false);
    }
  };

  const owner = (id: string | null) => {
    const name = lookups.userName(id);
    return name ? (
      <div className="flex items-center gap-2">
        <Avatar initials={initials(name)} tone="mint" small />
        {name}
      </div>
    ) : (
      "–"
    );
  };

  const columns: Column<Row>[] = [
    {
      key: "record",
      header: t("columns.record"),
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.kind === "contact" ? (
            <Avatar initials={initials(row.contact.name)} tone={avatarTone(row.contact.id)} small />
          ) : (
            <Avatar initials={companyMark(row.company.name)} tone="blue" small />
          )}
          <span className="min-w-0">
            <strong className="block truncate text-[11px] text-text-strong">{nameOf(row)}</strong>
            <small className="mt-1 block truncate text-[10px] text-text-faint">
              {row.kind === "contact"
                ? [t("kind.contact"), row.contact.email].filter(Boolean).join(" · ")
                : [t("kind.company"), row.company.domain].filter(Boolean).join(" · ")}
            </small>
          </span>
        </div>
      ),
    },
    {
      key: "context",
      header: t("columns.context"),
      cell: (row) =>
        row.kind === "contact" ? (
          <>
            <strong className="block text-[11px] text-text-strong">{lookups.companyName(row.contact.companyId) ?? "–"}</strong>
            <small className="mt-1 block text-[10px] text-text-faint">{row.contact.jobRole ?? ""}</small>
          </>
        ) : (
          <>
            <strong className="block text-[11px] text-text-strong">{t("contactCount", { count: row.company.contactCount })}</strong>
            <small className="mt-1 block text-[10px] text-text-faint">{row.company.industry ?? ""}</small>
          </>
        ),
    },
    {
      key: "status",
      header: t("columns.status"),
      cell: (row) =>
        row.kind === "contact" ? (
          <Pill tone={stageTone[row.contact.lifecycleStage]}>{tStage(row.contact.lifecycleStage)}</Pill>
        ) : (
          <Pill tone={healthTone[row.company.health]}>{tCompanies(`health.${row.company.health}`)}</Pill>
        ),
    },
    {
      key: "owner",
      header: t("columns.owner"),
      cell: (row) => owner(row.kind === "contact" ? row.contact.ownerId : row.company.ownerId),
    },
    {
      key: "activity",
      header: t("columns.activity"),
      cell: (row) =>
        row.kind === "contact"
          ? row.contact.lastTouchAt
            ? format.recent(row.contact.lastTouchAt)
            : "–"
          : format.money(row.company.openDealValue),
    },
    {
      key: "menu",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      className: "w-10 text-right",
      cell: (row) => (
        <button
          type="button"
          aria-label={t("open", { name: nameOf(row) })}
          onClick={(event) => {
            event.stopPropagation();
            open(row);
          }}
          className="min-h-8 min-w-8 rounded px-1.5 py-1 text-[11px] tracking-widest text-text-subtle hover:bg-surface-muted"
        >
          •••
        </button>
      ),
    },
  ];

  const filtered = q !== undefined || tab !== "all";

  return (
    <>
      <PageHeader
        page="directory"
        actions={
          <>
            <Button variant="outline" icon="＋" onClick={() => setCompanyForm({ company: null })}>
              {t("addCompany")}
            </Button>
            <Button icon="＋" onClick={() => setContactForm({ contact: null })}>
              {t("addContact")}
            </Button>
          </>
        }
      />
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{t("eyebrow")}</span>
            <h2 className="mt-1.5 text-[17px] font-semibold tracking-tight text-[#363347]">{t("title")}</h2>
            <p className="mt-1.5 max-w-[610px] text-[10px] leading-relaxed text-[#9190a0]">{t("intro")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/crm/import"
              className="inline-flex items-center gap-1.5 rounded-md border border-[#dad8ec] bg-surface px-3.5 py-2.5 text-[11px] font-extrabold whitespace-nowrap text-primary-hover hover:bg-[#f7f5ff]"
            >
              <span aria-hidden>⇧</span>
              {t("importContacts")}
            </Link>
          </div>
        </div>

        <div className="mt-[19px] flex flex-col gap-1 border-t border-[#f0eff5] pt-3 md:flex-row md:items-center md:justify-between md:gap-4">
          <label className="flex h-[38px] items-center gap-2 rounded-lg border border-border-strong px-3 text-text-subtle md:w-[330px] md:flex-none">
            <span aria-hidden>⌕</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("search")}
              aria-label={t("search")}
              className="w-full min-w-0 bg-transparent text-[11px] text-text outline-none"
            />
          </label>
          <div role="tablist" aria-label={t("filtersLabel")} className="flex min-w-0 gap-1 overflow-x-auto py-1">
            {tabs.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`rounded-md px-2.5 py-1.5 text-[10px] whitespace-nowrap ${
                  tab === key ? "bg-primary-soft font-extrabold text-primary-hover" : "text-text-muted hover:bg-surface-muted"
                }`}
              >
                {t(`tabs.${key}`)}
                {countOf[key] != null && <b className="ml-1.5 text-[9px]">{format.number(countOf[key]!)}</b>}
              </button>
            ))}
          </div>
        </div>

        {list.error ? (
          <EmptyState
            icon="!"
            title={errorMessage(list.error)}
            action={<Button variant="outline" onClick={list.reload}>{tCommon("retry")}</Button>}
          />
        ) : list.loading && !list.data ? (
          <div className="py-4">
            <SkeletonRows rows={5} />
          </div>
        ) : rows.length === 0 ? (
          filtered ? (
            <EmptyState title={t("noMatches")} description={t("noMatchesHint")} />
          ) : (
            <EmptyState
              title={t("empty")}
              description={t("emptyHint")}
              action={<Button icon="＋" onClick={() => setContactForm({ contact: null })}>{t("addContact")}</Button>}
            />
          )
        ) : (
          <div aria-busy={list.loading} className={`mt-2 ${list.loading ? "opacity-60 transition-opacity" : ""}`}>
            <Table columns={columns} rows={rows} rowKey={(row) => row.id} onRowClick={open} />
            <p className="pt-4 text-[10px] text-text-subtle">{t("showing", { count: rows.length, total })}</p>
          </div>
        )}
      </Card>

      <DirectoryActions lookups={lookups} />

      <ContactFormModal
        open={contactForm !== null}
        contact={contactForm?.contact ?? null}
        lookups={lookups}
        onClose={() => setContactForm(null)}
        onSaved={(saved) => {
          setContactForm(null);
          if (openContact?.id === saved.id) setOpenContact(saved);
          reload();
        }}
      />
      <CompanyFormModal
        open={companyForm !== null}
        company={companyForm?.company ?? null}
        lookups={lookups}
        industries={[...new Set(lookups.companies.map((c) => c.industry).filter((i): i is string => !!i))].sort()}
        onClose={() => setCompanyForm(null)}
        onSaved={() => {
          setCompanyForm(null);
          setOpenCompany(null);
          reload();
        }}
      />

      <ContactDrawer
        contact={openContact}
        lookups={lookups}
        onClose={() => setOpenContact(null)}
        onEdit={(contact) => setContactForm({ contact })}
        onDelete={(contact) => setToDelete({ kind: "contact", id: `contact:${contact.id}`, contact })}
        onChanged={(contact) => {
          setOpenContact(contact);
          reload();
        }}
      />
      <CompanyDrawer
        company={openCompany}
        lookups={lookups}
        onClose={() => setOpenCompany(null)}
        onEdit={(company) => setCompanyForm({ company })}
        onDelete={(company) => setToDelete({ kind: "company", id: `company:${company.id}`, company })}
      />

      <ConfirmDialog
        open={toDelete !== null}
        title={t("deleteTitle")}
        message={toDelete ? t("deleteMessage", { name: nameOf(toDelete) }) : ""}
        confirmLabel={tCommon("delete")}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
