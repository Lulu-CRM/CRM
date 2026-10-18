import type { SegmentColor } from "@lulu/shared";

export const colours: SegmentColor[] = ["violet", "coral", "blue", "mint", "peach"];

// Icon colours from the design's segment list.
const styles: Record<SegmentColor, string> = {
  violet: "bg-[#efedff] text-[#6258c7]",
  coral: "bg-[#fff0e7] text-[#bd7655]",
  blue: "bg-[#e6f4fb] text-[#4c96bf]",
  mint: "bg-[#e4f5eb] text-[#4e9e73]",
  peach: "bg-[#ffe2d2] text-[#b85c3a]",
};

export function SegmentIcon({ colour }: { colour: SegmentColor }) {
  return (
    <span className={`grid size-[34px] flex-none place-items-center rounded-[10px] text-base ${styles[colour]}`} aria-hidden>
      ◌
    </span>
  );
}
