import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type Tone = "neutral" | "brand" | "ok" | "warn" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "border-line text-muted",
  brand: "border-brand text-brand",
  ok: "border-ok text-ok",
  warn: "border-warn text-warn",
  danger: "border-danger text-danger",
};

type Props = { tone?: Tone; icon?: LucideIcon; children: ReactNode; title?: string };

/** Status label: always text, optionally with an icon, never colour alone. */
export function Badge({ tone = "neutral", icon: Icon, children, title }: Props) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border bg-surface px-2 py-0.5 text-xs font-semibold ${TONES[tone]}`}
    >
      {Icon ? <Icon aria-hidden="true" className="h-3.5 w-3.5" /> : null}
      {children}
    </span>
  );
}
