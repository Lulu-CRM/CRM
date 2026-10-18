"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { filterNotes, type Note, type NoteVisibility } from "@lulu/shared";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar, Button, Card, ConfirmDialog, EmptyState, Pill, Skeleton, useToast } from "@/components/ui";
import { useFormat } from "@/i18n/format";
import { useErrorMessage } from "@/lib/errors";
import { initials, toneFor } from "@/lib/initials";
import { NoteFormModal } from "./NoteFormModal";
import { useNotesPage } from "./useNotesPage";

const visibilityFilters: (NoteVisibility | "all")[] = ["all", "shared", "private"];

export function NotesPage() {
  const t = useTranslations("notes");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const page = useNotesPage();
  const { lookups } = page;
  // The API already leaves out other people's private notes. Filtering again with the
  // same rule keeps the page right in mock mode and before the current user has loaded.
  const userId = lookups.me?.id ?? "";

  const [visibility, setVisibility] = useState<NoteVisibility | "all">("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<{ note: Note | null } | null>(null);
  const [deleting, setDeleting] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);

  const visible = filterNotes(page.notes.list, userId, { q: search });
  const filtered = filterNotes(visible, userId, { visibility });
  const counts = Object.fromEntries(
    visibilityFilters.map((key) => [key, filterNotes(visible, userId, { visibility: key }).length]),
  ) as Record<NoteVisibility | "all", number>;

  const openNew = () => setForm({ note: null });
  const filtersActive = visibility !== "all" || search.trim() !== "";

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await page.remove(deleting);
      toast(t("deleted"));
      setDeleting(null);
      setForm(null);
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader page="notes" actions={<Button icon="＋" onClick={openNew}>{t("add")}</Button>} />
      <Card>
        <div className="flex flex-col items-start justify-between gap-[18px] lg:flex-row">
          <div>
            <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{t("eyebrow")}</span>
            <h2 className="mt-1.5 text-[17px] font-semibold tracking-tight text-[#363347]">{t("title")}</h2>
            <p className="mt-[7px] max-w-[610px] text-[10px] leading-relaxed text-[#9190a0]">{t("intro")}</p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:flex-none lg:flex-nowrap">
            <div role="group" aria-label={t("filters.label")} className="flex flex-wrap gap-1">
              {visibilityFilters.map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={visibility === key}
                  onClick={() => setVisibility(key)}
                  className={`rounded-[7px] px-2.5 py-[7px] text-[9px] whitespace-nowrap ${
                    visibility === key ? "bg-[#efedff] font-extrabold text-primary-hover" : "text-[#8c899b] hover:bg-surface-muted"
                  }`}
                >
                  {t(`filters.${key}`)} <b className="ml-1 text-[8px]">{counts[key]}</b>
                </button>
              ))}
            </div>
            <label className="flex h-9 w-full items-center gap-2 rounded-lg border border-border-strong px-3 text-text-subtle sm:w-[220px]">
              <span aria-hidden>⌕</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchPlaceholder")}
                aria-label={t("searchPlaceholder")}
                className="w-full min-w-0 bg-transparent text-[11px] text-text outline-none"
              />
            </label>
          </div>
        </div>

        {page.notes.loading ? (
          <div className="mt-[21px] grid gap-[13px] md:grid-cols-2 xl:grid-cols-3" aria-busy>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[190px] rounded-[11px]" />
            ))}
          </div>
        ) : page.notes.error ? (
          <EmptyState
            icon="!"
            title={errorMessage(page.notes.error)}
            action={<Button variant="outline" onClick={page.notes.reload}>{tCommon("retry")}</Button>}
          />
        ) : filtered.length === 0 ? (
          filtersActive && page.notes.list.length > 0 ? (
            <EmptyState title={t("noMatches")} description={t("noMatchesHint")} />
          ) : (
            <EmptyState title={t("empty")} description={t("emptyHint")} action={<Button onClick={openNew}>{t("add")}</Button>} />
          )
        ) : (
          <ul className="mt-[21px] grid gap-[13px] md:grid-cols-2 xl:grid-cols-3" aria-label={t("title")}>
            {filtered.map((note) => (
              <li key={note.id}>
                <NoteCard
                  note={note}
                  authorName={lookups.userName(note.authorId) ?? ""}
                  recordName={page.recordName(note)}
                  onOpen={() => setForm({ note })}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <NoteFormModal
        open={form !== null}
        note={form?.note ?? null}
        contacts={page.contacts}
        companies={lookups.companies}
        deals={page.deals}
        onClose={() => setForm(null)}
        onDelete={() => form?.note && setDeleting(form.note)}
        onSubmit={async (input) => {
          try {
            if (form?.note) await page.update(form.note, input);
            else await page.create(input);
            toast(form?.note ? t("form.saved") : t("form.created"));
            setForm(null);
          } catch (error) {
            toast(errorMessage(error), "error");
          }
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={t("deleteTitle")}
        message={t("deleteMessage", { title: deleting?.title ?? "" })}
        confirmLabel={tCommon("delete")}
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

function NoteCard({
  note,
  authorName,
  recordName,
  onOpen,
}: {
  note: Note;
  authorName: string;
  recordName: string | undefined;
  onOpen: () => void;
}) {
  const t = useTranslations("notes");
  const format = useFormat();

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t("open", { title: note.title })}
      className="flex h-full min-h-[190px] w-full cursor-pointer flex-col rounded-[11px] border border-[#e8e6f0] bg-surface p-4 text-left hover:border-[#c9c4ef] hover:shadow-[0_9px_20px_#24243a09]"
    >
      <span className="flex w-full items-center justify-between">
        <span className="grid size-7 place-items-center rounded-lg bg-[#eeecff] text-xs text-[#5d54c4]" aria-hidden>
          ▤
        </span>
        <Pill tone={note.visibility === "shared" ? "violet" : "neutral"}>{t(`visibility.${note.visibility}`)}</Pill>
      </span>
      <strong className="mt-[19px] mb-2 block text-xs text-[#3f3c4e]">{note.title}</strong>
      <span className="block min-h-[45px] text-[10px] leading-relaxed whitespace-pre-line text-[#8d8b9b] line-clamp-4">
        {note.body}
      </span>
      {recordName && (
        <span className="mt-2 block truncate text-[9px] font-extrabold text-primary-hover">
          {t(`linked.${note.recordType}`, { name: recordName })}
        </span>
      )}
      <span className="mt-auto flex w-full items-center gap-[7px] border-t border-[#f0eff5] pt-[11px]">
        {authorName && <Avatar initials={initials(authorName)} tone={toneFor(note.authorId)} small />}
        <span className="text-[9px] text-[#777487]">
          {authorName}
          <small className="mt-0.5 block text-[#aaa8b7]">{format.recent(note.updatedAt)}</small>
        </span>
      </span>
    </button>
  );
}
