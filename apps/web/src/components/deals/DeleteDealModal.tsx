"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Deal } from "@lulu/shared";
import { Button, Modal } from "@/components/ui";

export function DeleteDealModal({
  deal,
  onClose,
  onConfirm,
}: {
  deal: Deal | null;
  onClose: () => void;
  onConfirm: (deal: Deal) => Promise<void>;
}) {
  const t = useTranslations("deals.delete");
  const tCommon = useTranslations("common");
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    if (!deal) return;
    setDeleting(true);
    try {
      await onConfirm(deal);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      open={deal !== null}
      onClose={onClose}
      eyebrow={t("eyebrow")}
      title={deal ? t("title", { name: deal.name }) : ""}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button variant="danger" loading={deleting} onClick={confirm}>
            {t("confirm")}
          </Button>
        </>
      }
    >
      <p className="text-xs leading-relaxed text-text-muted">{t("body")}</p>
    </Modal>
  );
}
