"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { CompanyListItem, CompanyListQuery } from "@lulu/shared";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, Card, ConfirmDialog, EmptyState, Pagination, SkeletonRows, useToast } from "@/components/ui";
import { useFormat } from "@/i18n/format";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { useApi, useDebounced } from "@/lib/useApi";
import { useLookups } from "@/features/contacts/useLookups";
import { CompanyDrawer } from "./CompanyDrawer";
import { CompanyFormModal } from "./CompanyFormModal";
import { CompanyRow } from "./CompanyRow";
import { filterKeys, sortLabelKey, sortOptions, type FilterKey, type SortOption } from "./options";

const PAGE_SIZE = 10;

const filterQuery = (filter: FilterKey, meId: string | undefined): Partial<CompanyListQuery> =>
  filter === "mine" ? { ownerId: meId } : {};

export function CompaniesPage() {
  const t = useTranslations("companies");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const lookups = useLookups();
  const meId = lookups.me?.id;

  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim());
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortOption>("-openDealValue");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyListItem | null>(null);
  const [open, setOpen] = useState<CompanyListItem | null>(null);
  const [toDelete, setToDelete] = useState<CompanyListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filterReady = filter !== "mine" || !!meId;
  const list = useApi(
    () =>
      filterReady
        ? api.companies.list({ q: q || undefined, sort, page, pageSize: PAGE_SIZE, ...filterQuery(filter, meId) })
        : new Promise<never>(() => {}),
    [q, sort, page, filter, meId],
  );

  // One count per chip, with the search applied.
  const counts = useApi(
    () =>
      Promise.all(
        filterKeys.map((key) =>
          key === "mine" && !meId
            ? Promise.resolve(null)
            : api.companies.list({ q: q || undefined, pageSize: 1, ...filterQuery(key, meId) }).then((r) => r.meta.total),
        ),
      ),
    [q, meId, list.data],
  );

  // Industries already in use, offered as suggestions in the form.
  const industries = [...new Set(lookups.companies.map((c) => c.industry).filter((i): i is string => !!i))].sort();

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.companies.remove(toDelete.id);
      toast(t("deleted"));
      if (open?.id === toDelete.id) setOpen(null);
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

  return (
    <>
      <PageHeader
        page="companies"
        actions={
          <Button icon="＋" onClick={openAdd}>
            {t("add")}
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{t("eyebrow")}</span>
            <h2 className="mt-1.5 text-[17px] font-semibold text-text">{t("title")}</h2>
            <p className="mt-1 text-[11px] text-text-muted">{t("intro")}</p>
          </div>
          <label className="flex h-10 w-full max-w-[315px] items-center gap-2 rounded-lg border border-border-strong px-3 text-text-subtle">
            <span aria-hidden>⌕</span>
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              className="w-full min-w-0 bg-transparent text-[11px] text-text outline-none"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-5 pb-3">
          <div className="flex min-w-0 gap-1 overflow-x-auto" role="tablist" aria-label={t("filtersLabel")}>
            {filterKeys.map((key, index) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                onClick={() => {
                  setFilter(key);
                  setPage(1);
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
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as SortOption);
              setPage(1);
            }}
            aria-label={t("sortLabel")}
            className="rounded-md border border-border-strong bg-surface px-2 py-1.5 text-[10px] text-text-muted outline-none focus:border-[#8e83de]"
          >
            {sortOptions.map((option) => (
              <option key={option} value={option}>
                {t(`sort.${sortLabelKey(option)}`)}
              </option>
            ))}
          </select>
        </div>

        {list.error ? (
          <EmptyState
            icon="!"
            title={errorMessage(list.error)}
            action={<Button variant="outline" onClick={list.reload}>{tCommon("retry")}</Button>}
          />
        ) : list.loading && !list.data ? (
          <div className="py-4">
            <SkeletonRows rows={4} />
          </div>
        ) : rows.length === 0 ? (
          q || filter !== "all" ? (
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
            <ul aria-label={t("eyebrow")}>
              {rows.map((company) => (
                <CompanyRow key={company.id} company={company} onOpen={setOpen} />
              ))}
            </ul>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
              summary={t("showing", { count: rows.length, total })}
              previousLabel={tCommon("previous")}
              nextLabel={tCommon("next")}
            />
          </div>
        )}
      </Card>

      <CompanyFormModal
        open={formOpen}
        company={editing}
        lookups={lookups}
        industries={industries}
        onClose={() => setFormOpen(false)}
        onSaved={(saved) => {
          setFormOpen(false);
          if (open?.id === saved.id) setOpen(saved);
          list.reload();
        }}
      />

      <CompanyDrawer
        company={open}
        lookups={lookups}
        onClose={() => setOpen(null)}
        onEdit={(company) => {
          setEditing(company);
          setFormOpen(true);
        }}
        onDelete={setToDelete}
      />

      <ConfirmDialog
        open={!!toDelete}
        title={t("deleteTitle")}
        message={toDelete ? t("deleteOne", { name: toDelete.name }) : ""}
        confirmLabel={tCommon("delete")}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
