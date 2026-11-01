import { Download, Upload } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { exportEvents, MAX_IMPORT_BYTES } from "../../lib/io";
import { useEventStore } from "../../store/useEventStore";
import { Button } from "../ui/Button";
import { downloadText } from "../ui/download";
import { toast } from "../ui/Toast";
import type { Event } from "../../schemas/event";

/** Export every event as JSON, or import a Hostwise export (validated before it is used). */
export function BackupSection({ events }: { events: Event[] }) {
  const importEvents = useEventStore((s) => s.importEvents);
  const fileInput = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

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
          onChange={(e) => void onImport(e)}
        />
      </div>
      {importError ? (
        <p role="alert" className="font-medium text-danger">
          {importError} Your saved events were not changed.
        </p>
      ) : null}
    </section>
  );
}
