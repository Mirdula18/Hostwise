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

/** ARIA wiring for the control: only the attributes that apply are present. */
function controlProps(
  id: string,
  describedByIds: (string | undefined)[],
  invalid: boolean,
  required: boolean | undefined,
): ControlProps {
  const describedBy = describedByIds.filter(Boolean).join(" ");
  return {
    id,
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
    ...(invalid ? { "aria-invalid": true as const } : {}),
    ...(required ? { required: true } : {}),
  };
}

/** A visible label, optional hint and inline error, all linked to the control. */
export function Field({ label, hint, error, required, className = "", children }: Props) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
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
      {children(controlProps(id, [hintId, errorId], Boolean(error), required))}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
