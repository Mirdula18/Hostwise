import { useId, type ReactNode } from "react";

export const inputClass =
  "block w-full min-h-11 rounded-lg border border-line bg-surface px-3 py-2 text-ink aria-[invalid=true]:border-danger";

type ControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  required?: boolean;
};

type Props = {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  /** Renders the control with the ids and ARIA wiring it needs. */
  children: (props: ControlProps) => ReactNode;
};

/** A visible label, optional hint and inline error, all linked to the control. */
export function Field({ label, hint, error, required, className = "", children }: Props) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`space-y-1 ${className}`}>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
        {required ? <span className="font-normal text-muted"> (required)</span> : null}
      </label>
      {hint ? (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {children({
        id,
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(error ? { "aria-invalid": true as const } : {}),
        ...(required ? { required: true } : {}),
      })}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
