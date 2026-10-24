"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { importFieldSchema, MAX_IMPORT_ROWS, type ImportField, type ImportPreviewRow } from "@lulu/shared";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, Card, Pill, useToast } from "@/components/ui";
import { useLookups } from "@/features/contacts/useLookups";
import { useFormat } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { HeldReview } from "./HeldReview";
import { useImportWizard, type ImportOptions, type Step } from "./useImportWizard";

const stageOrder: Step[] = ["upload", "map", "check", "running"];
const fields = importFieldSchema.options;

const inputClass =
  "w-full rounded-md border border-border-strong bg-surface px-[11px] py-2.5 text-[11px] text-text outline-none focus:border-[#8e83de] focus:shadow-[0_0_0_3px_#eeecff]";
const labelClass = "mb-1.5 block text-[10px] font-extrabold text-neutral";

export function ImportPage() {
  const t = useTranslations("import");

  return (
    <>
      <PageHeader page="import" />
      <div className="grid gap-[17px] xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{t("eyebrow")}</span>
          <h2 className="mt-1.5 text-[17px] font-semibold tracking-tight text-[#363347]">{t("title")}</h2>
          <p className="mt-1.5 max-w-[610px] text-[10px] leading-relaxed text-[#9190a0]">{t("intro")}</p>
          <ImportWizard />
        </Card>
        <SafeByDefault />
      </div>
    </>
  );
}

/**
 * The import steps (upload, map, check, confirm, then held duplicates). Used by the Import page and by
 * the import pop-up on Contacts & Companies (Dave, Oct 24, 2026). `onFinished` runs once an import ends.
 */
