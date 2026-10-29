import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AIError, callAI } from "../../lib/ai/client";
import {
  displayAnswer,
  fallbackQuestion,
  finalizeProfile,
  normalizeQuestion,
  parseAnswer,
  rawFor,
  reachedLimit,
  type IntakeQuestion,
  type Raw,
} from "../../lib/intake";
import { FIELD_SPECS, MAX_QUESTIONS, type IntakeAnswers } from "../../lib/intakeFallback";
import { planToEvent } from "../../lib/plan";
import { starterPlan } from "../../lib/starterPlan";
import { todayIso } from "../../lib/timeline";
import { AIPlan, NextQuestion } from "../../schemas/ai";
import type { EventProfile } from "../../schemas/event";
import { useEventStore } from "../../store/useEventStore";
import { AIErrorAlert } from "../ui/AIErrorAlert";
import { Button } from "../ui/Button";
import { LiveRegion } from "../ui/LiveRegion";
import { ProgressBar } from "./ProgressBar";
import { QuestionStep } from "./QuestionStep";

type Step = { question: IntakeQuestion };
type Phase = "loading" | "asking" | "planning" | "planError";

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
        navigate(`/event/${id}`);
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
      if (reachedLimit(asked)) return finish(next, asked);
      setPhase("loading");

      let q: IntakeQuestion | { done: true } | null = null;
      if (!offlineRef.current) {
        try {
          const ai = await callAI("intake_next", { answers: next, asked }, NextQuestion, {
            signal: controller.signal,
          });
          q = normalizeQuestion(ai, next, asked);
        } catch (e) {
          if (e instanceof AIError && e.code === "aborted") return;
          offlineRef.current = true;
          setOffline(true);
        }
      }
      if (controller.signal.aborted) return;
      q ??= fallbackQuestion(next, asked);
      if (q.done) return finish(next, asked);
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
    const kept = new Set(keep.map((s) => s.question.field));
    setAnswers(
      Object.fromEntries(
        Object.entries(answers).filter(([k]) => kept.has(k as IntakeQuestion["field"])),
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
        {offline ? (
          <p className="rounded-lg border border-warn p-3 text-sm text-warn">
            The assistant isn't reachable, so you're seeing our standard questions. Everything else
            works the same.
          </p>
        ) : null}
        <LiveRegion busy={phase === "loading" || phase === "planning"}>
          {phase === "loading" ? <p>Thinking about the next question…</p> : null}
          {phase === "planning" ? <p>Drafting your plan… this can take a few seconds.</p> : null}
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
          <AIErrorAlert
            message={`${planError ?? ""} Your answers are kept.`}
            onRetry={() => profileRef.current && void buildPlan(profileRef.current)}
          >
            <Button
              variant="secondary"
              onClick={() => profileRef.current && void buildPlan(profileRef.current, true)}
            >
              Use a starter plan instead
            </Button>
          </AIErrorAlert>
        ) : null}
      </div>

      {steps.length > 0 ? (
        <aside aria-labelledby="answers-heading" className="space-y-2">
          <h2 id="answers-heading" className="text-lg font-bold">
            Your answers
          </h2>
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={s.question.field} className="rounded-lg border border-line bg-surface p-2">
                <p className="text-sm text-muted">{FIELD_SPECS[s.question.field].question}</p>
                <p className="font-medium">{displayAnswer(s.question.field, answers)}</p>
                <Button
                  variant="ghost"
                  className="-ml-2"
                  aria-label={`Change answer: ${FIELD_SPECS[s.question.field].question}`}
                  onClick={() => goTo(i)}
                >
                  Change
                </Button>
              </li>
            ))}
          </ol>
        </aside>
      ) : null}
    </div>
  );
}
