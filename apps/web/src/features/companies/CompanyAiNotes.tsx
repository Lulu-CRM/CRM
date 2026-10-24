"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { Company } from "@lulu/shared";
import { Button, useToast } from "@/components/ui";
import { AI_POLL_MS, useAiText } from "@/features/ai/aiText";
import { useFormat } from "@/i18n/format";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";

// How long to wait for the background job before giving up quietly.
const WAIT_MS = 20_000;

/**
 * The company's AI notes (Dave, Oct 24, 2026): written by the AI from everything the CRM holds about the
 * account, never typed. Refresh asks for a new version; the notes arrive when the background job is done.
 */
export function CompanyAiNotes({ company, onUpdated }: { company: Company; onUpdated: () => void }) {
  const t = useTranslations("companies.aiNotes");
  const text = useAiText();
  const format = useFormat();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [waiting, setWaiting] = useState(false);
  const since = useRef<string | null>(company.aiNotesUpdatedAt);

  // A company without notes gets them when it is opened (older companies, or a save whose job is still
  // running). Quietly: someone without companies: edit simply sees "No AI notes yet".
  useEffect(() => {
    if (company.aiNotes !== null) return;
    since.current = null;
    setWaiting(true);
    api.companies.aiNotes(company.id).catch(() => setWaiting(false));
    // Only when another company opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id]);

  // While waiting, check for a newer version, then show it.
  useEffect(() => {
    if (!waiting) return;
    const started = Date.now();
    const timer = setInterval(async () => {
      try {
        const latest = await api.companies.get(company.id);
        if (latest.aiNotesUpdatedAt !== null && latest.aiNotesUpdatedAt !== since.current) {
          setWaiting(false);
          onUpdated();
        } else if (Date.now() - started > WAIT_MS) setWaiting(false);
      } catch {
        setWaiting(false);
      }
    }, AI_POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, company.id, onUpdated]);

  const refresh = async () => {
    try {
      since.current = company.aiNotesUpdatedAt;
      setWaiting(true);
      await api.companies.aiNotes(company.id);
    } catch (error) {
      setWaiting(false);
      toast(errorMessage(error), "error");
    }
  };

  return (
    <section className="mt-6 rounded-xl border border-[#d9eee9] bg-[#f6fcfb] p-4" aria-label={t("title")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[9px] font-black tracking-[0.16em] text-[#2d6f70] uppercase">✦ {t("eyebrow")}</span>
          <h3 className="mt-1.5 text-[13px] font-semibold text-text">{t("title")}</h3>
        </div>
        <Button variant="outline" loading={waiting} onClick={refresh}>
          {company.aiNotes ? t("refresh") : t("write")}
        </Button>
      </div>
      {company.aiNotes && company.aiNotes.length > 0 ? (
        <>
          <ul className="mt-3 grid gap-1.5">
            {company.aiNotes.map((line, index) => (
              <li key={index} className="flex gap-2 text-[11px] leading-relaxed text-text-strong">
                <span aria-hidden className="text-[#258f91]">•</span>
                <span>{text(line)}</span>
              </li>
            ))}
          </ul>
          {company.aiNotesUpdatedAt && (
            <small className="mt-3 block text-[9px] text-text-faint">
              {t("written", { when: format.recent(company.aiNotesUpdatedAt) })}
            </small>
          )}
        </>
      ) : (
        <p className="mt-3 text-[11px] text-text-subtle">{waiting ? t("writing") : t("none")}</p>
      )}
    </section>
  );
}
