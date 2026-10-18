import type { Role } from "./user.js";
import type {
  AiSettings,
  ConsentSettings,
  NotificationSettings,
  PermissionAction,
  PermissionResource,
  RolePermissions,
} from "./settings.js";

// Defaults for a new workspace, and the permission check the API's role guard and the UI share.

const all: PermissionAction[] = ["view", "create", "edit", "delete"];

export const defaultPermissions: RolePermissions = {
  admin: {
    contacts: all,
    companies: all,
    deals: all,
    tasks: all,
    notes: all,
    segments: all,
    imports: all,
    settings: ["view", "edit"],
  },
  // Members work with records but cannot delete them (tasks.md, task 2) or change settings.
  member: {
    contacts: ["view", "create", "edit"],
    companies: ["view", "create", "edit"],
    deals: ["view", "create", "edit"],
    tasks: ["view", "create", "edit"],
    notes: ["view", "create", "edit"],
    segments: ["view"],
    imports: ["view", "create"],
    settings: [],
  },
};

export const defaultConsentSettings: ConsentSettings = {
  requireConsentForMarketing: true,
  requireConsentEvidence: true,
  importedContactsConsent: "not_granted",
};

export const defaultNotificationSettings: NotificationSettings = {
  taskAssigned: { inApp: true, email: true },
  taskDue: { inApp: true, email: false },
  dealAssigned: { inApp: true, email: true },
  dealStageChanged: { inApp: true, email: false },
  leadAssigned: { inApp: true, email: true },
  importFinished: { inApp: true, email: false },
};

export const defaultAiSettings: AiSettings = {
  analyzeNewActivity: true,
  suggestFollowUps: true,
  autoUpdateFields: false,
};

/** May this role do this? Owners always may. Missing entries mean no. */
export function can(
  permissions: RolePermissions,
  role: Role,
  resource: PermissionResource,
  action: PermissionAction,
): boolean {
  if (role === "owner") return true;
  return permissions[role]?.[resource]?.includes(action) ?? false;
}

/** Field key from a label: "Preferred language" -> "preferred_language". Unique among `taken`. */
export function fieldKeyFromLabel(label: string, taken: string[]): string {
  const base =
    label
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/^(\d)/, "f_$1")
      .slice(0, 36) || "field";
  const key = /^[a-z]/.test(base) && base.length >= 2 ? base : `field_${base}`.slice(0, 36);
  if (!taken.includes(key)) return key;
  let n = 2;
  while (taken.includes(`${key}_${n}`)) n++;
  return `${key}_${n}`;
}
