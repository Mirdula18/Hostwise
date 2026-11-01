import { ListChecks, Shuffle, Sparkles, Wallet } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { paths } from "./paths";
import { BackupSection } from "../components/home/BackupSection";
import { EventCard } from "../components/home/EventCard";
import { Button, buttonClass } from "../components/ui/Button";
import { Dialog } from "../components/ui/Dialog";
import { PageHeading } from "../components/ui/PageHeading";
import { todayIso } from "../lib/dates";
import { createSampleEvent } from "../lib/sample";
import { useEventList, useEventStore } from "../store/useEventStore";
import type { Event } from "../schemas/event";

const FEATURES = [
  { icon: Wallet, title: "A budget that adds up", text: "Split by what matters most to you." },
  {
    icon: ListChecks,
    title: "A timeline in order",
    text: "Tasks that wait on each other move together.",
  },
  { icon: Shuffle, title: "Changes, handled", text: "See the trade-offs before anything changes." },
];

export default function Home() {
  const events = useEventList();
  const createEvent = useEventStore((s) => s.createEvent);
  const deleteEvent = useEventStore((s) => s.deleteEvent);
  const navigate = useNavigate();
  const [pendingDelete, setPendingDelete] = useState<Event | null>(null);
  const today = todayIso();

  const openSample = () => {
    const id = createEvent(createSampleEvent(todayIso()));
    void navigate(paths.event(id));
  };

  return (
    <div className="space-y-8">
      <section className="space-y-5 rounded-2xl border border-edge bg-gradient-to-br from-brand/10 via-surface to-surface p-5 shadow-sm sm:p-8">
        <PageHeading title="Your celebrations" />
        <p className="max-w-2xl text-lg text-muted">
          Hostwise turns “we're having a party” into a budget, a timeline and a vendor checklist,
          and keeps them in sync when plans change.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link to={paths.intake} className={buttonClass("primary")}>
            <Sparkles aria-hidden="true" className="h-4 w-4" />
            Plan a new event
          </Link>
          <Button variant="secondary" onClick={openSample}>
            Use sample event
          </Button>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3 rounded-xl bg-surface/80 p-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="block text-sm text-muted">{text}</span>
              </span>
            </li>
          ))}
        </ul>
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
              <EventCard key={e.id} event={e} today={today} onDelete={() => setPendingDelete(e)} />
            ))}
          </ul>
        )}
      </section>

      <BackupSection events={events} />

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
