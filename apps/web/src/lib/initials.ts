import type { AvatarTone } from "@/components/ui/Avatar";

// "Jamie Morgan" -> "JM". Works for names in any script; single words give one letter.
export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => [...part][0]?.toUpperCase() ?? "")
    .join("");
}

const tones: AvatarTone[] = ["violet", "blue", "mint", "peach", "coral"];

// The same id always gets the same avatar colour.
export function toneFor(id: string): AvatarTone {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return tones[hash % tones.length];
}
