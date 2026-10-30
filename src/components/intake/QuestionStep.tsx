import { useEffect, useRef, useState, type FormEvent } from "react";
import { RankControl } from "./RankControl";
import { FIELD_SPECS, type IntakeField } from "../../lib/intakeFallback";
import { PRIORITY_LABELS } from "../../lib/priorities";
import { shiftDate } from "../../lib/timeline";
import { Button } from "../ui/Button";
import { Field, inputClass } from "../ui/Field";
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

/** Native input attributes for text, date and number questions. */
function inputAttrs(question: IntakeQuestion, today: string) {
  if (question.inputType === "date") return { type: "date", min: shiftDate(today, 1) };
  if (question.inputType !== "number") return { type: "text", autoComplete: "off" };
  const money = question.field === "totalBudget";
  return {
    type: "number",
    inputMode: money ? ("decimal" as const) : ("numeric" as const),
    min: 1,
    step: money ? "any" : 1,
  };
}

type ControlProps = {
  question: IntakeQuestion;
  label: string;
  labels: Record<string, string>;
  value: Raw;
  onChange: (value: Raw) => void;
  today: string;
  currency?: string;
  required: boolean;
  error: string | null;
};

function CheckboxGroup({ question, label, labels, value, onChange }: ControlProps) {
  const list = Array.isArray(value) ? value : [];
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{label}</legend>
      {(question.options ?? []).map((opt) => (
        <label key={opt} className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={list.includes(opt)}
            onChange={(e) =>
              onChange(e.target.checked ? [...list, opt] : list.filter((x) => x !== opt))
            }
          />
          {labels[opt] ?? opt}
        </label>
      ))}
    </fieldset>
  );
}

function SingleValue(props: ControlProps) {
  const { question, label, labels, value, onChange, today, currency, required, error } = props;
  const text = typeof value === "string" ? value : "";
  const shownLabel =
    question.field === "totalBudget" && currency ? `${label} (${currency})` : label;
  return (
    <Field label={shownLabel} required={required} error={error ?? undefined}>
      {(p) =>
        question.inputType === "select" ? (
          <select
            {...p}
            className={inputClass}
            value={text}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">Choose…</option>
            {(question.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {labels[opt] ?? opt}
              </option>
            ))}
          </select>
        ) : (
          <input
            {...p}
            className={inputClass}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            {...inputAttrs(question, today)}
          />
        )
      }
    </Field>
  );
}

/** The right control for the question's input type. */
function AnswerControl(props: ControlProps) {
  const { question, label, labels, value, onChange } = props;
  if (question.inputType === "rank") {
    return (
      <RankControl
        legend={label}
        value={Array.isArray(value) ? value : []}
        labels={Object.keys(labels).length ? labels : PRIORITY_LABELS}
        onChange={onChange}
      />
    );
  }
  if (question.inputType === "multiselect") return <CheckboxGroup {...props} />;
  return <SingleValue {...props} />;
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
