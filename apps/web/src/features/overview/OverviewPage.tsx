"use client";

import { useTranslations } from "next-intl";
import type { Stage } from "@lulu/shared";
import { ActivityItem } from "@/features/activities/ActivityItem";
import { stageColour, useStageName } from "@/components/deals/stages";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar, Button, Card, EmptyState, Pill, Skeleton } from "@/components/ui";
import { useFormat } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { avatarTone, initials } from "@/lib/initials";
import { useApi } from "@/lib/useApi";
import { stageTone } from "@/features/contacts/options";
import { useLookups } from "@/features/contacts/useLookups";

const statDot = { contacts: "#8b74e8", pipeline: "#60a7de", followUps: "#ef806e", signals: "#62be8f" } as const;

const linkButton =
  "inline-flex items-center gap-1.5 rounded-md border border-[#dad8ec] bg-surface px-3.5 py-2.5 text-[11px] font-extrabold text-primary-hover hover:bg-[#f7f5ff]";

export function OverviewPage() {
  const t = useTranslations("overview");
  const tStage = useTranslations("lifecycleStages");
  const tCommon = useTranslations("common");
  const format = useFormat();
  const errorMessage = useErrorMessage();
  const stageName = useStageName();
  const lookups = useLookups();
  const { data, error, loading, reload } = useApi(() => Promise.all([api.overview(), api.pipelines()]), []);
  const [overview, pipelines] = data ?? [];

  const header = (
    <PageHeader
      page="overview"
      actions={
        <>
          <Link href="/crm/import" className={linkButton}>⇧ {t("import")}</Link>
          <Link href="/crm/contacts" className="inline-flex items-center gap-1.5 rounded-md border border-[#5e54dd] bg-[#5e54dd] px-3.5 py-2.5 text-[11px] font-extrabold text-white shadow-[0_7px_14px_#5e54dd22] hover:bg-[#4c42c3]">
            ＋ {t("addContact")}
          </Link>
        </>
      }
    />
  );

  if (error) {
    return (
      <>
        {header}
        <Card>
          <EmptyState icon="!" title={errorMessage(error)} action={<Button variant="outline" onClick={reload}>{tCommon("retry")}</Button>} />
        </Card>
      </>
    );
  }

  if (loading && !overview) {
    return (
      <>
        {header}
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-busy="true">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[104px] rounded-[13px]" />)}
        </div>
      </>
    );
  }
  if (!overview) return header;

  const stages = new Map<string, Stage>((pipelines?.find((p) => p.isDefault) ?? pipelines?.[0])?.stages.map((s) => [s.id, s]) ?? []);
  const largest = Math.max(1, ...overview.pipelineByStage.map((s) => s.value.amount));
  const change = overview.contactChange;

  const stats = [
    {
      key: "contacts",
      label: t("stats.contacts"),
      value: format.number(overview.contactCount),
      note:
        change === null ? (
          t("stats.contactsNoChange")
        ) : (
          <>
            <b className={change >= 0 ? "text-success" : "text-[#c2413d]"}>{format.signedPercent(change)}</b> {t("stats.vsLastMonth")}
          </>
        ),
    },
    {
      key: "pipeline",
      label: t("stats.pipeline"),
      value: format.money(overview.openPipeline),
      note: (
        <>
          <b className="text-success">{format.money(overview.weightedPipeline)}</b> {t("stats.weighted")}
        </>
      ),
    },
    {
      key: "followUps",
      label: t("stats.followUps"),
      value: format.number(overview.followUpsDue),
      note: (
        <>
          <b className="text-warning">{format.number(overview.dueToday)}</b> {t("stats.dueToday")}
        </>
      ),
    },
    {
      key: "signals",
      label: t("stats.signals"),
      value: format.number(overview.aiSignals),
      note: (
        <>
          <b className="text-success">{format.number(overview.aiSignalsThisWeek)}</b> {t("stats.sinceMonday")}
        </>
      ),
    },
  ] as const;

  return (
    <>
      {header}

      <div className="mb-4.5 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.key} className="px-[18px] py-[17px]">
            <div className="flex items-center justify-between text-[11px] text-text-muted">
              <span>{stat.label}</span>
              <span className="size-2 rounded-full" style={{ background: statDot[stat.key] }} aria-hidden />
            </div>
            <strong className="mt-3 block text-[26px] font-semibold tracking-tight text-text" data-testid={`stat-${stat.key}`}>
              {stat.value}
            </strong>
            <small className="mt-1 block text-[10px] text-text-subtle">{stat.note}</small>
          </Card>
        ))}
      </div>

      <div className="mb-4.5 grid gap-4.5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHead eyebrow={t("recent.eyebrow")} title={t("recent.title")} action={<Link href="/crm/contacts" className="text-[11px] font-extrabold text-primary-hover hover:underline">{t("viewAll")} →</Link>} />
          {overview.recentContacts.length ? (
            <ul className="mt-3">
              {overview.recentContacts.map((contact) => (
                <li key={contact.id}>
                  <Link href="/crm/contacts" className="flex items-center gap-2.5 border-t border-surface-muted py-3 hover:bg-surface-soft">
                    <Avatar initials={initials(contact.name)} tone={avatarTone(contact.id)} small />
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-[11px] text-text-strong">{contact.name}</strong>
                      <small className="block truncate text-[10px] text-text-subtle">
                        {[lookups.companyName(contact.companyId), contact.jobRole].filter(Boolean).join(" · ")}
                      </small>
                    </span>
                    <Pill tone={stageTone[contact.lifecycleStage]}>{tStage(contact.lifecycleStage)}</Pill>
                    <time className="hidden text-[10px] text-text-subtle sm:block">{contact.lastTouchAt && format.recent(contact.lastTouchAt)}</time>
                    <span className="text-[17px] text-text-faint" aria-hidden>›</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={t("recent.empty")} />
          )}
        </Card>

        <Card>
          <CardHead
            eyebrow={t("pipeline.eyebrow")}
            title={t("pipeline.title")}
            action={<Link href="/crm/deals" aria-label={t("pipeline.open")} className="text-base text-text-subtle hover:text-primary">↗</Link>}
          />
          {overview.pipelineByStage.length ? (
            <div className="mt-5 grid gap-3.5">
              {overview.pipelineByStage.map((row) => {
                const stage = stages.get(row.stageId);
                return (
                  <div key={row.stageId}>
                    <span className="flex justify-between text-[11px]">
                      <b className="text-text-strong">{stage ? stageName(stage) : "–"}</b>
                      <small className="text-text-faint">{format.money(row.value)}</small>
                    </span>
                    <i className="mt-1.5 block h-[7px] overflow-hidden rounded-lg bg-[#f0eff4]">
                      <em
                        className="block h-full rounded-lg"
                        style={{ width: `${(row.value.amount / largest) * 100}%`, background: stage ? stageColour(stage) : undefined }}
                      />
                    </i>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title={t("pipeline.empty")} />
          )}
          <div className="mt-5 flex items-center justify-between border-t border-[#efedf4] pt-4 text-[10px] text-text-subtle">
            <span>
              <span className="mr-1.5 inline-block size-1.5 rounded-full bg-[#67be8e]" aria-hidden />
              {t("pipeline.active", { count: overview.activeDeals })}
            </span>
            <Link href="/crm/deals" className={linkButton}>＋ {t("pipeline.addDeal")}</Link>
          </div>
        </Card>
      </div>

      <Card>
        <CardHead eyebrow={t("activity.eyebrow")} title={t("activity.title")} action={<Link href="/crm/activities" className="text-[11px] font-extrabold text-primary-hover hover:underline">{t("activity.open")} →</Link>} />
        {overview.recentActivity.length ? (
          <ul className="mt-2">
            {overview.recentActivity.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} actorName={lookups.userName(activity.actorId)} recordName={activity.recordName ?? undefined} />
            ))}
          </ul>
        ) : (
          <EmptyState title={t("activity.empty")} />
        )}
      </Card>
    </>
  );
}

function CardHead({ eyebrow, title, action }: { eyebrow: string; title: string; action: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{eyebrow}</span>
        <h2 className="mt-1.5 text-[17px] font-semibold tracking-tight text-[#363347]">{title}</h2>
      </div>
      {action}
    </div>
  );
}
