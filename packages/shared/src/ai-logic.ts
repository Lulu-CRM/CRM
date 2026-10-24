import type { AiInsightContent, AiText, QualityField } from "./ai";
import type { Company } from "./company";
import { belongsTo, type Contact } from "./contact";
import type { Deal } from "./deal";
import type { Stage } from "./pipeline";
import type { Activity } from "./activity";
import type { Note } from "./note";
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

/** Everything a provider may look at for one company (its AI notes). */
export type CompanyAiContext = {
  company: Company;
  contacts: Contact[];
  deals: Deal[];
  stages: Stage[];
  tasks: Task[];
  // Shared notes only: private notes never reach the AI.
  notes: Note[];
  activities: Activity[];
  now: Date;
  language: string;
};

/** The one interface every AI provider implements (AGENTS.md rule 7). */
export interface AiProvider {
  analyze(context: AiContext): Promise<AiInsightContent>;
  /** AI notes for a company: a few short lines about where the account stands and what to do next. */
  companyNotes(context: CompanyAiContext): Promise<AiText[]>;
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

/**
 * Rule-based company notes, the stand-in for a model: who the account is, its people, pipeline,
 * activity and notes, what is missing, and the next step. Each line is a translation key (aiAnalysis.generated).
 */
export function simulateCompanyNotes(context: CompanyAiContext): AiText[] {
  const { company, now } = context;
  const lines: AiText[] = [key("companyOverview", { name: company.name })];
  if (company.industry) lines.push(key("companyIndustry", { industry: company.industry }));
  if (company.productService) lines.push(key("companyProduct", { product: company.productService }));

  const people = context.contacts.filter((c) => !c.deletedAt && belongsTo(c, company.id));
  lines.push(
    people.length === 0
      ? key("companyNoPeople")
      : key("companyPeople", { count: people.length, names: people.slice(0, 3).map((c) => c.name).join(", ") }),
  );

  const openStages = new Set(context.stages.filter((s) => s.type === "open").map((s) => s.id));
  const peopleIds = new Set(people.map((c) => c.id));
  const deals = context.deals.filter(
    (d) => !d.deletedAt && (d.companyId === company.id || (d.contactId !== null && peopleIds.has(d.contactId))),
  );
  const open = deals.filter((d) => openStages.has(d.stageId));
  if (open.length === 0) lines.push(key("companyNoDeals"));
  else {
    const currency = open[0]!.currency;
    const amount = open.filter((d) => d.currency === currency).reduce((sum, d) => sum + d.value, 0);
    lines.push(key("companyDeals", { count: open.length, amount, currency }));
  }

  const touches = people.map((c) => c.lastTouchAt).filter((t): t is string => t !== null);
  const lastTouch = touches.length === 0 ? null : Math.max(...touches.map((t) => Date.parse(t)));
  const days = lastTouch === null ? null : Math.floor((now.getTime() - lastTouch) / DAY_MS);
  lines.push(days === null ? key("companyNoActivity") : key("companyLastTouch", { days }));

  const notes = context.notes.filter((n) => !n.deletedAt && n.visibility === "shared");
  if (notes.length > 0) {
    const latest = [...notes].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0]!;
    lines.push(key("companyNotes", { count: notes.length, title: latest.title }));
  }

  if (!company.whatsapp && !company.instagram && !company.facebook) lines.push(key("companyNoChannels"));

  // Next step.
  const firstOpen = open[0];
  if (people.length === 0) lines.push(key("companyNextAddPeople"));
  else if (firstOpen) lines.push(key("companyNextDeal", { deal: firstOpen.name }));
  else if (days === null || days > 30) lines.push(key("companyNextReconnect"));
  else lines.push(key("companyNextCheckIn"));
  return lines;
}

export const simulatedProvider: AiProvider = {
  analyze: async (context) => simulateInsight(context),
  companyNotes: async (context) => simulateCompanyNotes(context),
};
