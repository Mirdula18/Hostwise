import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnswerControl } from "./AnswerControl";
import { FIELD_SPECS, type IntakeField } from "../../lib/intakeFallback";
import { Button } from "../ui/Button";
import type { IntakeQuestion, Raw } from "../../lib/intake";

const CONTROL_LABELS: Record<IntakeField, string> = {
  occasion: "Occasion",
  title: "Event name",
  date: "Event date",
  guestCount: "Number of guests",
  totalBudget: "Total budget",
  currency: "Currency",
  priorities: "Your priorities, most important first",
  ageMix: "Age groups",
  accessibility: "Accessibility needs",
  dietary: "Dietary needs",
  culturalContext: "Cultural or religious context",
  setting: "Setting",
  city: "City or area",
};

type Props = {
  question: IntakeQuestion;
  initial?: Raw;
  today: string;
  currency?: string;
  error: string | null;
  canGoBack: boolean;
  onSubmit: (raw: Raw) => void;
  onSkip: () => void;
  onBack: () => void;
};

function initialValue(q: IntakeQuestion, initial: Raw | undefined): Raw {
  if (initial !== undefined) {
    if (q.inputType === "rank" && Array.isArray(initial)) {
      const rest = (q.options ?? []).filter((o) => !initial.includes(o));
      return [...initial, ...rest];
    }
    return initial;
  }
  if (q.inputType === "rank") return [...(q.options ?? [])];
  if (q.inputType === "multiselect") return [];
  return "";
}

export function QuestionStep(props: Props) {
  const { question, today, currency, error, canGoBack, onSubmit, onSkip, onBack } = props;
  const [value, setValue] = useState<Raw>(() => initialValue(question, props.initial));
  const heading = useRef<HTMLHeadingElement>(null);
  const spec = FIELD_SPECS[question.field];
  const label = CONTROL_LABELS[question.field];
  const labels: Record<string, string> = Object.fromEntries(
    (spec.options ?? []).map((o) => [o.value, o.label]),
  );

  useEffect(() => {
    heading.current?.focus();
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(value);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-labelledby="intake-question">
      <div className="space-y-1">
        <h2 id="intake-question" ref={heading} tabIndex={-1} className="text-xl font-bold">
          {question.question}
        </h2>
        {question.helper ? <p className="text-muted">{question.helper}</p> : null}
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-danger p-3 font-medium text-danger">
          {error}
        </p>
      ) : null}

      <AnswerControl
        question={question}
        label={label}
        labels={labels}
        value={value}
        onChange={setValue}
        today={today}
        currency={currency}
        required={spec.required}
        error={error}
      />

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onBack} disabled={!canGoBack}>
          Back
        </Button>
        {spec.required ? null : (
          <Button variant="ghost" onClick={onSkip}>
            Skip / not sure
          </Button>
        )}
        <Button type="submit" className="ml-auto">
          Next
        </Button>
      </div>
    </form>
  );
}
