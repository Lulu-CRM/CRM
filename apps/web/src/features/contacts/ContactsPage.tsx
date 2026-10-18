"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { Contact, ContactListQuery } from "@lulu/shared";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Pagination,
  Pill,
  SkeletonRows,
  Table,
  useToast,
  type Column,
  type SortState,
} from "@/components/ui";
import { useFormat } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { useApi, useDebounced } from "@/lib/useApi";
import { ContactDrawer } from "./ContactDrawer";
import { ContactFormModal } from "./ContactFormModal";
import { FilterMenu, type ExtraFilters } from "./FilterMenu";
import { avatarTone, filterKeys, initials, stageTone, startOfMonth, type FilterKey } from "./options";
import { useLookups } from "./useLookups";

const PAGE_SIZE = 10;

// Sort keys the API understands (docs/api.md: sort=-lastTouchAt).
const sortFields: Record<string, string> = { contact: "name", status: "lifecycleStage", lastTouch: "lastTouchAt" };

function withoutEmpty(extra: ExtraFilters): Partial<ContactListQuery> {
  return Object.fromEntries(Object.entries(extra).filter(([, v]) => v));
}

function filterQuery(filter: FilterKey, meId: string | undefined): Partial<ContactListQuery> {
  switch (filter) {
    case "mine":
      return { ownerId: meId };
    case "followUp":
      return { needsFollowUp: true };
    case "newThisMonth":
      return { createdSince: startOfMonth() };
    default:
      return {};
  }
}

