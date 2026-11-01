import { Copy, Sparkles } from "lucide-react";
import { useState } from "react";
import { AIError, callAI } from "../../lib/ai/client";
import { VendorQuestions } from "../../schemas/ai";
import { useEventStore } from "../../store/useEventStore";
import { AIErrorAlert } from "../ui/AIErrorAlert";
import { Button } from "../ui/Button";
import { LiveRegion } from "../ui/LiveRegion";
import { toast } from "../ui/Toast";
import type { Event, Vendor } from "../../schemas/event";

type Props = { event: Event; vendor: Vendor };

/** AI-drafted questions to ask before booking. Only event context is sent, never contact details. */
export function QuestionList({ event, vendor }: Props) {
  const updateVendor = useEventStore((s) => s.updateVendor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const questions = vendor.questions ?? [];

  const draft = async () => {
    setLoading(true);
    setError(null);
    const { occasion, guestCount, accessibility, dietary, culturalContext, setting } =
      event.profile;
    try {
      const r = await callAI(
        "vendor_questions",
        {
          category: vendor.category,
          profile: { occasion, guestCount, accessibility, dietary, culturalContext, setting },
        },
        VendorQuestions,
      );
      updateVendor(event.id, vendor.id, { questions: r.questions });
    } catch (e) {
      setError(e instanceof AIError ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(questions.map((q, i) => `${i + 1}. ${q}`).join("\n"));
      toast("Questions copied.");
    } catch {
      toast("Couldn't copy. Select the questions and copy them instead.");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => void draft()}
          disabled={loading}
          aria-label={`${questions.length > 0 ? "Redraft" : "Draft"} questions to ask ${vendor.name}`}
        >
          <Sparkles aria-hidden="true" className="h-4 w-4" />
          {questions.length > 0 ? "Redraft questions" : "Draft questions to ask"}
        </Button>
        {questions.length > 0 ? (
          <Button variant="ghost" onClick={() => void copy()}>
            <Copy aria-hidden="true" className="h-4 w-4" />
            Copy questions
          </Button>
        ) : null}
      </div>
      <LiveRegion busy={loading}>
        {loading ? <p>Drafting questions for {vendor.category}…</p> : null}
        {!loading && questions.length > 0 ? (
          <div>
            <h4 className="font-semibold">Questions to ask {vendor.name}</h4>
            <ol className="list-decimal space-y-1 pl-5">
              {questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
          </div>
        ) : null}
      </LiveRegion>
      {error ? <AIErrorAlert message={error} onRetry={() => void draft()} /> : null}
    </div>
  );
}
