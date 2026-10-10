"use client";

import { useState } from "react";

import { ReceiptCanvas } from "@/components/receipt/receipt-canvas";
import { buttonStyles, Dialog } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/messages";
import { TEMPLATES, type ReceiptTemplate } from "@/lib/receipts/templates";
import { useEditorStore } from "@/lib/store/editor-store";
import { usePrefsStore } from "@/lib/store/prefs-store";
import { useReceiptStore } from "@/lib/store/receipt-store";
import type { ReceiptDraft } from "@/lib/validators/receipt-schema";

/** A scaled, non-interactive render of the template for the card. */
function TemplatePreview({ draft }: { draft: ReceiptDraft }) {
  return (
    <div className="desk-surface flex h-44 items-start justify-center overflow-hidden rounded-lg pt-3">
      <div className="receipt-shadow pointer-events-none [zoom:0.42]" aria-hidden>
        <ReceiptCanvas draft={draft} />
      </div>
    </div>
  );
}

/** Mounted only while open: previews use the current date, which can't run at prerender. */
function TemplateGrid({ onChoose }: { onChoose: (template: ReceiptTemplate) => void }) {
  const t = useT();
  const [previews] = useState(() => new Map<string, ReceiptDraft>(TEMPLATES.map((tpl) => [tpl.id, tpl.build()])));
  return (
    <ul className="grid max-h-[60dvh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
      {TEMPLATES.map((template) => (
        <li key={template.id}>
          <button
            type="button"
            onClick={() => onChoose(template)}
            className="group w-full rounded-xl p-1.5 text-left ring-1 ring-border transition-all hover:-translate-y-0.5 hover:shadow-lg hover:ring-foreground/40 focus-visible:ring-2 focus-visible:ring-foreground"
          >
            <TemplatePreview draft={previews.get(template.id)!} />
            <span className="block px-1.5 pt-2 text-sm font-semibold">{t(template.name)}</span>
            <span className="block px-1.5 pb-1 text-xs leading-snug text-muted">{t(template.description)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Gallery of starting points; opens on the first studio visit and from "New ▾". */
export function TemplatePicker() {
  const t = useT();
  const open = useEditorStore((s) => s.templatesOpen);
  const setOpen = useEditorStore((s) => s.setTemplatesOpen);
  const replayPrint = useEditorStore((s) => s.replayPrint);
  const setStep = useEditorStore((s) => s.setStep);
  const createReceipt = useReceiptStore((s) => s.createReceipt);
  const markSeen = usePrefsStore((s) => s.setTemplatesSeen);

  function close() {
    markSeen();
    setOpen(false);
  }

  function choose(template: ReceiptTemplate) {
    createReceipt(template.build());
    setStep("shop");
    replayPrint();
    close();
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      size="lg"
      title={t("templates.title")}
      description={t("templates.subtitle")}
      actions={
        <button type="button" onClick={close} className={buttonStyles.ghost}>
          {t("templates.keep")}
        </button>
      }
    >
      {open && <TemplateGrid onChoose={choose} />}
    </Dialog>
  );
}
