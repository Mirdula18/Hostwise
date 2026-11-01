import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import NotFound from "./NotFound";
import { paths } from "./paths";
import { ChangeBox } from "../components/change/ChangeBox";
import { DiffPreview } from "../components/change/DiffPreview";
import { StageView, type Stage } from "../components/change/StageView";
import { AIErrorAlert } from "../components/ui/AIErrorAlert";
import { LiveRegion } from "../components/ui/LiveRegion";
import { PageHeading } from "../components/ui/PageHeading";
import { toast } from "../components/ui/Toast";
import { AIError, callAI } from "../lib/ai/client";
import { debounce } from "../lib/ai/debounce";
import { parseChangeInput, rankOptionsInput } from "../lib/ai/inputs";
import { applyOption, computeImpact, generateOptions } from "../lib/change";
import { AI_DEBOUNCE_MS } from "../lib/constants";
import { checkChange, diffEvents, mergeRanking } from "../lib/ranking";
import { todayIso } from "../lib/timeline";
import { RankResult } from "../schemas/ai";
import { ChangeRequest, type Event, type Impact, type TradeOffOption } from "../schemas/event";
import { useEvent, useEventStore } from "../store/useEventStore";

/** The AI ranking, or null so the options are shown unranked when the AI is unavailable. */
async function rankOrNull(
  event: Event,
  impact: Impact,
  options: TradeOffOption[],
): Promise<RankResult | null> {
  try {
    return await callAI("rank_options", rankOptionsInput(event, impact, options), RankResult);
  } catch {
    return null;
  }
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
    const ranking = await rankOrNull(e, impact, options);
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
      debounce((text: string) => {
        const e = eventRef.current;
        if (!e) return;
        setStage({ kind: "parsing" });
        setAiError(null);
        callAI("parse_change", parseChangeInput(e, text, today), ChangeRequest)
          .then((request) => runRef.current(request))
          .catch((err: unknown) => {
            setStage({ kind: "input" });
            setAiError({
              message: err instanceof AIError ? err.message : "Something went wrong.",
              text,
            });
          });
      }, AI_DEBOUNCE_MS),
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
    void navigate(paths.event(event.id));
  };

  const busy = stage.kind === "parsing" || stage.kind === "ranking";

  return (
    <div className="space-y-6">
      <Link
        to={paths.event(event.id)}
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
        <StageView event={event} stage={stage} selectedId={selectedId} onSelect={setSelectedId} />
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
