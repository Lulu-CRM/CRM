import type { AiInsightContent, AiText, QualityField } from "./ai";
import type { Company } from "./company";
import type { Contact } from "./contact";
import type { Deal } from "./deal";
import type { Stage } from "./pipeline";
import type { Task } from "./task";
import { dueKind } from "./task-logic";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Everything a provider may look at for one contact. */
export type AiContext = {
  contact: Contact;
  company: Company | null;
  tasks: Task[];
  deals: Deal[];
  stages: Stage[];
  now: Date;
  // The user's language, for providers that write text.
  language: string;
};

/** The one interface every AI provider implements (AGENTS.md rule 7). */
export interface AiProvider {
  analyze(context: AiContext): Promise<AiInsightContent>;
}

/** How complete a contact is: share of the checked fields that are filled, and which are missing. */
export function dataQuality(contact: Contact): { score: number; missing: QualityField[] } {
  const checks: Record<QualityField, unknown> = {
    email: contact.email,
    phone: contact.phone,
    company: contact.companyId,
    jobRole: contact.jobRole,
    source: contact.source,
  };
  const missing = (Object.keys(checks) as QualityField[]).filter((field) => !checks[field]);
  return { score: (5 - missing.length) / 5, missing };
}

const key = (k: string, params: Record<string, string | number> = {}): AiText => ({ key: k, params });

/**
 * Rule-based stand-in for a model. It reads the same context a model would and returns the same shape,
 * so the page, the accept flow and the API can be built and tested before we have a key.
 */
export function simulateInsight(context: AiContext): AiInsightContent {
  const { contact, company, now } = context;
  const name = contact.name;
  const companyName = company?.name ?? "";
  const role = contact.jobRole ?? "";

  const contactTasks = context.tasks.filter((t) => !t.deletedAt && !t.done && t.recordType === "contact" && t.recordId === contact.id);
  const dueTask = contactTasks.find((t) => ["overdue", "today"].includes(dueKind(t, now, "UTC")));
  const openStages = new Set(context.stages.filter((s) => s.type === "open").map((s) => s.id));
  const openDeal = context.deals.find((d) => !d.deletedAt && d.contactId === contact.id && openStages.has(d.stageId));
  const daysSinceTouch = contact.lastTouchAt === null ? null : Math.floor((now.getTime() - Date.parse(contact.lastTouchAt)) / DAY_MS);
  const quiet = daysSinceTouch === null || daysSinceTouch > 30;

  // Summary: who they are and where the relationship stands.
  const summary =
    contact.lifecycleStage === "customer"
      ? key("summaryCustomer", { name, role, company: companyName })
      : openDeal
        ? key("summaryDeal", { name, role, company: companyName, deal: openDeal.name })
        : quiet
          ? key("summaryQuiet", { name, role, company: companyName })
          : key("summaryActive", { name, role, company: companyName, days: daysSinceTouch ?? 0 });

  // Next step, and the task and stage change it proposes.
  const due = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2, 12)).toISOString();
  let nextStep: AiInsightContent["nextStep"];
  let suggestedTask: AiInsightContent["suggestedTask"] = null;
  let suggestedStage: AiInsightContent["suggestedStage"] = null;

  if (dueTask) {
    nextStep = { title: key("nextFinishTask"), detail: key("nextFinishTaskDetail", { task: dueTask.title }) };
  } else if (openDeal) {
    nextStep = { title: key("nextFollowUpDeal"), detail: key("nextFollowUpDealDetail", { deal: openDeal.name }) };
    suggestedTask = { title: key("taskFollowUpDeal", { name, deal: openDeal.name }), dueAt: due };
  } else if (contact.lifecycleStage === "new" && !quiet) {
    nextStep = { title: key("nextQualify"), detail: key("nextQualifyDetail", { name }) };
    suggestedTask = { title: key("taskQualify", { name }), dueAt: due };
    suggestedStage = "qualified";
  } else if (quiet) {
    nextStep = { title: key("nextReconnect"), detail: key("nextReconnectDetail", { name }) };
    suggestedTask = { title: key("taskReconnect", { name }), dueAt: due };
  } else {
    nextStep = { title: key("nextCheckIn"), detail: key("nextCheckInDetail", { name }) };
    suggestedTask = { title: key("taskCheckIn", { name }), dueAt: due };
  }

  const quality = dataQuality(contact);
  return {
    provider: "simulated",
    summary,
    nextStep,
    suggestedTask,
    suggestedStage,
    dataQualityScore: quality.score,
    missingFields: quality.missing,
  };
}

export const simulatedProvider: AiProvider = {
  analyze: async (context) => simulateInsight(context),
};