export function ContactsPage() {
  const t = useTranslations("contacts");
  const tStage = useTranslations("lifecycleStages");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const lookups = useLookups();
  const meId = lookups.me?.id;

  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim());
  const [filter, setFilter] = useState<FilterKey>("all");
  const [extra, setExtra] = useState<ExtraFilters>({});
  const [sort, setSort] = useState<SortState>({ key: "lastTouch", direction: "desc" });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set<string>());

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [open, setOpen] = useState<Contact | null>(null);
  const [toDelete, setToDelete] = useState<Contact[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sortParam = sort ? `${sort.direction === "desc" ? "-" : ""}${sortFields[sort.key]}` : undefined;
  const filterReady = filter !== "mine" || !!meId;

  const list = useApi(
    () =>
      filterReady
        ? api.contacts.list({
            q: q || undefined,
            sort: sortParam,
            page,
            pageSize: PAGE_SIZE,
            ...filterQuery(filter, meId),
            ...withoutEmpty(extra),
          })
        : new Promise<never>(() => {}),
    [q, sortParam, page, filter, meId, extra.stage, extra.ownerId],
  );

  // One count per chip, with the search applied, like the design's "All contacts 5".
  const counts = useApi(
    () =>
      Promise.all(
        filterKeys.map((key) =>
          key === "mine" && !meId
            ? Promise.resolve(null)
            : api.contacts
                .list({ q: q || undefined, pageSize: 1, ...filterQuery(key, meId), ...withoutEmpty(extra) })
                .then((r) => r.meta.total),
        ),
      ),
    [q, meId, list.data, extra.stage, extra.ownerId],
  );

  const resetPaging = () => {
    setPage(1);
    setSelected(new Set());
  };

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (contact: Contact) => {
    setEditing(contact);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await Promise.all(toDelete.map((contact) => api.contacts.remove(contact.id)));
      toast(t("deleted", { count: toDelete.length }));
      if (open && toDelete.some((c) => c.id === open.id)) setOpen(null);
      setSelected(new Set());
      setToDelete(null);
      list.reload();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setDeleting(false);
    }
  };

  const rows = list.data?.data ?? [];
  const total = list.data?.meta.total ?? 0;
  // A page can empty out after a delete. Step back instead of showing a blank page.
  const pageIsEmpty = !list.loading && !list.error && rows.length === 0 && page > 1;
  useEffect(() => {
    if (pageIsEmpty) setPage((p) => p - 1);
  }, [pageIsEmpty]);

  const columns: Column<Contact>[] = [
    {
      key: "contact",
      header: t("columns.contact"),
      sortable: true,
      cell: (c) => (
        <div className="flex items-center gap-2">
          <Avatar initials={initials(c.name)} tone={avatarTone(c.id)} small />
          <span className="min-w-0">
            <strong className="block truncate text-[11px] text-text-strong">{c.name}</strong>
            <small className="mt-1 block truncate text-[10px] text-text-faint">{c.email ?? "–"}</small>
          </span>
        </div>
      ),
    },
    {
      key: "company",
      header: t("columns.company"),
      cell: (c) => (
        <>
          <strong className="block text-[11px] text-text-strong">{lookups.companyName(c.companyId) ?? "–"}</strong>
          <small className="mt-1 block text-[10px] text-text-faint">{c.jobRole ?? ""}</small>
        </>
      ),
    },
    {
      key: "status",
      header: t("columns.status"),
      sortable: true,
      cell: (c) => <Pill tone={stageTone[c.lifecycleStage]}>{tStage(c.lifecycleStage)}</Pill>,
    },
    {
      key: "owner",
      header: t("columns.owner"),
      cell: (c) => {
        const name = lookups.userName(c.ownerId);
        return name ? (
          <div className="flex items-center gap-2">
            <Avatar initials={initials(name)} tone="mint" small />
            {name}
          </div>
        ) : (
          "–"
        );
      },
    },
    {
      key: "lastTouch",
      header: t("columns.lastTouch"),
      sortable: true,
      cell: (c) => (c.lastTouchAt ? format.recent(c.lastTouchAt) : "–"),
    },
    {
      key: "menu",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      className: "w-10 text-right",
      cell: (c) => (
        <button
          type="button"
          aria-label={t("openProfile", { name: c.name })}
          onClick={(event) => {
            event.stopPropagation();
            setOpen(c);
          }}
          className="rounded px-1.5 py-1 text-[11px] tracking-widest text-text-subtle hover:bg-surface-muted"
        >
          •••
        </button>
      ),
    },
  ];

  const selectedContacts = rows.filter((c) => selected.has(c.id));

  return (
    <>
      <PageHeader
        page="contacts"
        actions={
          <>
            <Link
              href="/crm/import"
              className="inline-flex items-center gap-1.5 rounded-md border border-[#dad8ec] bg-surface px-3.5 py-2.5 text-[11px] font-extrabold text-primary-hover hover:bg-[#f7f5ff]"
            >
              ⇧ {t("import")}
            </Link>
            <Button icon="＋" onClick={openAdd}>
              {t("add")}
            </Button>
          </>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex h-10 w-full max-w-[315px] items-center gap-2 rounded-lg border border-border-strong px-3 text-text-subtle">
            <span aria-hidden>⌕</span>
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                resetPaging();
              }}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              className="w-full min-w-0 bg-transparent text-[11px] text-text outline-none"
            />
          </label>
          {selectedContacts.length > 0 ? (
            <div className="flex items-center gap-2 text-[11px] text-text-muted">
              {t("selected", { count: selectedContacts.length })}
              <Button variant="outline" onClick={() => setToDelete(selectedContacts)}>
                {t("deleteSelected")}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Link
                href="/crm/import"
                className="inline-flex items-center gap-1.5 rounded-md border border-[#dad8ec] bg-surface px-3.5 py-2.5 text-[11px] font-extrabold text-primary-hover hover:bg-[#f7f5ff]"
              >
                ⇧ {t("importContacts")}
              </Link>
              <Button icon="＋" onClick={openAdd}>
                {t("add")}
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 pt-5 pb-3">
        <div className="flex min-w-0 gap-1 overflow-x-auto" role="tablist" aria-label={t("filtersLabel")}>
          {filterKeys.map((key, index) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => {
                setFilter(key);
                resetPaging();
              }}
              className={`rounded-md px-2.5 py-1.5 text-[10px] whitespace-nowrap ${
                filter === key ? "bg-primary-soft font-extrabold text-primary-hover" : "text-text-subtle hover:bg-surface-soft"
              }`}
            >
              {t(`filters.${key}`)}
              {counts.data?.[index] != null && <b className="ml-1.5 text-[9px]">{format.number(counts.data[index]!)}</b>}
            </button>
          ))}
        </div>
        <FilterMenu
          value={extra}
          lookups={lookups}
          onChange={(next) => {
            setExtra(next);
            resetPaging();
          }}
        />
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
          q || filter !== "all" || extra.stage || extra.ownerId ? (
            <EmptyState title={t("noMatches")} description={t("noMatchesHint")} />
          ) : (
            <EmptyState
              title={t("empty")}
              description={t("emptyHint")}
              action={<Button icon="＋" onClick={openAdd}>{t("add")}</Button>}
            />
          )
        ) : (
          <div aria-busy={list.loading} className={list.loading ? "opacity-60 transition-opacity" : ""}>
            <Table
              columns={columns}
              rows={rows}
              rowKey={(c) => c.id}
              onRowClick={setOpen}
              sort={sort}
              onSortChange={(next) => {
                setSort(next);
                resetPaging();
              }}
              selected={selected}
              onSelectedChange={setSelected}
              selectAllLabel={tCommon("selectAll")}
              selectRowLabel={(c) => tCommon("selectRow", { name: c.name })}
            />
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={(next) => {
                setPage(next);
                setSelected(new Set());
              }}
              summary={t("showing", { count: rows.length, total })}
              previousLabel={tCommon("previous")}
              nextLabel={tCommon("next")}
            />
          </div>
        )}
      </Card>

      <ContactFormModal
        open={formOpen}
        contact={editing}
        lookups={lookups}
        onClose={() => setFormOpen(false)}
        onSaved={(saved) => {
          setFormOpen(false);
          if (open?.id === saved.id) setOpen(saved);
          list.reload();
        }}
      />

      <ContactDrawer
        contact={open}
        lookups={lookups}
        onClose={() => setOpen(null)}
        onEdit={openEdit}
        onDelete={(contact) => setToDelete([contact])}
        onChanged={(contact) => {
          setOpen(contact);
          list.reload();
        }}
      />

      <ConfirmDialog
        open={!!toDelete}
        title={t("deleteTitle", { count: toDelete?.length ?? 0 })}
        message={
          toDelete?.length === 1
            ? t("deleteOne", { name: toDelete[0].name })
            : t("deleteMany", { count: toDelete?.length ?? 0 })
        }
        confirmLabel={tCommon("delete")}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
