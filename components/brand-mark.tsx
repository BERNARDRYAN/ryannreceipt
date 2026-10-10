/** RyannReceipt mark: a receipt slip with a torn bottom edge and two print lines. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path
        d="M9 7h14v17l-2.33-1.75L18.33 24 16 22.25 13.67 24l-2.34-1.75L9 24z"
        fill="var(--background, #f3f1ec)"
      />
      <path d="M12 12h8M12 15.5h8M12 19h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
