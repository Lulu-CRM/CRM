import type { Company } from "../company.js";
import type { Contact } from "../contact.js";
import type { User } from "../user.js";
import { DEMO_WORKSPACE_ID } from "./pipeline.js";

// Sample people and companies from the MagicPath design, with the same ids the deal fixtures use.

const CREATED = "2026-10-01T09:00:00.000Z";

const base = {
  workspaceId: DEMO_WORKSPACE_ID,
  createdAt: CREATED,
  updatedAt: CREATED,
  deletedAt: null,
};

export const demoUsers: User[] = [
  { ...base, id: "user_jamie", name: "Jamie Morgan", email: "jamie@lulu.demo", role: "owner", language: "en" },
  { ...base, id: "user_alex", name: "Alex Rivera", email: "alex@lulu.demo", role: "member", language: "en" },
];

export const demoCompanies: Company[] = [
  { ...base, id: "company_northstar", name: "Northstar Studio", domain: "northstar.studio", industry: "Creative services", size: "1-10", ownerId: "user_jamie" },
  { ...base, id: "company_atlas", name: "Atlas Logistics", domain: "atlaslogistics.co", industry: "Logistics", size: "11-50", ownerId: "user_jamie" },
  { ...base, id: "company_roam", name: "Roam & Root", domain: "roamandroot.com", industry: "Retail", size: "1-10", ownerId: "user_alex" },
  { ...base, id: "company_klarwerk", name: "Klarwerk GmbH", domain: "klarwerk.de", industry: "Finance", size: "11-50", ownerId: "user_jamie" },
  { ...base, id: "company_haus", name: "Haus am Fluss", domain: "hausamfluss.de", industry: "Hospitality", size: "11-50", ownerId: "user_alex" },
];

const contact = (fields: Omit<Contact, keyof typeof base | "marketingConsent" | "consentUpdatedAt">): Contact => ({
  ...base,
  marketingConsent: false,
  consentUpdatedAt: null,
  ...fields,
});

export const demoContacts: Contact[] = [
  contact({ id: "contact_sophie", name: "Sophie Laurent", email: "sophie@northstar.studio", phone: "+49 151 248 991", companyId: "company_northstar", jobRole: "Creative Director", source: "website_form", lifecycleStage: "qualified", ownerId: "user_jamie", tags: ["Design", "Warm"], lastTouchAt: "2026-10-17T09:42:00.000Z" }),
  contact({ id: "contact_daniel", name: "Daniel Chen", email: "daniel@atlaslogistics.co", phone: "+49 176 830 442", companyId: "company_atlas", jobRole: "Operations Lead", source: "referral", lifecycleStage: "customer", ownerId: "user_jamie", tags: ["Logistics", "VIP"], lastTouchAt: "2026-10-16T16:18:00.000Z" }),
  contact({ id: "contact_mila", name: "Mila Rossi", email: "mila@roamandroot.com", phone: "+49 160 441 720", companyId: "company_roam", jobRole: "Founder", source: "instagram", lifecycleStage: "new", ownerId: "user_alex", tags: ["Retail"], lastTouchAt: "2026-10-16T11:05:00.000Z" }),
  contact({ id: "contact_tobias", name: "Tobias Klein", email: "tobias@klarwerk.de", phone: "+49 171 927 006", companyId: "company_klarwerk", jobRole: "Finance Manager", source: "import", lifecycleStage: "follow_up", ownerId: "user_jamie", tags: ["Finance", "Follow-up"], lastTouchAt: "2026-10-13T14:30:00.000Z" }),
  contact({ id: "contact_elena", name: "Elena Schmidt", email: "elena@hausamfluss.de", phone: "+49 172 105 819", companyId: "company_haus", jobRole: "Managing Director", source: "email", lifecycleStage: "qualified", ownerId: "user_alex", tags: ["Hospitality"], lastTouchAt: "2026-10-13T10:12:00.000Z" }),
];
