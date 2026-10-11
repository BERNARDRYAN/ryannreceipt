"use client";

import { Trash2, Users } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

const THRESHOLD = 84;
const MAX = 128;

/**
 * List row that can be swiped on touch screens: right → `onSwipeRight`
 * (split), left → `onSwipeLeft` (delete, with undo). Mouse and keyboard users
 * keep the row menu; vertical scrolling is untouched.
 */
export function SwipeRow({
  children,
  className,
  onSwipeLeft,
  onSwipeRight,
  leftLabel,
  rightLabel,
}: {
  children: ReactNode;
  className?: string;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  leftLabel: string;
  rightLabel: string;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; locked: boolean | null } | null>(null);
  const swiped = useRef(false);

  const end = () => {
    if (start.current?.locked) {
      if (dx <= -THRESHOLD) onSwipeLeft();
      else if (dx >= THRESHOLD) onSwipeRight();
    }
    start.current = null;
    setDragging(false);
    setDx(0);
  };

  const armed = Math.abs(dx) >= THRESHOLD;

  return (
    <li className="relative overflow-hidden">
      {dx !== 0 && (
        <div aria-hidden className="absolute inset-0 flex items-center justify-between text-sm font-medium">
          <span className={`flex h-full items-center gap-2 px-5 transition-colors ${dx > 0 && armed ? "bg-accent text-accent-contrast" : "bg-surface-muted text-foreground"}`} style={{ width: Math.max(dx, 0) }}>
            <Users className="size-4 shrink-0" />
            {dx > 56 && <span className="truncate">{rightLabel}</span>}
          </span>
          <span className={`flex h-full items-center justify-end gap-2 px-5 transition-colors ${dx < 0 && armed ? "bg-danger text-accent-contrast" : "bg-surface-muted text-foreground"}`} style={{ width: Math.max(-dx, 0) }}>
            {dx < -56 && <span className="truncate">{leftLabel}</span>}
            <Trash2 className="size-4 shrink-0" />
          </span>
        </div>
      )}
      <div
        className={`relative bg-surface ${dragging ? "" : "transition-transform duration-200 ease-out"} ${className ?? ""}`}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, touchAction: "pan-y" }}
        onPointerDown={(e) => {
          if (e.pointerType !== "touch") return;
          start.current = { x: e.clientX, y: e.clientY, locked: null };
          swiped.current = false;
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const ddx = e.clientX - s.x;
          const ddy = e.clientY - s.y;
          if (s.locked === null) {
            if (Math.abs(ddx) > 10 && Math.abs(ddx) > Math.abs(ddy) * 1.5) {
              s.locked = true;
              swiped.current = true;
              setDragging(true);
              e.currentTarget.setPointerCapture(e.pointerId);
            } else if (Math.abs(ddy) > 10) {
              start.current = null;
              return;
            }
          }
          if (s.locked) {
            const next = Math.max(-MAX, Math.min(MAX, ddx));
            // A tiny tick when crossing the threshold, where supported.
            if (Math.abs(next) >= THRESHOLD !== Math.abs(dx) >= THRESHOLD) navigator.vibrate?.(8);
            setDx(next);
          }
        }}
        onPointerUp={end}
        onPointerCancel={end}
        // A swipe must not also open the receipt.
        onClickCapture={(e) => {
          if (swiped.current) {
            e.preventDefault();
            e.stopPropagation();
            swiped.current = false;
          }
        }}
      >
        {children}
      </div>
    </li>
  );
}
