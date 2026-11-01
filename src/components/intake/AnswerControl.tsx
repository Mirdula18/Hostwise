import { RankControl } from "./RankControl";
import { shiftDate } from "../../lib/dates";
import { PRIORITY_LABELS } from "../../lib/priorities";
import { Field, inputClass } from "../ui/Field";
import type { IntakeQuestion, Raw } from "../../lib/intake";

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
  currency?: string | undefined;
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
export function AnswerControl(props: ControlProps) {
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
