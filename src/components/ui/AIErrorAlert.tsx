import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";

type Props = { message: string; onRetry: () => void; children?: ReactNode };

/** Friendly AI failure with a Try again button; the rest of the app keeps working. */
export function AIErrorAlert({ message, onRetry, children }: Props) {
  return (
    <div role="alert" className="space-y-3 rounded-xl border border-danger bg-surface p-4">
      <p className="flex items-start gap-2 font-medium">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
        {message}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onRetry}>Try again</Button>
        {children}
      </div>
    </div>
  );
}
