import { useId } from "react";
import type { Source } from "../../schemas/event";

const LABEL: Record<Source, string> = {
  estimate: "Estimate",
  user: "Your number",
  quote: "Vendor quote",
};

const EXPLAIN: Record<Source, string> = {
  estimate:
    "Worked out from the AI's suggested percentage of your budget. It is not a vendor price.",
  user: "An amount you set yourself.",
  quote: "Comes from a vendor quote you accepted.",
};

const STYLE: Record<Source, string> = {
  estimate: "border-warn text-warn",
  user: "border-ink text-ink",
  quote: "border-ok text-ok",
};

/** Text label for where a number came from, with a tooltip on hover or keyboard focus. */
export function SourceBadge({ source }: { source: Source }) {
  const id = useId();
  return (
    <span className="group relative inline-flex">
      <button type="button" aria-describedby={id} className="inline-flex min-h-11 items-center">
        <span
          className={`rounded-full border bg-surface px-2 py-0.5 text-xs font-semibold ${STYLE[source]}`}
        >
          {LABEL[source]}
        </span>
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-10 hidden w-56 rounded-lg bg-ink p-2 text-xs text-white shadow-lg group-focus-within:block group-hover:block"
      >
        {EXPLAIN[source]}
      </span>
    </span>
  );
}
