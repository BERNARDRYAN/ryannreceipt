"use client";

import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type KeyboardEvent } from "react";

export type ComboOption = { value: string; hint?: string };

type ComboboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "list"> & {
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  /** Called when a suggestion is picked (click, or Enter after arrowing to it). */
  onPick?: (option: ComboOption) => void;
  /** Max suggestions shown at once. */
  limit?: number;
  /** Only suggest after this many typed characters (0 = on focus). */
  minChars?: number;
  /** Receives the underlying <input> (e.g. to focus it from elsewhere). */
  inputRef?: (el: HTMLInputElement | null) => void;
};

/**
 * Free-text input with styled suggestions, replacing <datalist> (whose popup
 * the browser draws and can't be themed). The list is a `popover` in the top
 * layer, so it isn't clipped by dialogs or scroll panels.
 *
 * Enter only picks a suggestion after the user arrows to one, so it never
 * hijacks Enter-to-submit / Enter-to-next-row.
 */
export function Combobox({
  value,
  onChange,
  options,
  onPick,
  limit = 6,
  minChars = 0,
  inputRef: externalRef,
  className,
  onKeyDown,
  onFocus,
  onBlur,
  ...rest
}: ComboboxProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const q = value.trim().toLowerCase();
  const matches = options
    .filter((o) => o.value.toLowerCase() !== q && (!q || o.value.toLowerCase().includes(q)))
    .sort((a, b) => Number(b.value.toLowerCase().startsWith(q)) - Number(a.value.toLowerCase().startsWith(q)))
    .slice(0, limit);
  const visible = open && q.length >= minChars && matches.length > 0;

  // Show/position the top-layer list under the input.
  useEffect(() => {
    const list = listRef.current;
    const input = inputRef.current;
    if (!list || !input) return;
    if (!visible) {
      if (list.matches(":popover-open")) list.hidePopover();
      return;
    }
    const place = () => {
      const r = input.getBoundingClientRect();
      const below = window.innerHeight - r.bottom;
      const height = list.offsetHeight || 200;
      list.style.left = `${r.left}px`;
      list.style.width = `${Math.max(r.width, 180)}px`;
      list.style.top = below > height + 8 || r.top < height ? `${r.bottom + 4}px` : `${r.top - height - 4}px`;
    };
    if (!list.matches(":popover-open")) list.showPopover();
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [visible, matches.length]);

  function pick(option: ComboOption) {
    onChange(option.value);
    onPick?.(option);
    setOpen(false);
    setActive(-1);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (visible) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => (a + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => (a <= 0 ? matches.length - 1 : a - 1));
        return;
      }
      if (e.key === "Enter" && active >= 0 && matches[active]) {
        e.preventDefault();
        pick(matches[active]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
    }
    onKeyDown?.(e);
  }

  return (
    <>
      <input
        {...rest}
        ref={(el) => {
          inputRef.current = el;
          externalRef?.(el);
        }}
        role="combobox"
        aria-expanded={visible}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={visible && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        className={className}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={(e) => {
          setOpen(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setOpen(false);
          setActive(-1);
          onBlur?.(e);
        }}
        onKeyDown={handleKeyDown}
      />
      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        popover="manual"
        className="fixed inset-auto m-0 max-h-64 overflow-y-auto rounded-xl border border-border bg-surface p-1 text-foreground shadow-xl shadow-black/10"
      >
        {matches.map((option, i) => (
          <li
            key={option.value}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            // mousedown (not click) so the input doesn't blur first.
            onMouseDown={(e) => {
              e.preventDefault();
              pick(option);
            }}
            onMouseEnter={() => setActive(i)}
            className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm ${
              i === active ? "bg-surface-muted" : ""
            }`}
          >
            <span className="min-w-0 truncate">{option.value}</span>
            {option.hint && <span className="shrink-0 text-xs text-muted tabular-nums">{option.hint}</span>}
          </li>
        ))}
      </ul>
    </>
  );
}
