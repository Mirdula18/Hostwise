import { displayAnswer, type IntakeQuestion } from "../../lib/intake";
import { FIELD_SPECS, type IntakeAnswers } from "../../lib/intakeFallback";
import { Button } from "../ui/Button";

/** One answered (or skipped) intake question. */
export type Step = { question: IntakeQuestion };

type AnswersProps = { steps: Step[]; answers: IntakeAnswers; onChange: (index: number) => void };

/** The answers so far, each with a Change button that reopens that question. */
export function AnswersList({ steps, answers, onChange }: AnswersProps) {
  return (
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
              onClick={() => onChange(i)}
            >
              Change
            </Button>
          </li>
        ))}
      </ol>
    </aside>
  );
}
