import type { Note } from "../note";
import { DEMO_WORKSPACE_ID } from "./pipeline";

// Sample notes from the MagicPath design (design/src/components/generated/LuluCRM.tsx).
// Times are relative to `now`, like the sample tasks: today 09:18, yesterday 15:40 and earlier this week (the design shows "Mon, 11:22").

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

function daysAgoAt(now: Date, days: number, hours: number, minutes: number): string {
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - days * DAY_MS;
  return new Date(day + (hours * 60 + minutes) * MINUTE_MS).toISOString();
}

export function demoNotes(now: Date = new Date()): Note[] {
  const note = (fields: Omit<Note, "workspaceId" | "createdAt" | "updatedAt" | "deletedAt">, at: string): Note => ({
    ...fields,
    workspaceId: DEMO_WORKSPACE_ID,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
  });

  return [
    note(
      {
        id: "note_northstar_criteria",
        title: "Northstar decision criteria",
        body: "They care most about approval flows and the shared workspace.",
        visibility: "shared",
        authorId: "user_jamie",
        recordType: "company",
        recordId: "company_northstar",
      },
      daysAgoAt(now, 0, 9, 18),
    ),
    // Alex's private note: in mock mode the current user is Jamie, so it is not shown.
    note(
      {
        id: "note_klarwerk_next_step",
        title: "Klarwerk next step",
        body: "Send finance workflow example before the next call.",
        visibility: "private",
        authorId: "user_alex",
        recordType: "deal",
        recordId: "deal_klarwerk",
      },
      daysAgoAt(now, 1, 15, 40),
    ),
    note(
      {
        id: "note_roam_context",
        title: "Roam & Root context",
        body: "Founder prefers short, visual updates and async follow-up.",
        visibility: "shared",
        authorId: "user_jamie",
        recordType: "contact",
        recordId: "contact_mila",
      },
      daysAgoAt(now, 5, 11, 22),
    ),
  ];
}
