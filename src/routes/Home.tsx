import { CalendarDays, Download, Sparkles, Trash2, Upload, Users } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, buttonClass } from "../components/ui/Button";
import { Dialog } from "../components/ui/Dialog";
import { downloadText } from "../components/ui/download";
import { PageHeading } from "../components/ui/PageHeading";
import { toast } from "../components/ui/Toast";
import { exportEvents, MAX_IMPORT_BYTES } from "../lib/io";
import { format } from "../lib/money";
import { createSampleEvent } from "../lib/sample";
import { todayIso } from "../lib/timeline";
import type { Event } from "../schemas/event";
import { useEventList, useEventStore } from "../store/useEventStore";

export default function Home() {
  const events = useEventList();
  const createEvent = useEventStore((s) => s.createEvent);
  const deleteEvent = useEventStore((s) => s.deleteEvent);
  const importEvents = useEventStore((s) => s.importEvents);
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Event | null>(null);

  const openSample = () => {
    const id = createEvent(createSampleEvent(todayIso()));
    navigate(`/event/${id}`);
  };

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setImportError("That file is larger than 2 MB.");
      return;
    }
    const r = importEvents(await file.text());
    if (r.ok) {
      setImportError(null);
      toast(`Imported ${r.value} event${r.value === 1 ? "" : "s"}.`);
    } else {
      setImportError(r.error);
    }
  };

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <PageHeading title="Your celebrations" />
        <p className="max-w-2xl text-muted">
          Hostwise turns “we're having a party” into a budget, a timeline and a vendor checklist,
          and keeps them in sync when plans change.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link to="/intake" className={buttonClass("primary")}>
            <Sparkles aria-hidden="true" className="h-4 w-4" />
            Plan a new event
          </Link>
          <Button variant="secondary" onClick={openSample}>
            Use sample event
          </Button>
        </div>
      </section>

      <section aria-labelledby="events-heading" className="space-y-3">
        <h2 id="events-heading" className="text-xl font-bold">
          Saved events
        </h2>
        {events.length === 0 ? (
          <p className="text-muted">
            No events yet. Start a new plan, or open the sample to look around.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {events.map((e) => (
              <li key={e.id} className="rounded-xl border border-line bg-surface p-4">
                <h3 className="text-lg font-bold">
                  <Link to={`/event/${e.id}`} className="underline-offset-2 hover:underline">
                    {e.profile.title}
                  </Link>
                </h3>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-sm">
                  <dt>
                    <CalendarDays aria-hidden="true" className="h-4 w-4" />
                    <span className="sr-only">Date</span>
                  </dt>
                  <dd>{e.profile.date}</dd>
                  <dt>
                    <Users aria-hidden="true" className="h-4 w-4" />
                    <span className="sr-only">Guests</span>
                  </dt>
                  <dd>{e.profile.guestCount} guests</dd>
                  <dt className="font-semibold">Budget</dt>
                  <dd>{format(e.profile.totalBudget, e.profile.currency)}</dd>
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to={`/event/${e.id}`}
                    className={buttonClass("secondary")}
                    aria-label={`Open ${e.profile.title}`}
                  >
                    Open
                  </Link>
                  <Button
                    variant="ghost"
                    aria-label={`Delete ${e.profile.title}`}
                    onClick={() => setPendingDelete(e)}
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="backup-heading" className="space-y-3">
        <h2 id="backup-heading" className="text-xl font-bold">
          Backup
        </h2>
        <p className="text-sm text-muted">
          Export saves every event as a JSON file. Import adds events from a Hostwise export.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={events.length === 0}
            onClick={() => downloadText("hostwise-events.json", exportEvents(events))}
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            Export all events
          </Button>
          <Button variant="secondary" onClick={() => fileInput.current?.click()}>
            <Upload aria-hidden="true" className="h-4 w-4" />
            Import events
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-label="Choose a Hostwise export file"
            onChange={onImport}
          />
        </div>
        {importError ? (
          <p role="alert" className="font-medium text-danger">
            {importError} Your saved events were not changed.
          </p>
        ) : null}
      </section>

      <Dialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete this event?"
        description={`“${pendingDelete?.profile.title ?? ""}” will be removed from this browser. This can't be undone.`}
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" data-autofocus onClick={() => setPendingDelete(null)}>
            Keep it
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (pendingDelete) deleteEvent(pendingDelete.id);
              setPendingDelete(null);
            }}
          >
            Delete event
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
