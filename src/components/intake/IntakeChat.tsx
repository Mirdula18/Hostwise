import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnswersList, type Step } from "./AnswersList";
import { PlanFailed } from "./PlanFailed";
import { ProgressBar } from "./ProgressBar";
import { QuestionStep } from "./QuestionStep";
import { AIError, callAI } from "../../lib/ai/client";
import {
  fallbackQuestion,
  finalizeProfile,
  keepAnswers,
  normalizeQuestion,
  parseAnswer,
  rawFor,
  reachedLimit,
  type IntakeQuestion,
  type Raw,
} from "../../lib/intake";
import { MAX_QUESTIONS, type IntakeAnswers } from "../../lib/intakeFallback";
import { planToEvent } from "../../lib/plan";
import { starterPlan } from "../../lib/starterPlan";
import { todayIso } from "../../lib/timeline";
import { paths } from "../../routes/paths";
import { AIPlan, NextQuestion } from "../../schemas/ai";
import { useEventStore } from "../../store/useEventStore";
import { LiveRegion } from "../ui/LiveRegion";
import type { EventProfile } from "../../schemas/event";

type Next = IntakeQuestion | { done: true };
type AIOutcome = Next | null | "aborted" | "failed";

const isQuestion = (o: AIOutcome): o is Next => o !== null && typeof o === "object";

/** The AI's next question; null means "use the static flow", "failed" means go offline. */
async function aiQuestion(
  answers: IntakeAnswers,
  asked: string[],
  signal: AbortSignal,
): Promise<AIOutcome> {
  try {
    const ai = await callAI("intake_next", { answers, asked }, NextQuestion, { signal });
    return normalizeQuestion(ai, answers, asked);
  } catch (e) {
    return e instanceof AIError && e.code === "aborted" ? "aborted" : "failed";
  }
}

type Phase = "loading" | "asking" | "planning" | "planError";

/** Shown once the assistant has failed; intake carries on with the static questions. */
function OfflineNotice() {
  return (
    <p className="rounded-lg border border-warn p-3 text-sm text-warn">
      The assistant isn't reachable, so you're seeing our standard questions. Everything else works
      the same.
    </p>
  );
}

const PHASE_MESSAGES: Partial<Record<Phase, string>> = {
  loading: "Thinking about the next question…",
  planning: "Drafting your plan… this can take a few seconds.",
};

/** Progress text for the busy phases, announced through the live region. */
function PhaseMessage({ phase }: { phase: Phase }) {
  const message = PHASE_MESSAGES[phase];
  return message ? <p>{message}</p> : null;
}

/**
 * One question at a time. Gemini picks the next question; if it is unavailable or
 * picks something unusable, the static flow takes over so intake always completes.
 */
export function IntakeChat() {
  const navigate = useNavigate();
  const createEvent = useEventStore((s) => s.createEvent);
  const today = todayIso();
  const [answers, setAnswers] = useState<IntakeAnswers>({});
  const [steps, setSteps] = useState<Step[]>([]);
  const [current, setCurrent] = useState<IntakeQuestion | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [reopened, setReopened] = useState<Raw | undefined>(undefined);
  const profileRef = useRef<EventProfile | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const offlineRef = useRef(false);

  const buildPlan = useCallback(
    async (profile: EventProfile, useStarter = false) => {
      setPhase("planning");
      setPlanError(null);
      try {
        const plan = useStarter
          ? starterPlan(profile, today)
          : await callAI("plan", profile, AIPlan, { signal: abortRef.current?.signal });
        const id = createEvent(planToEvent(profile, plan));
        void navigate(paths.event(id));
      } catch (e) {
        if (e instanceof AIError && e.code === "aborted") return;
        setPlanError(e instanceof AIError ? e.message : "Something went wrong.");
        setPhase("planError");
      }
    },
    [createEvent, navigate, today],
  );

  const finish = useCallback(
    (final: IntakeAnswers, asked: string[]) => {
      const profile = finalizeProfile(final);
      if (!profile.ok) {
        const q = fallbackQuestion(final, asked);
        if (!q.done) {
          setCurrent(q);
          setPhase("asking");
        }
        return;
      }
      profileRef.current = profile.value;
      void buildPlan(profile.value);
    },
    [buildPlan],
  );

  const loadNext = useCallback(
    async (next: IntakeAnswers, asked: string[]) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setFieldError(null);
      if (reachedLimit(asked)) {
        finish(next, asked);
        return;
      }
      setPhase("loading");

      const ai = offlineRef.current ? null : await aiQuestion(next, asked, controller.signal);
      if (ai === "aborted" || controller.signal.aborted) return;
      if (ai === "failed") {
        offlineRef.current = true;
        setOffline(true);
      }
      const q = isQuestion(ai) ? ai : fallbackQuestion(next, asked);
      if (q.done) {
        finish(next, asked);
        return;
      }
      setReopened(undefined);
      setCurrent(q);
      setPhase("asking");
    },
    [finish],
  );

  useEffect(() => {
    void loadNext({}, []);
    return () => abortRef.current?.abort();
  }, [loadNext]);

  const asked = steps.map((s) => s.question.field);

  const answer = (raw: Raw) => {
    if (!current) return;
    const parsed = parseAnswer(current.field, raw, today);
    if (!parsed.ok) {
      setFieldError(parsed.error);
      return;
    }
    const next = { ...answers, [current.field]: parsed.value };
    setAnswers(next);
    setSteps([...steps, { question: current }]);
    void loadNext(next, [...asked, current.field]);
  };

  const skip = () => {
    if (!current) return;
    setSteps([...steps, { question: current }]);
    void loadNext(answers, [...asked, current.field]);
  };

  /** Re-opens step `index`; answers from that step onwards are cleared. */
  const goTo = (index: number) => {
    const step = steps[index];
    if (!step) return;
    abortRef.current?.abort();
    setReopened(rawFor(step.question.field, answers));
    const keep = steps.slice(0, index);
    setAnswers(
      keepAnswers(
        answers,
        keep.map((s) => s.question.field),
      ),
    );
    setSteps(keep);
    setCurrent(step.question);
    setFieldError(null);
    setPhase("asking");
  };

  return (
    <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <ProgressBar current={Math.min(steps.length + 1, MAX_QUESTIONS)} max={MAX_QUESTIONS} />
        {offline ? <OfflineNotice /> : null}
        <LiveRegion busy={phase === "loading" || phase === "planning"}>
          <PhaseMessage phase={phase} />
          {phase === "asking" && current ? (
            <QuestionStep
              key={`${current.field}-${steps.length}`}
              question={current}
              initial={reopened}
              today={today}
              currency={answers.currency}
              error={fieldError}
              canGoBack={steps.length > 0}
              onSubmit={answer}
              onSkip={skip}
              onBack={() => goTo(steps.length - 1)}
            />
          ) : null}
        </LiveRegion>
        {phase === "planError" && profileRef.current ? (
          <PlanFailed message={planError} profile={profileRef.current} onBuild={buildPlan} />
        ) : null}
      </div>

      {steps.length > 0 ? <AnswersList steps={steps} answers={answers} onChange={goTo} /> : null}
    </div>
  );
}
