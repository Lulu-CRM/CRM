// Labels live in messages/*.json under "nav" and "modules". Only keys and routes go here.

export const crmPages = [
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
  { key: "settings", slug: "settings", icon: "⚙\uFE0E" },
] as const;

export type CrmPageKey = (typeof crmPages)[number]["key"];

// Other Lulu modules. They belong to other teams, so they only link out for now.
export const workspaceModules = [
  { key: "onlinePresence", icon: "▦", href: "#" },
  { key: "accounting", icon: "▤", href: "#" },
  { key: "email", icon: "✉\uFE0E", href: "#" },
  { key: "calendar", icon: "◷", href: "#" },
  { key: "crm", icon: "♧", href: "/crm/overview" },
] as const;

export const extraModules = [
  { key: "marketplace", icon: "⌘", href: "#" },
  { key: "workspaceSettings", icon: "⚙\uFE0E", href: "#" },
] as const;

export function crmHref(slug: string) {
  return `/crm/${slug}`;
}

export function findCrmPage(pathname: string) {
  const slug = pathname.split("/")[2];
  return crmPages.find((page) => page.slug === slug);
}
