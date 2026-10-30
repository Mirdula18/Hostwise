import { describeChange } from "../../lib/change";
import { format } from "../../lib/money";
import { PRIORITY_LABELS } from "../../lib/priorities";
import type { Event, Impact } from "../../schemas/event";

/** What the change costs or frees up, and what it touches. */
export function ImpactSummary({ event, impact }: { event: Event; impact: Impact }) {
  const { currency, priorities } = event.profile;
  const money = (n: number) => format(n, currency);
  const request = impact.request;
  return (
    <section
      aria-labelledby="impact-heading"
      className="space-y-2 rounded-xl border border-edge bg-surface shadow-sm p-4"
    >
      <h2 id="impact-heading" className="text-xl font-bold">
        Impact
      </h2>
      {request.kind !== "unclear" ? (
        <p className="font-semibold">{describeChange(event, request)}</p>
      ) : null}
      {impact.gap < 0 ? (
        <p>
          This needs {money(impact.after.requiredSum)} but your budget is{" "}
          {money(impact.after.total)}: a shortfall of <strong>{money(-impact.gap)}</strong>.
        </p>
      ) : impact.gap > 0 ? (
        <p>
          You now have <strong>{money(impact.gap)}</strong> more than the plan needs.
        </p>
      ) : (
        <p>No money needs to move.</p>
      )}
      {impact.affectedCategories.length > 0 ? (
        <p className="text-sm">Categories affected: {impact.affectedCategories.join(", ")}.</p>
      ) : null}
      {impact.affectedTaskIds.length > 0 ? (
        <p className="text-sm">{impact.affectedTaskIds.length} task(s) affected.</p>
      ) : null}
      <p className="text-sm text-muted">
        Options are weighed against your priorities:{" "}
        {priorities.map((p, i) => `${i + 1}. ${PRIORITY_LABELS[p]}`).join(", ")}. Locked categories
        are never cut.
      </p>
    </section>
  );
}
