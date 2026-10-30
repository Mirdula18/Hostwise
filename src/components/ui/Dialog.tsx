import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
};

/** Keeps Tab and Shift+Tab cycling inside the dialog panel. */
function trapTab(e: KeyboardEvent, panel: HTMLElement): void {
  const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return;
  const active = document.activeElement;
  const inside = panel.contains(active);
  const wrapTo = e.shiftKey
    ? active === first || !inside
      ? last
      : null
    : active === last || !inside
      ? first
      : null;
  if (!wrapTo) return;
  e.preventDefault();
  wrapTo.focus();
}

/**
 * Modal dialog: focus moves inside on open, Tab is trapped, Esc closes,
 * and focus returns to whatever opened it.
 */
export function Dialog({ open, onClose, title, description, children }: Props) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>(
      "[data-autofocus], input, select, textarea",
    );
    (first ?? panel.current)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key === "Tab" && panel.current) trapTab(e, panel.current);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/50 p-2 sm:items-center sm:p-4">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={description ? `${id}-desc` : undefined}
        tabIndex={-1}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-surface p-4 shadow-xl sm:p-6"
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <h2 id={`${id}-title`} className="text-lg font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted hover:bg-bg"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        {description ? (
          <p id={`${id}-desc`} className="mb-3 text-muted">
            {description}
          </p>
        ) : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}
