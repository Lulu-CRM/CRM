"use client";

import { useEffect, useState } from "react";
import type { DuplicateHandling, ImportJob, ImportMapping, ImportPreview } from "@lulu/shared";
import { api } from "@/lib/api";

export type Step = "upload" | "map" | "check" | "running" | "done";

export type ImportOptions = { ownerId: string; tag: string; duplicateHandling: DuplicateHandling };

// How often to ask the server whether the background import is finished.
export const POLL_MS = 1000;

/**
 * The import wizard's state: upload -> map fields -> check quality -> confirm, then wait for the
 * background job (import.process) and show what it did. Errors are thrown to the page, which shows them.
 */
export function useImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [job, setJob] = useState<ImportJob | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async <T>(work: () => Promise<T>) => {
    setBusy(true);
    try {
      return await work();
    } finally {
      setBusy(false);
    }
  };

  const upload = (file: File) =>
    run(async () => {
      const created = await api.imports.create(file);
      setJob(created);
      setMapping(created.mapping);
      setStep("map");
    });

  const check = () =>
    run(async () => {
      if (!job) return;
      setJob(await api.imports.saveMapping(job.id, mapping));
      setPreview(await api.imports.preview(job.id));
      setStep("check");
    });

  const confirm = (options: ImportOptions) =>
    run(async () => {
      if (!job) return;
      setJob(
        await api.imports.confirm(job.id, {
          ownerId: options.ownerId || undefined,
          tag: options.tag.trim() || undefined,
          duplicateHandling: options.duplicateHandling,
        }),
      );
      setStep("running");
    });

  // While the background job runs, check on it until it is done (or failed).
  const jobId = job?.id;
  useEffect(() => {
    if (step !== "running" || !jobId) return;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const latest = await api.imports.get(jobId);
        if (stopped) return;
        setJob(latest);
        if (latest.status === "done" || latest.status === "failed") setStep("done");
      } catch {
        // Keep polling; a network blip should not end the import screen.
      }
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [step, jobId]);

  const reset = () => {
    setStep("upload");
    setJob(null);
    setMapping({});
    setPreview(null);
  };

  return {
    step,
    setStep,
    job,
    setJob,
    mapping,
    setMapping,
    preview,
    busy,
    upload,
    check,
    confirm,
    reset,
    // Every column mapped at most once (except "ignore"), and a name source present.
    mappingProblem: mappingProblem(mapping),
  };
}

export function mappingProblem(mapping: ImportMapping): "noName" | "fieldTwice" | null {
  const used = Object.values(mapping).filter((f) => f !== "ignore");
  if (new Set(used).size !== used.length) return "fieldTwice";
  if (!used.includes("name") && !used.includes("firstName") && !used.includes("lastName")) return "noName";
  return null;
}
