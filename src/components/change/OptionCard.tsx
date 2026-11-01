import { AlertTriangle, ShieldCheck, Sparkles } from "lucide-react";
import { format } from "../../lib/money";
import { PRIORITY_LABELS } from "../../lib/priorities";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import type { RankedOption } from "../../lib/ranking";
import type { Event } from "../../schemas/event";

type Props = {
  event: Event;
  option: RankedOption;
  newGuestCount?: number | undefined;
  selected: boolean;
  ranked: boolean;
  onSelect: () => void;
};

const signed = (n: number, currency: string) =>
  `${n > 0 ? "+" : n < 0 ? "−" : ""}${format(Math.abs(n), currency)}`;

type BadgesProps = { option: RankedOption; ranked: boolean; top: string };

/** Rank, whether the top priority is protected, and whether the AI suggested it. */
function OptionBadges({ option, ranked, top }: BadgesProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-bold text-white">
        #{option.rank}
        {ranked && option.rank === 1 ? " · Recommended" : ""}
      </span>
      {option.respectsTopPriority ? (
        <Badge tone="ok" icon={ShieldCheck}>
          Protects {top}
        </Badge>
      ) : (
        <Badge tone="danger" icon={AlertTriangle}>
          Cuts {top}: no other option fits
        </Badge>
      )}
      {option.aiSuggested ? (
        <Badge tone="brand" icon={Sparkles}>
          Suggested by AI, checked by Hostwise
        </Badge>
      ) : null}
    </div>
  );
}

type ChangesProps = {
  option: RankedOption;
  currency: string;
  newGuestCount?: number | undefined;
};

/** The exact category, budget and guest changes this option makes. */
function OptionChanges({ option, currency, newGuestCount }: ChangesProps) {
  return (
    <ul className="text-sm text-muted">
      {option.adjustments.map((a) => (
        <li key={a.category}>
          {a.category}: {signed(a.delta, currency)}
        </li>
      ))}
      {option.budgetChange ? <li>Total budget: {signed(option.budgetChange, currency)}</li> : null}
      {option.guestCountChange !== undefined && newGuestCount !== undefined ? (
        <li>Guests: {newGuestCount + option.guestCountChange}</li>
      ) : null}
    </ul>
  );
}

export function OptionCard({ event, option, newGuestCount, selected, ranked, onSelect }: Props) {
  const { currency, priorities } = event.profile;
  const top = priorities[0] ? PRIORITY_LABELS[priorities[0]] : "your top priority";
  const headingId = `option-${option.id}`;

  return (
    <li
      aria-labelledby={headingId}
      className={`space-y-2 rounded-xl border-2 bg-surface p-4 ${selected ? "border-brand" : "border-line"}`}
    >
      <OptionBadges option={option} ranked={ranked} top={top} />
      <h3 id={headingId} className="text-lg font-bold">
        {option.label}
      </h3>
      {option.why ? <p>{option.why}</p> : null}
      {option.whatTheyGiveUp ? (
        <p className="text-sm">
          <span className="font-semibold">What you give up: </span>
          {option.whatTheyGiveUp}
        </p>
      ) : null}
      <OptionChanges option={option} currency={currency} newGuestCount={newGuestCount} />
      <Button
        variant={selected ? "primary" : "secondary"}
        aria-pressed={selected}
        aria-describedby={headingId}
        onClick={onSelect}
      >
        Preview this option
      </Button>
    </li>
  );
}
