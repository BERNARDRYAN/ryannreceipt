"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";

export const inputClass =
  "w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted/70 focus:border-foreground/60 focus-visible:ring-2 focus-visible:ring-foreground/15";

/** Collapsible editor section built on <details> (keyboard + a11y for free). */
export function Section({
  title,
  children,
  action,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group border-b border-border last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-4 select-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-1.5">
          <ChevronDown
            className="size-3.5 -rotate-90 text-muted transition-transform group-open:rotate-0"
            aria-hidden
          />
          <h2 className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">{title}</h2>
        </span>
        {/* Stop clicks on actions from toggling the section. */}
        {action && <span onClick={(e) => e.preventDefault()}>{action}</span>}
      </summary>
      <div className="space-y-3 px-5 pb-5">{children}</div>
    </details>
  );
}

export function Field({
  label,
  children,
  className = "",
  hint,
}: {
  label: string;
  children: (id: string) => ReactNode;
  className?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className={`space-y-1 ${className}`}>
      <label htmlFor={id} className="block text-xs font-medium text-muted">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5 text-sm">
      <span>
        {label}
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-5 w-9 shrink-0 rounded-full bg-surface-muted ring-1 ring-border transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-foreground/30 after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-surface after:shadow-sm after:transition-transform peer-checked:after:translate-x-4"
      />
    </label>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-1">
      <span className="block text-xs font-medium text-muted">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex rounded-md bg-surface-muted p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
              value === option.value ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

type NumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max: number;
  /** Fixed decimals shown when not editing (e.g. 2 -> `2.80`). Omit for integers. */
  decimals?: number;
  integer?: boolean;
};

/**
 * Text-based numeric input: free typing while focused (no `2.` -> `2` jumps),
 * clamped on every keystroke, and formatted to fixed decimals on blur.
 */
export function NumberInput({
  value,
  onValueChange,
  min = 0,
  max,
  decimals,
  integer,
  className,
  onFocus,
  onBlur,
  ...rest
}: NumberInputProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const formatted = decimals === undefined ? String(value) : value.toFixed(decimals);

  return (
    <input
      {...rest}
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      autoComplete="off"
      className={`${inputClass} tabular-nums ${className ?? ""}`}
      value={editing ?? formatted}
      onFocus={(e) => {
        setEditing(value === 0 ? "" : formatted);
        onFocus?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d.]/g, "");
        setEditing(raw);
        const n = integer ? Math.trunc(Number(raw)) : Number(raw);
        onValueChange(Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min);
      }}
      onBlur={(e) => {
        setEditing(null);
        onBlur?.(e);
      }}
    />
  );
}
