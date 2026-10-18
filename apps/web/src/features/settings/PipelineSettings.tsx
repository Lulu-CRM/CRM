"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { Stage } from "@lulu/shared";
import { Button, Pill, useToast } from "@/components/ui";
import { stageColour, useStageName } from "@/components/deals/stages";
import { lifecycleStages } from "@/features/contacts/options";
import { api } from "@/lib/api";
import { useErrorMessage } from "@/lib/errors";
import { useApi } from "@/lib/useApi";
import { SettingsScreen, settingsInput, useCanEditSettings } from "./SettingsScreen";

export function PipelineSettings() {
  const t = useTranslations("settings.pipelines");
  const tStage = useTranslations("lifecycleStages");
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const canEdit = useCanEditSettings();
  const pipelines = useApi(() => api.pipelines(), []);
  const pipeline = pipelines.data?.find((p) => p.isDefault) ?? pipelines.data?.[0];
  const stages = pipeline?.stages ?? [];
  const open = stages.filter((s) => s.type === "open");
  const id = useId();
  const [newName, setNewName] = useState("");
  const [newProbability, setNewProbability] = useState("50");

  const act = async (work: () => Promise<unknown>, done: string) => {
    try {
      await work();
      toast(done);
      pipelines.reload();
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };

  const addStage = (event: React.FormEvent) => {
    event.preventDefault();
    if (!pipeline || !newName.trim()) return;
    void act(async () => {
      await api.settings.stages.create({ pipelineId: pipeline.id, name: newName.trim(), probability: clampPercent(newProbability) / 100 });
      setNewName("");
    }, t("added"));
  };

  return (
    <SettingsScreen section="pipelines" loading={pipelines.loading && !pipelines.data} error={pipelines.error} onRetry={pipelines.reload} canEdit={canEdit}>
      <h3 className="text-[12px] font-semibold text-text-strong">{t("dealStages")}</h3>
      <p className="mt-1 text-[10px] text-text-subtle">{t("dealStagesHint")}</p>
      <ol className="mt-3">
        {stages.map((stage) => (
          <StageRow
            key={`${stage.id}-${stage.updatedAt}`}
            stage={stage}
            canEdit={canEdit}
            first={stage.type === "open" && open[0]?.id === stage.id}
            last={stage.type === "open" && open.at(-1)?.id === stage.id}
            onSave={(input) => act(() => api.settings.stages.update(stage.id, input), t("saved"))}
            onMove={(delta) => act(() => api.settings.stages.update(stage.id, { order: open.findIndex((s) => s.id === stage.id) + delta }), t("moved"))}
            onDelete={() => act(() => api.settings.stages.remove(stage.id), t("deleted"))}
          />
        ))}
      </ol>

      {canEdit && (
        <form onSubmit={addStage} className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-[#d8d5e5] p-3">
          <div className="grid flex-1 gap-1">
            <label htmlFor={`${id}-name`} className="text-[9px] font-extrabold text-neutral">{t("newStage")}</label>
            <input id={`${id}-name`} className={settingsInput} value={newName} maxLength={40} placeholder={t("namePlaceholder")} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div className="grid w-28 gap-1">
            <label htmlFor={`${id}-probability`} className="text-[9px] font-extrabold text-neutral">{t("probability")}</label>
            <input id={`${id}-probability`} type="number" min={0} max={100} className={settingsInput} value={newProbability} onChange={(e) => setNewProbability(e.target.value)} />
          </div>
          <Button type="submit" disabled={!newName.trim()}>{t("add")}</Button>
        </form>
      )}

      <h3 className="mt-7 text-[12px] font-semibold text-text-strong">{t("lifecycle")}</h3>
      <p className="mt-1 text-[10px] text-text-subtle">{t("lifecycleHint")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {lifecycleStages.map((stage) => (
          <Pill key={stage}>{tStage(stage)}</Pill>
        ))}
      </div>
    </SettingsScreen>
  );
}

const clampPercent = (value: string) => Math.min(100, Math.max(0, Math.round(Number(value) || 0)));

function StageRow({
  stage,
  canEdit,
  first,
  last,
  onSave,
  onMove,
  onDelete,
}: {
  stage: Stage;
  canEdit: boolean;
  first: boolean;
  last: boolean;
  onSave: (input: { name?: string; probability?: number }) => void;
  onMove: (delta: number) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("settings.pipelines");
  const stageName = useStageName();
  const shownName = stageName(stage);
  const [name, setName] = useState(shownName);
  const [probability, setProbability] = useState(String(Math.round(stage.probability * 100)));
  useEffect(() => setName(shownName), [shownName]);

  const closed = stage.type !== "open";
  const dirty = name.trim() !== shownName || clampPercent(probability) !== Math.round(stage.probability * 100);

  return (
    <li className="flex flex-wrap items-center gap-2 border-t border-surface-muted py-2.5">
      <span className="size-[7px] rounded-full" style={{ background: stageColour(stage) }} aria-hidden />
      <input
        aria-label={t("nameFor", { stage: shownName })}
        className={`${settingsInput} min-w-0 flex-1`}
        value={name}
        maxLength={40}
        disabled={!canEdit}
        onChange={(e) => setName(e.target.value)}
      />
      <span className="flex items-center gap-1">
        <input
          aria-label={t("probabilityFor", { stage: shownName })}
          type="number"
          min={0}
          max={100}
          className={`${settingsInput} w-20`}
          value={probability}
          disabled={!canEdit || closed}
          onChange={(e) => setProbability(e.target.value)}
        />
        <span className="text-[10px] text-text-subtle">%</span>
      </span>
      {closed && <Pill tone={stage.type === "won" ? "success" : "neutral"}>{t(`types.${stage.type}`)}</Pill>}
      {canEdit && (
        <span className="flex items-center gap-1">
          {dirty && (
            <Button
              onClick={() =>
                onSave({
                  ...(name.trim() && name.trim() !== shownName ? { name: name.trim() } : {}),
                  ...(closed ? {} : { probability: clampPercent(probability) / 100 }),
                })
              }
            >
              {t("save")}
            </Button>
          )}
          {!closed && (
            <>
              <Button variant="ghost" disabled={first} onClick={() => onMove(-1)} aria-label={t("moveUp", { stage: shownName })}>↑</Button>
              <Button variant="ghost" disabled={last} onClick={() => onMove(1)} aria-label={t("moveDown", { stage: shownName })}>↓</Button>
              <Button variant="ghost" onClick={onDelete} aria-label={t("delete", { stage: shownName })}>✕</Button>
            </>
          )}
        </span>
      )}
    </li>
  );
}
