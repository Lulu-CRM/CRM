"use client";

import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui";
import { ImportWizard } from "./ImportPage";

/**
 * Import Contacts as a pop-up on Contacts & Companies (Dave, Oct 24, 2026), with the same steps as the
 * Import page. It starts fresh each time it opens; `onImported` runs when an import has finished.
 */
export function ImportModal({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const t = useTranslations("import");
  return (
    <Modal open={open} onClose={onClose} eyebrow={t("eyebrow")} title={t("title")} wide>
      <p className="max-w-[610px] text-[10px] leading-relaxed text-[#9190a0]">{t("intro")}</p>
      {open && <ImportWizard onFinished={onImported} />}
    </Modal>
  );
}
