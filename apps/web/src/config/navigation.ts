// Labels live in messages/*.json under "nav" and "modules". Only keys and routes go here.

// Every CRM page with its own route. The menu (crmMenu) shows four of them, from the MagicPath
// design's update; the other pages keep their routes and stay reachable by link.
export const crmPages = [
  { key: "directory", slug: "directory", icon: "♙" },
  { key: "pipeline", slug: "pipeline", icon: "◈" },
  { key: "overview", slug: "overview", icon: "⌂" },
  { key: "contacts", slug: "contacts", icon: "♙" },
  { key: "companies", slug: "companies", icon: "▣" },
  { key: "leads", slug: "leads", icon: "◈" },
  { key: "deals", slug: "deals", icon: "↗" },
  { key: "activities", slug: "activities", icon: "✓" },
  { key: "notes", slug: "notes", icon: "▤" },
  { key: "segments", slug: "segments", icon: "◌" },
  { key: "import", slug: "import", icon: "⇧" },
  { key: "ai", slug: "ai-analysis", icon: "✦" },
  { key: "settings", slug: "settings", icon: "⚙︎" },
] as const;

export type CrmPageKey = (typeof crmPages)[number]["key"];

// The CRM menu: Contacts & Companies, Leads & Deals, Notes. Import Contacts is a pop-up on Contacts &
// Companies (Dave, Oct 24, 2026); the /crm/import page stays reachable by link.
export const crmMenu = ["directory", "pipeline", "notes"] as const satisfies readonly CrmPageKey[];

export type CrmMenuKey = (typeof crmMenu)[number];

// The menu item a page belongs to, so the right item is highlighted on the older pages too.
const menuOf: Partial<Record<CrmPageKey, CrmMenuKey>> = {
  directory: "directory",
  contacts: "directory",
  companies: "directory",
  ai: "directory",
  pipeline: "pipeline",
  leads: "pipeline",
  deals: "pipeline",
  notes: "notes",
  import: "directory",
};

export const CRM_HOME = "/crm/directory";

// Other Lulu modules. They belong to other teams, so they only link out for now.
export const workspaceModules = [
  { key: "onlinePresence", icon: "▦", href: "#" },
  { key: "accounting", icon: "▤", href: "#" },
  { key: "calendar", icon: "◷", href: "#" },
  { key: "email", icon: "✉︎", href: "#" },
] as const;

export const extraModules = [
  { key: "marketplace", icon: "⌘", href: "#" },
  { key: "workspaceSettings", icon: "⚙︎", href: "#" },
] as const;

export function crmHref(slug: string) {
  return `/crm/${slug}`;
}

export function findCrmPage(pathname: string) {
  const slug = pathname.split("/")[2];
  return crmPages.find((page) => page.slug === slug);
}

export function crmPage(key: CrmPageKey) {
  return crmPages.find((page) => page.key === key)!;
}

/** The menu item to highlight for a path (none on pages outside the menu, such as Overview). */
export function findCrmMenuItem(pathname: string): CrmMenuKey | undefined {
  const page = findCrmPage(pathname);
  return page ? menuOf[page.key] : undefined;
}
