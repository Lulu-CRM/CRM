// Links for the contact channels on a company (Dave, Oct 24, 2026): clicking opens the conversation or
// the profile. Values are stored as people typed them (a handle, a page name or a full link).

/** WhatsApp chat (WhatsApp Web or the app) for a number such as "+49 176 41474606". */
export function whatsappUrl(number: string): string | null {
  const digits = number.replace(/\D/g, "");
  return digits.length >= 6 ? `https://wa.me/${digits}` : null;
}

function profileUrl(value: string, host: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  // A full or partial link to this site: keep its path, always over https.
  const link = trimmed.match(new RegExp(`^(?:https?://)?(?:www\\.|m\\.)?${host.replace(".", "\\.")}(/.*)?$`, "i"));
  if (link) return `https://${host}${link[1] ?? "/"}`;
  // A link to another site is not a profile here.
  if (/^https?:\/\//i.test(trimmed) || trimmed.includes("/")) return null;
  const handle = trimmed.replace(/^@/, "");
  return /^[\w.\-]+$/.test(handle) ? `https://${host}/${handle}` : null;
}

/** Instagram profile for "@handle", "handle" or an instagram.com link. */
export function instagramUrl(value: string): string | null {
  return profileUrl(value, "instagram.com");
}

/** Facebook page for a page name or a facebook.com link. */
export function facebookUrl(value: string): string | null {
  return profileUrl(value, "facebook.com");
}
