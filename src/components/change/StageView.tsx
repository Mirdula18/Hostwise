import { ImpactSummary } from "./ImpactSummary";
import { OptionCard } from "./OptionCard";
import type { RankedOption } from "../../lib/ranking";
import type { Event, Impact } from "../../schemas/event";

/** Where the change flow is: typing, reading the change, ranking, or choosing an option. */
export type Stage =
  | { kind: "input" }
  | { kind: "parsing" }
  | { kind: "ranking"; impact: Impact }
  | { kind: "options"; impact: Impact; options: RankedOption[]; ranked: boolean };

type Props = {
  event: Event;
  stage: Stage;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

/** The live part of the change page; rendered inside an aria-live region. */
export function StageView({ event, stage, selectedId, onSelect }: Props) {
  const guestRequest =
    stage.kind === "options" && stage.impact.request.kind === "guests"
      ? stage.impact.request.newCount
      : undefined;
  return (
    <>
      {stage.kind === "parsing" ? <p>Reading your change…</p> : null}
      {stage.kind === "ranking" ? (
        <>
          <ImpactSummary event={event} impact={stage.impact} />
          <p>Weighing the options against your priorities…</p>
        </>
      ) : null}
      {stage.kind === "options" ? (
        <>
          <ImpactSummary event={event} impact={stage.impact} />
          {!stage.ranked && stage.options.length > 1 ? (
            <p className="text-sm text-muted">
              The assistant couldn't rank these right now, so they are listed in Hostwise's order.
              Every option still balances your budget exactly.
            </p>
          ) : null}
          <section aria-labelledby="options-heading" className="space-y-2">
            <h2 id="options-heading" className="text-xl font-bold">
              Your options
            </h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {stage.options.map((o) => (
                <OptionCard
                  key={o.id}
                  event={event}
                  option={o}
                  newGuestCount={guestRequest}
                  ranked={stage.ranked}
                  selected={o.id === selectedId}
                  onSelect={() => onSelect(o.id)}
                />
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </>
  );
}
