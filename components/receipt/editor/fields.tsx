"use client";

import { ChevronDown, Info } from "lucide-react";
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";

export const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted/70 hover:border-foreground/25 focus:border-foreground/60 focus-visible:ring-4 focus-visible:ring-foreground/8";

/** Stable DOM id for an editor field, so clicks on the paper can focus it. */
export const fieldDomId = (field: string) => `field-${field}`;

/** A titled block within an editor step. */
export function Group({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Collapsed-by-default extras, so each step shows only what most people need. */
export function MoreOptions({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen || undefined} className="group rounded-xl border border-border bg-surface-muted/40">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium select-none [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-3 border-t border-border px-4 pt-3 pb-4">{children}</div>
    </details>
  );
}

export function Field({
  label,
  children,
  className = "",
  hint,
  info,
  fieldId,
}: {
  label: string;
  children: (id: string) => ReactNode;
  className?: string;
  /** Short helper text, always visible. */
  hint?: string;
  /** Longer explanation behind an ⓘ toggle. */
  info?: string;
  /** Editor field name; gives the input a stable id (see fieldDomId). */
  fieldId?: string;
}) {
  const autoId = useId();
  const id = fieldId ? fieldDomId(fieldId) : autoId;
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center gap-1">
        <label htmlFor={id} className="block text-xs font-medium text-muted">
          {label}
        </label>
        {info && (
          <button
            type="button"
            onClick={() => setShowInfo((v) => !v)}
            aria-expanded={showInfo}
            aria-label={`About ${label}`}
            className="rounded-full p-0.5 text-muted hover:text-foreground"
          >
            <Info className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
      {children(id)}
      {info && showInfo && (
        <p className="rounded-md bg-surface-muted px-2.5 py-2 text-xs leading-relaxed text-muted animate-[fade-up_160ms_ease-out]">
          {info}
        </p>
      )}
      {hint && <p className="text-[11px] leading-snug text-muted">{hint}</p>}
    </div>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
  id,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
}) {
  return (
    <label className="relative flex cursor-pointer items-center justify-between gap-3 py-1.5 text-sm">
      <span>
        {label}
        {description && <span className="mt-0.5 block text-xs leading-snug text-muted">{description}</span>}
      </span>
      <input
        id={id}
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
    <div className="space-y-1.5">
      <span className="block text-xs font-medium text-muted">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex rounded-lg bg-surface-muted p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
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
