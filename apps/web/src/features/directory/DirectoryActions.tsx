"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { AiInsight, Contact, NoteCreateInput } from "@lulu/shared";
import { Button, Card, useToast } from "@/components/ui";
import { AI_POLL_MS, useAiText } from "@/features/ai/AiAnalysisPage";
import type { Lookups } from "@/features/contacts/useLookups";
import { NoteFormModal } from "@/features/notes/NoteFormModal";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { useApi } from "@/lib/useApi";

const selectClass =
  "mb-2.5 h-[35px] w-full min-w-0 rounded-lg border border-[#e5e3ec] bg-surface px-2.5 text-[10px] text-text outline-none focus:border-[#8e83de]";

/** The two cards under Contacts & Companies: add a note to a record, and run AI analysis on a contact. */
export function DirectoryActions({ lookups }: { lookups: Lookups }) {
  const contacts = useApi(() => api.contacts.list({ pageSize: 100 }), []);
  const list = contacts.data?.data ?? [];

  return (
    <div className="mt-[17px] grid gap-[17px] md:grid-cols-2">
      <NoteCard lookups={lookups} contacts={list} />
      <AiCard lookups={lookups} contacts={list} />
    </div>
  );
}

function CardShell({ icon, tone, eyebrow, title, intro, children }: {
  icon: string;
  tone: "violet" | "teal";
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex min-w-0 items-start gap-3.5">
      <span
        aria-hidden
        className={`grid size-9 flex-none place-items-center rounded-[11px] text-[15px] ${
          tone === "violet" ? "bg-[#eeecff] text-[#5d54c5]" : "bg-[#e4f5f4] text-[#258f91]"
        }`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{eyebrow}</span>
        <h3 className="mt-1.5 mb-1 text-sm font-semibold text-[#3b384b]">{title}</h3>
        <p className="mb-3 text-[10px] leading-normal text-[#8d8a9b]">{intro}</p>
        {children}
      </div>
    </Card>
  );
}

function NoteCard({ lookups, contacts }: { lookups: Lookups; contacts: Contact[] }) {
  const t = useTranslations("directory.notes");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const deals = useApi(() => api.deals.list(), []);
  const [target, setTarget] = useState("");
  const [open, setOpen] = useState(false);
  const selected = target || (contacts[0] ? `contact:${contacts[0].id}` : "");

  const save = async (input: NoteCreateInput) => {
    try {
      await api.notes.create(input);
      toast(t("saved"));
      setOpen(false);
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };

  return (
    <CardShell icon="▤" tone="violet" eyebrow={t("eyebrow")} title={t("title")} intro={t("intro")}>
      <select aria-label={t("record")} className={selectClass} value={selected} onChange={(e) => setTarget(e.target.value)}>
        <optgroup label={t("contacts")}>
          {contacts.map((c) => (
            <option key={c.id} value={`contact:${c.id}`}>
              {c.name}
            </option>
          ))}
        </optgroup>
        <optgroup label={t("companies")}>
          {lookups.companies.map((c) => (
            <option key={c.id} value={`company:${c.id}`}>
              {c.name}
            </option>
          ))}
        </optgroup>
      </select>
      <Button variant="outline" icon="＋" onClick={() => setOpen(true)}>
        {t("add")}
      </Button>
      <NoteFormModal
        open={open}
        note={null}
        related={selected}
        contacts={contacts}
        companies={lookups.companies}
        deals={deals.data?.data ?? []}
        onClose={() => setOpen(false)}
        onSubmit={save}
        onDelete={() => {}}
      />
    </CardShell>
  );
}

function AiCard({ lookups, contacts }: { lookups: Lookups; contacts: Contact[] }) {
  const t = useTranslations("directory.ai");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const text = useAiText();
  const [contactId, setContactId] = useState("");
  const selected = contacts.find((c) => c.id === contactId) ?? contacts[0];
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AiInsight | null>(null);
  const started = useRef(0);

  // The analysis runs in the background (BullMQ): check for its insight until it lands.
  useEffect(() => {
    if (!running || !selected) return;
    const timer = setInterval(async () => {
      try {
        const latest = await api.ai.latest(selected.id);
        if (latest && Date.parse(latest.createdAt) >= started.current) {
          setRunning(false);
          setResult(latest);
          toast(t("ready"));
        }
      } catch (error) {
        setRunning(false);
        toast(errorMessage(error), "error");
      }
    }, AI_POLL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, selected?.id]);

  const run = async () => {
    if (!selected) return;
    try {
      // Allow for clock drift between the browser and the server.
      started.current = Date.now() - 1000;
      setResult(null);
      setRunning(true);
      await api.ai.run(selected.id);
    } catch (error) {
      setRunning(false);
      toast(errorMessage(error), "error");
    }
  };

  return (
    <CardShell icon="✦" tone="teal" eyebrow={t("eyebrow")} title={t("title")} intro={t("intro")}>
      <select
        aria-label={t("contact")}
        className={selectClass}
        value={selected?.id ?? ""}
        disabled={running}
        onChange={(e) => {
          setContactId(e.target.value);
          setResult(null);
        }}
      >
        {contacts.map((c) => (
          <option key={c.id} value={c.id}>
            {[c.name, lookups.companyName(c.companyId)].filter(Boolean).join(" · ")}
          </option>
        ))}
      </select>
      <Button loading={running} disabled={!selected} onClick={run}>
        {running ? t("running") : t("run")}
      </Button>
      {result && selected && (
        <div className="mt-3 grid gap-1 rounded-[9px] border border-[#d9eee9] bg-[#f6fcfb] p-3" role="status">
          <strong className="text-[10px] text-[#2d6f70]">{selected.name}</strong>
          <span className="text-[9px] leading-normal text-[#6d8b8b]">{text(result.summary)}</span>
          <span className="text-[9px] leading-normal text-[#6d8b8b]">
            {t("nextStep")}: {text(result.nextStep.title)}
          </span>
          <small className="text-[9px] text-[#8da3a2]">
            {t("quality", { filled: Math.round(result.dataQualityScore * 5), total: 5 })}
          </small>
          {/* Nothing is saved here: changes are confirmed on the AI Analysis page. */}
          <Link href={`/crm/ai-analysis?contact=${selected.id}`} className="mt-1 text-[10px] font-extrabold text-primary hover:underline">
            {t("review")} →
          </Link>
        </div>
      )}
    </CardShell>
  );
}
