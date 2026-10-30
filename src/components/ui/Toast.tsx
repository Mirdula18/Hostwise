import { X } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { create } from "zustand";
import { LIMITS } from "../../lib/constants";

export const TOAST_MS = 10_000;

type ToastAction = { label: string; onClick: () => void };
type ToastItem = { id: number; message: string; action?: ToastAction };

type ToastState = {
  toasts: ToastItem[];
  show: (message: string, action?: ToastAction) => void;
  dismiss: (id: number) => void;
};

let nextId = 1;

export const useToasts = create<ToastState>()((set) => ({
  toasts: [],
  show: (message, action) =>
    set((s) => ({
      toasts: [...s.toasts.slice(1 - LIMITS.VISIBLE_TOASTS), { id: nextId++, message, action }],
    })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (message: string, action?: ToastAction) =>
  useToasts.getState().show(message, action);

function ToastCard({ item }: { item: ToastItem }) {
  const dismiss = useToasts((s) => s.dismiss);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const start = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => dismiss(item.id), TOAST_MS);
  }, [dismiss, item.id]);
  useEffect(() => {
    start();
    return () => clearTimeout(timer.current);
  }, [start]);

  return (
    <div
      className="flex items-center gap-3 rounded-xl bg-ink px-4 py-2 text-white shadow-lg"
      onFocus={() => clearTimeout(timer.current)}
      onBlur={start}
      onMouseEnter={() => clearTimeout(timer.current)}
      onMouseLeave={start}
    >
      <p className="flex-1 text-sm">{item.message}</p>
      {item.action ? (
        <button
          type="button"
          className="min-h-11 rounded-lg px-3 text-sm font-bold underline outline-white"
          onClick={() => {
            item.action?.onClick();
            dismiss(item.id);
          }}
        >
          {item.action.label}
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Dismiss notification"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg outline-white"
        onClick={() => dismiss(item.id)}
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Polite notifications that stay at least 10 s and pause while focused or hovered. */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-2 bottom-2 z-50 mx-auto flex max-w-md flex-col gap-2 print:hidden"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} item={t} />
      ))}
    </div>
  );
}