export function ImportWizard({ onFinished }: { onFinished?: () => void } = {}) {
  const t = useTranslations("import");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const lookups = useLookups();
  const wizard = useImportWizard();
  const [options, setOptions] = useState<ImportOptions>({ ownerId: "", tag: "", duplicateHandling: "hold" });
  const [reviewing, setReviewing] = useState(false);

  // Every step shows API errors as a toast, translated from their code.
  const attempt = (work: () => Promise<unknown>) => () => {
    work().catch((error) => toast(errorMessage(error), "error"));
  };

  const current = wizard.step === "done" ? stageOrder.length : stageOrder.indexOf(wizard.step);
  const ownerId = options.ownerId || lookups.me?.id || "";

  // Tell the caller once the import has run (the contacts list then reloads).
  const finished = wizard.step === "done";
  useEffect(() => {
    if (finished) onFinished?.();
    // onFinished may be a new function each render; only the moment the import ends matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  return (
    <>
          <ol className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={t("stepsLabel")}>
            {(["upload", "map", "check", "confirm"] as const).map((key, index) => (
              <li
                key={key}
                aria-current={index === current ? "step" : undefined}
                className={`rounded-lg border p-2.5 ${index === current ? "border-[#c9c4ef] bg-primary-soft" : index < current ? "border-border bg-surface-soft" : "border-border"}`}
              >
                <span className={`grid size-5 place-items-center rounded-full text-[9px] font-black ${index <= current ? "bg-primary text-white" : "bg-surface-muted text-text-subtle"}`}>
                  {index < current ? "✓" : index + 1}
                </span>
                <strong className="mt-1.5 block text-[10px] text-text-strong">{t(`steps.${key}.title`)}</strong>
                <small className="block text-[9px] text-text-subtle">{t(`steps.${key}.hint`)}</small>
              </li>
            ))}
          </ol>

          <div className="mt-5">
            {wizard.step === "upload" && (
              <UploadStep
                busy={wizard.busy}
                options={{ ...options, ownerId }}
                users={lookups.users}
                onOptions={setOptions}
                onFile={(file) => attempt(() => wizard.upload(file))()}
              />
            )}
            {wizard.step === "map" && wizard.job && (
              <MapStep
                fileName={wizard.job.fileName}
                rowsTotal={wizard.job.rowsTotal}
                columns={wizard.job.columns}
                sample={wizard.job.sampleRow ?? {}}
                mapping={wizard.mapping}
                problem={wizard.mappingProblem}
                busy={wizard.busy}
                onChange={(column, field) => wizard.setMapping({ ...wizard.mapping, [column]: field })}
                onBack={wizard.reset}
                onNext={attempt(wizard.check)}
              />
            )}
            {wizard.step === "check" && wizard.preview && (
              <CheckStep
                preview={wizard.preview}
                handling={options.duplicateHandling}
                busy={wizard.busy}
                onBack={() => wizard.setStep("map")}
                onConfirm={attempt(() => wizard.confirm({ ...options, ownerId }))}
              />
            )}
            {wizard.step === "running" && (
              <div role="status" className="flex items-center gap-3 rounded-lg border border-border p-5 text-[11px] text-text-muted">
                <span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
                {t("running", { count: wizard.job?.rowsTotal ?? 0 })}
              </div>
            )}
            {wizard.step === "done" && wizard.job && !reviewing && (
              <DoneStep
                added={wizard.job.rowsAdded}
                updated={wizard.job.rowsUpdated}
                held={wizard.job.rowsHeld}
                skipped={wizard.job.rowsSkipped}
                failed={wizard.job.status === "failed" ? (wizard.job.error ?? "UNKNOWN_ERROR") : null}
                onReview={() => setReviewing(true)}
                onAgain={() => {
                  setReviewing(false);
                  wizard.reset();
                }}
              />
            )}
            {wizard.step === "done" && wizard.job && reviewing && (
              <HeldReview
                job={wizard.job}
                onJobChange={wizard.setJob}
                onClose={() => setReviewing(false)}
              />
            )}
          </div>
    </>
  );
}

/** The "Safe by default" card beside the Import page's wizard. */
function SafeByDefault() {
  const t = useTranslations("import");
  return (
        <Card className="min-w-0 self-start">
          <span className="text-[9px] font-black tracking-[0.16em] text-rail-label uppercase">{t("safe.eyebrow")}</span>
          <h2 className="mt-1.5 text-[17px] font-semibold tracking-tight text-[#363347]">{t("safe.title")}</h2>
          <ul className="mt-4 grid gap-2.5 text-[10px] text-text-muted">
            {(["preview", "hold", "source", "owner"] as const).map((key) => (
              <li key={key} className="flex items-center gap-2">
                <span className="grid size-4 place-items-center rounded-full bg-success-soft text-[9px] text-success" aria-hidden>✓</span>
                {t(`safe.${key}`)}
              </li>
            ))}
          </ul>
          <p className="mt-4 flex gap-2 rounded-lg bg-info-soft p-3 text-[10px] text-[#2b6e99]">
            <span aria-hidden>i</span>
            {t("safe.consent")}
          </p>
        </Card>
  );
}

function UploadStep({
  busy,
  options,
  users,
  onOptions,
  onFile,
}: {
  busy: boolean;
  options: ImportOptions;
  users: { id: string; name: string }[];
  onOptions: (options: ImportOptions) => void;
  onFile: (file: File) => void;
}) {
  const t = useTranslations("import.upload");
  const format = useFormat();
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const [dragging, setDragging] = useState(false);

  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) onFile(file);
        }}
        className={`grid place-items-center gap-2 rounded-xl border border-dashed p-8 text-center ${dragging ? "border-primary bg-primary-soft" : "border-[#d8d5e5] bg-surface-soft"}`}
      >
        <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-lg text-primary" aria-hidden>⇧</span>
        <strong className="text-[11px] text-text-strong">{t("drop")}</strong>
        <small className="text-[9px] text-text-subtle">{t("limits", { max: format.number(MAX_IMPORT_ROWS) })}</small>
        <input
          ref={input}
          id={`${id}-file`}
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
        <Button variant="outline" loading={busy} onClick={() => input.current?.click()}>
          {t("choose")}
        </Button>
      </div>

      <div className="mt-4 grid gap-3.5 sm:grid-cols-3">
        <div>
          <label htmlFor={`${id}-owner`} className={labelClass}>{t("owner")}</label>
          <select id={`${id}-owner`} className={inputClass} value={options.ownerId} onChange={(e) => onOptions({ ...options, ownerId: e.target.value })}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-tag`} className={labelClass}>{t("tag")}</label>
          <input id={`${id}-tag`} className={inputClass} value={options.tag} maxLength={60} placeholder={t("tagPlaceholder")} onChange={(e) => onOptions({ ...options, tag: e.target.value })} />
        </div>
        <div>
          <label htmlFor={`${id}-dupes`} className={labelClass}>{t("duplicates")}</label>
          <select
            id={`${id}-dupes`}
            className={inputClass}
            value={options.duplicateHandling}
            onChange={(e) => onOptions({ ...options, duplicateHandling: e.target.value as ImportOptions["duplicateHandling"] })}
          >
            <option value="hold">{t("handling.hold")}</option>
            <option value="skip">{t("handling.skip")}</option>
            <option value="update">{t("handling.update")}</option>
          </select>
        </div>
      </div>
      <p className="mt-4 border-t border-[#efedf4] pt-3 text-[10px] text-text-subtle">{t("hint")}</p>
    </>
  );
}

function MapStep({
  fileName,
  rowsTotal,
  columns,
  sample,
  mapping,
  problem,
  busy,
  onChange,
  onBack,
  onNext,
}: {
  fileName: string;
  rowsTotal: number;
  columns: string[];
  sample: Record<string, string>;
  mapping: Record<string, ImportField>;
  problem: "noName" | "fieldTwice" | null;
  busy: boolean;
  onChange: (column: string, field: ImportField) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const t = useTranslations("import.map");
  const tField = useTranslations("import.fields");
  const tCommon = useTranslations("common");
  const recognised = Object.values(mapping).filter((f) => f !== "ignore").length;

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border border-border p-3">
        <span className="grid size-9 place-items-center rounded-lg bg-success-soft text-[9px] font-black text-success" aria-hidden>
          {fileName.split(".").pop()?.toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-[11px] text-text-strong">{fileName}</strong>
          <small className="text-[9px] text-text-subtle">{t("summary", { rows: rowsTotal, fields: recognised })}</small>
        </span>
        <Pill tone="success">{t("ready")}</Pill>
      </div>

      <table className="mt-4 w-full border-collapse text-left">
        <thead>
          <tr className="text-[9px] font-semibold tracking-[0.08em] text-[#9e9baa] uppercase">
            <th scope="col" className="border-b border-[#efedf4] py-2">{t("source")}</th>
            <th scope="col" className="border-b border-[#efedf4] py-2">{t("field")}</th>
            <th scope="col" className="hidden border-b border-[#efedf4] py-2 sm:table-cell">{t("example")}</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((column) => (
            <tr key={column} className="border-b border-surface-muted">
              <th scope="row" className="py-2 pr-3 text-[10px] font-semibold text-text-strong">{column}</th>
              <td className="py-2 pr-3">
                <select
                  aria-label={t("fieldFor", { column })}
                  className={`${inputClass} py-2`}
                  value={mapping[column] ?? "ignore"}
                  onChange={(e) => onChange(column, e.target.value as ImportField)}
                >
                  {fields.map((f) => (
                    <option key={f} value={f}>{tField(f)}</option>
                  ))}
                </select>
              </td>
              <td className="hidden max-w-[180px] truncate py-2 text-[10px] text-text-subtle sm:table-cell">{sample[column] ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {problem && <p role="alert" className="mt-3 text-[10px] text-[#c2413d]">{t(`problems.${problem}`)}</p>}

      <div className="mt-5 flex justify-end gap-2 border-t border-[#efedf4] pt-4">
        <Button variant="outline" onClick={onBack}>{tCommon("cancel")}</Button>
        <Button loading={busy} disabled={problem !== null} onClick={onNext}>{t("next")}</Button>
      </div>
    </>
  );
}

function CheckStep({
  preview,
  handling,
  busy,
  onBack,
  onConfirm,
}: {
  preview: { rowsTotal: number; newCount: number; duplicateCount: number; problemCount: number; rows: ImportPreviewRow[] };
  handling: ImportOptions["duplicateHandling"];
  busy: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("import.check");
  const tProblem = useTranslations("import.problems");

  const tiles = [
    { key: "new", value: preview.newCount, tone: "text-success" },
    { key: "duplicates", value: preview.duplicateCount, tone: "text-warning" },
    { key: "problems", value: preview.problemCount, tone: "text-[#c2413d]" },
  ] as const;

  return (
    <>
      <dl className="grid grid-cols-3 gap-2">
        {tiles.map((tile) => (
          <div key={tile.key} className="rounded-lg border border-border p-3">
            <dt className="text-[9px] text-text-subtle">{t(`tiles.${tile.key}`)}</dt>
            <dd className={`mt-1 text-xl font-bold ${tile.tone}`}>{tile.value}</dd>
          </div>
        ))}
      </dl>

      {preview.duplicateCount > 0 && (
        <div className="mt-3 flex gap-2.5 rounded-lg bg-warning-soft p-3">
          <span className="grid size-5 flex-none place-items-center rounded-full bg-warning text-[10px] font-black text-white" aria-hidden>!</span>
          <div>
            <strong className="block text-[10px] text-[#7a5520]">{t(`duplicates.${handling}`, { count: preview.duplicateCount })}</strong>
            <small className="text-[9px] text-[#8f6a35]">{t(`duplicatesHint.${handling}`)}</small>
          </div>
        </div>
      )}

      <h3 className="mt-5 text-[11px] font-semibold text-text-strong">{t("firstRows", { count: preview.rows.length })}</h3>
      <ul className="mt-2">
        {preview.rows.map((row) => (
          <li key={row.rowNumber} className="flex items-center gap-2 border-b border-surface-muted py-2 text-[10px]">
            <span className="w-8 text-text-faint">{row.rowNumber}</span>
            <span className="min-w-0 flex-1 truncate">
              <strong className="text-text-strong">{row.contact.name || "–"}</strong>
              <small className="ml-2 text-text-subtle">{[row.contact.email, row.contact.companyName].filter(Boolean).join(" · ")}</small>
            </span>
            {row.problems.length > 0 ? (
              <Pill tone="neutral">{row.problems.map((p) => tProblem(p)).join(", ")}</Pill>
            ) : row.duplicateOfContactId ? (
              <Pill tone="warning">{t(`match.${row.duplicateMatch}`)}</Pill>
            ) : (
              <Pill tone="success">{t("rowNew")}</Pill>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-col items-end justify-between gap-3 border-t border-[#efedf4] pt-4 sm:flex-row sm:items-center">
        <span className="text-[10px] text-text-subtle">{t("footer", { count: preview.newCount })}</span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>{t("back")}</Button>
          <Button loading={busy} onClick={onConfirm}>{t("confirm")}</Button>
        </div>
      </div>
    </>
  );
}

function DoneStep({
  added,
  updated,
  held,
  skipped,
  failed,
  onReview,
  onAgain,
}: {
  added: number;
  updated: number;
  held: number;
  skipped: number;
  failed: string | null;
  onReview: () => void;
  onAgain: () => void;
}) {
  const t = useTranslations("import.done");
  const errorMessage = useErrorMessage();

  if (failed) {
    return (
      <div role="alert" className="rounded-lg bg-[#ffe1e0] p-4 text-[11px] text-[#8a2f2c]">
        <strong className="block">{t("failed")}</strong>
        {errorMessage(new ApiError(failed, 0))}
        <div className="mt-3"><Button variant="outline" onClick={onAgain}>{t("again")}</Button></div>
      </div>
    );
  }

  return (
    <>
      <p className="rounded-lg bg-success-soft p-3 text-[11px] font-semibold text-success" role="status">{t("title")}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {([["added", added], ["updated", updated], ["held", held], ["skipped", skipped]] as const).map(([key, value]) => (
          <div key={key} className="rounded-lg border border-border p-3">
            <dt className="text-[9px] text-text-subtle">{t(`counts.${key}`)}</dt>
            <dd className="mt-1 text-xl font-bold text-text-strong">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#efedf4] pt-4">
        <Button variant="outline" onClick={onAgain}>{t("again")}</Button>
        <Link href="/crm/contacts" className="inline-flex items-center rounded-md border border-[#dad8ec] px-3.5 py-2.5 text-[11px] font-extrabold text-primary-hover hover:bg-[#f7f5ff]">
          {t("viewContacts")}
        </Link>
        {held > 0 && <Button onClick={onReview}>{t("review", { count: held })}</Button>}
      </div>
    </>
  );
}
