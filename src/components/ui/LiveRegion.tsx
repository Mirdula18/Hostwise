import type { ReactNode } from "react";

type Props = { children?: ReactNode; busy?: boolean; className?: string; label?: string };

/** Polite live region for AI answers and computed results. */
export function LiveRegion({ children, busy = false, className = "", label }: Props) {
  return (
    <div aria-live="polite" aria-busy={busy} aria-label={label} className={className}>
      {children}
    </div>
  );
}
