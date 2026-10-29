import { History, Undo2 } from "lucide-react";
import { Link } from "react-router-dom";
import type { Event } from "../../schemas/event";
import { useCanUndo, useEventStore } from "../../store/useEventStore";
import { Button, buttonClass } from "../ui/Button";
import { toast } from "../ui/Toast";

export function ChangeHistory({ event }: { event: Event }) {
  const canUndo = useCanUndo(event.id);
  const undo = useEventStore((s) => s.undo);
  const entries = [...event.changeLog].reverse();

  return (
    <section
      aria-labelledby="history-heading"
      className="space-y-2 rounded-xl border border-edge bg-surface shadow-sm p-4"
    >
      <h2 id="history-heading" className="flex items-center gap-2 text-lg font-bold">
        <History aria-hidden="true" className="h-5 w-5" />
        Changes
      </h2>
      {entries.length === 0 ? (
        <p className="text-muted">
          No changes yet. When plans shift, Hostwise shows the ripple effects.
        </p>
      ) : (
        <ol className="space-y-1">
          {entries.map((c) => (
            <li key={`${c.at}-${c.summary}`}>
              <span className="text-sm text-muted">{new Date(c.at).toLocaleString()}</span>
              <span className="block">{c.summary}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap gap-2 print:hidden">
        <Link to={`/event/${event.id}/change`} className={buttonClass("primary")}>
          Something changed
        </Link>
        {canUndo ? (
          <Button
            variant="secondary"
            onClick={() => {
              if (undo(event.id)) toast("Last change undone.");
            }}
          >
            <Undo2 aria-hidden="true" className="h-4 w-4" />
            Undo last change
          </Button>
        ) : null}
      </div>
    </section>
  );
}
