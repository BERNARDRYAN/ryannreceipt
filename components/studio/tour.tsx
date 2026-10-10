"use client";

import { X } from "lucide-react";
import { useSyncExternalStore } from "react";

import { useT, type MessageKey } from "@/lib/i18n/messages";
import { useEditorStore } from "@/lib/store/editor-store";
import { usePrefsStore } from "@/lib/store/prefs-store";

type TourStep = { targets: string[]; title: MessageKey; body: MessageKey };

// Each step lists targets in priority order; the first one visible on screen wins
// (desktop panels first, then their phone equivalents).
const STEPS: TourStep[] = [
  { targets: ['[data-guide="editor"]'], title: "guide.editTitle", body: "guide.editBody" },
  {
    targets: ['[data-guide="preview"]', '[data-guide="preview-tab"]'],
    title: "guide.previewTitle",
    body: "guide.previewBody",
  },
  { targets: ['[data-guide="export"]'], title: "guide.exportTitle", body: "guide.exportBody" },
];

type Rect = { x: number; y: number; w: number; h: number };

function visibleRect(selectors: string[]): string {
  for (const selector of selectors) {
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth) {
        // Clip tall targets (the editor panel) to the viewport.
        const top = Math.max(r.top, 0);
        const bottom = Math.min(r.bottom, window.innerHeight);
        return [r.left, top, r.width, bottom - top].map(Math.round).join(",");
      }
    }
  }
  return "";
}

function subscribe(onChange: () => void) {
  window.addEventListener("resize", onChange);
  window.addEventListener("scroll", onChange, true);
  // Layout settles after fonts/animations; poll briefly while the tour is open.
  const timer = window.setInterval(onChange, 250);
  return () => {
    window.removeEventListener("resize", onChange);
    window.removeEventListener("scroll", onChange, true);
    window.clearInterval(timer);
  };
}

const CARD_W = 300;
const PAD = 8;

/** Card placement: beside the target if there's room, else below, else above. */
function placeCard(r: Rect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (r.x + r.w + PAD + CARD_W + 16 < vw && r.w < vw * 0.6) {
    return { left: r.x + r.w + 16, top: Math.min(Math.max(16, r.y + 24), vh - 220) };
  }
  if (r.y + r.h + 200 < vh) {
    return { left: Math.min(Math.max(16, r.x + r.w / 2 - CARD_W / 2), vw - CARD_W - 16), top: r.y + r.h + 16 };
  }
  if (r.y > 220) {
    return { left: Math.min(Math.max(16, r.x + r.w / 2 - CARD_W / 2), vw - CARD_W - 16), top: r.y - 200 };
  }
  return { left: Math.max(16, vw / 2 - CARD_W / 2), top: vh - 236 };
}

/** Three-step spotlight tour shown once on the first studio visit. */
export function StudioTour() {
  const t = useT();
  const step = useEditorStore((s) => s.tourStep);
  const setTourStep = useEditorStore((s) => s.setTourStep);
  const setGuideDone = usePrefsStore((s) => s.setGuideDone);
  const current = step === null ? null : STEPS[step];

  const rectKey = useSyncExternalStore(
    subscribe,
    () => (current ? visibleRect(current.targets) : ""),
    () => "",
  );

  if (!current || step === null) return null;

  function finish() {
    setGuideDone(true);
    setTourStep(null);
  }

  const [x, y, w, h] = rectKey ? rectKey.split(",").map(Number) : [0, 0, 0, 0];
  const rect: Rect = { x, y, w, h };
  const card = rectKey ? placeCard(rect) : { left: 16, top: 16 };
  const last = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {rectKey ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-xl ring-2 ring-white/80 transition-all duration-300"
          style={{
            left: rect.x - PAD,
            top: rect.y - PAD,
            width: rect.w + PAD * 2,
            height: rect.h + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(10, 10, 9, 0.55)",
          }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-black/55" />
      )}
      <div
        key={step}
        className="fixed w-[300px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-surface p-4 text-foreground shadow-2xl animate-[fade-up_220ms_ease-out]"
        style={{ left: card.left, top: card.top }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="tour-title" className="font-semibold">
            {t(current.title)}
          </h2>
          <button type="button" onClick={finish} aria-label={t("common.skip")} className="-m-1 rounded-md p-1 text-muted hover:text-foreground">
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{t(current.body)}</p>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1" aria-hidden>
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-4 bg-foreground" : "w-1.5 bg-border"}`} />
            ))}
          </div>
          <div className="flex gap-1.5">
            {!last && (
              <button type="button" onClick={finish} className="rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-surface-muted">
                {t("common.skip")}
              </button>
            )}
            <button
              type="button"
              autoFocus
              onClick={() => (last ? finish() : setTourStep(step + 1))}
              className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-accent-contrast hover:opacity-90"
            >
              {last ? t("guide.finish") : t("common.next")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
