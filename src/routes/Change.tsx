import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChangeBox } from "../components/change/ChangeBox";
import { DiffPreview } from "../components/change/DiffPreview";
import { OptionCard } from "../components/change/OptionCard";
import { AIErrorAlert } from "../components/ui/AIErrorAlert";
import { LiveRegion } from "../components/ui/LiveRegion";
import { PageHeading } from "../components/ui/PageHeading";
import { toast } from "../components/ui/Toast";
import { AIError, callAI } from "../lib/ai/client";
import { debounce } from "../lib/ai/debounce";
import { applyOption, computeImpact, describeChange, generateOptions } from "../lib/change";
import { format } from "../lib/money";
import { PRIORITY_LABELS } from "../lib/priorities";
import { checkChange, diffEvents, mergeRanking, type RankedOption } from "../lib/ranking";
import { todayIso } from "../lib/timeline";
import { RankResult } from "../schemas/ai";
import { ChangeRequest, type Event, type Impact } from "../schemas/event";
import { useEvent, useEventStore } from "../store/useEventStore";
import NotFound from "./NotFound";

type Stage =
  | { kind: "input" }
  | { kind: "parsing" }
  | { kind: "ranking"; impact: Impact }
  | { kind: "options"; impact: Impact; options: RankedOption[]; ranked: boolean };

function ImpactSummary({ event, impact }: { event: Event; impact: Impact }) {
  const { currency, priorities } = event.profile;
  const money = (n: number) => format(n, currency);
  const request = impact.request;
  return (
    <section
      aria-labelledby="impact-heading"
      className="space-y-2 rounded-xl border border-line bg-surface p-4"
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

export default function Change() {
  const { id } = useParams();
  const event = useEvent(id);
  const applyChange = useEventStore((s) => s.applyChange);
  const undo = useEventStore((s) => s.undo);
  const navigate = useNavigate();
  const today = todayIso();
  const [stage, setStage] = useState<Stage>({ kind: "input" });
  const [notice, setNotice] = useState<string | null>(null);
  const [aiError, setAiError] = useState<{ message: string; text: string } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const eventRef = useRef(event);
  eventRef.current = event;

  const run = async (request: ChangeRequest) => {
    const e = eventRef.current;
    if (!e) return;
    setAiError(null);
    setSelectedId(null);
    const checked = checkChange(e, request, today);
    if (!checked.ok) {
      setNotice(checked.error);
      setStage({ kind: "input" });
      return;
    }
    setNotice(null);
    const impact = computeImpact(e, checked.value);
    const options = generateOptions(e, impact);
    if (options.length <= 1) {
      setStage({
        kind: "options",
        impact,
        options: mergeRanking(e, impact, options, null),
        ranked: false,
      });
      setSelectedId(options[0]?.id ?? null);
      return;
    }
    setStage({ kind: "ranking", impact });
    let ranking: RankResult | null = null;
    try {
      ranking = await callAI(
        "rank_options",
        {
          profile: {
            priorities: e.profile.priorities,
            guestCount: e.profile.guestCount,
            occasion: e.profile.occasion,
          },
          impact,
          options,
          categories: e.budget.map((l) => ({
            category: l.category,
            allocated: l.allocated,
            locked: l.locked,
          })),
        },
        RankResult,
      );
    } catch {
      ranking = null;
    }
    setStage({
      kind: "options",
      impact,
      options: mergeRanking(e, impact, options, ranking),
      ranked: ranking !== null,
    });
  };

  const runRef = useRef(run);
  runRef.current = run;

  const parse = useMemo(
    () =>
      debounce(async (text: string) => {
        const e = eventRef.current;
        if (!e) return;
        setStage({ kind: "parsing" });
        setAiError(null);
        try {
          const request = await callAI(
            "parse_change",
            {
              text,
              today,
              eventDate: e.profile.date,
              currency: e.profile.currency,
              guestCount: e.profile.guestCount,
              totalBudget: e.profile.totalBudget,
              tasks: e.tasks
                .filter((t) => t.status !== "done")
                .slice(0, 60)
                .map((t) => ({ id: t.id, title: t.title })),
            },
            ChangeRequest,
          );
          await runRef.current(request);
        } catch (err) {
          setStage({ kind: "input" });
          setAiError({
            message: err instanceof AIError ? err.message : "Something went wrong.",
            text,
          });
        }
      }, 500),
    [today],
  );

  useEffect(() => () => parse.cancel(), [parse]);

  const preview = useMemo(() => {
    if (!event || stage.kind !== "options" || !selectedId) return null;
    const option = stage.options.find((o) => o.id === selectedId);
    if (!option) return null;
    const r = applyOption(event, stage.impact, option);
    return r.ok ? { option, diff: diffEvents(event, r.value) } : null;
  }, [event, stage, selectedId]);

  if (!event) return <NotFound />;

  const apply = () => {
    if (stage.kind !== "options" || !preview) return;
    const r = applyChange(event.id, stage.impact, preview.option);
    if (!r.ok) {
      setNotice("That option no longer fits the current plan. Please start again.");
      setStage({ kind: "input" });
      return;
    }
    toast(`Change applied: ${preview.option.label}.`, {
      label: "Undo",
      onClick: () => undo(event.id),
    });
    navigate(`/event/${event.id}`);
  };

  const busy = stage.kind === "parsing" || stage.kind === "ranking";
  const guestRequest =
    stage.kind === "options" && stage.impact.request.kind === "guests"
      ? stage.impact.request.newCount
      : undefined;

  return (
    <div className="space-y-6">
      <Link
        to={`/event/${event.id}`}
        className="inline-flex min-h-11 items-center gap-1 font-semibold text-brand underline"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Back to {event.profile.title}
      </Link>
      <PageHeading title="What changed?" />
      <p className="max-w-2xl text-muted">
        Tell Hostwise what changed. It works out the impact, offers trade-offs ranked by your
        priorities, and shows exactly what will change before you apply anything.
      </p>

      <ChangeBox
        event={event}
        today={today}
        busy={busy}
        onText={(text) => {
          setNotice(null);
          setStage({ kind: "parsing" });
          parse(text);
        }}
        onRequest={(r) => void run(r)}
      />

      {aiError ? (
        <AIErrorAlert
          message={`${aiError.message} You can also use the quick buttons above.`}
          onRetry={() => parse(aiError.text)}
        />
      ) : null}

      <LiveRegion busy={busy} className="space-y-4">
        {notice ? <p className="rounded-lg border border-warn p-3 font-medium">{notice}</p> : null}
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
                    onSelect={() => setSelectedId(o.id)}
                  />
                ))}
              </ul>
            </section>
          </>
        ) : null}
      </LiveRegion>

      {preview ? (
        <DiffPreview
          label={preview.option.label}
          diff={preview.diff}
          currency={event.profile.currency}
          eventDate={event.profile.date}
          onApply={apply}
          onCancel={() => {
            setSelectedId(null);
            setStage({ kind: "input" });
          }}
        />
      ) : null}
    </div>
  );
}
