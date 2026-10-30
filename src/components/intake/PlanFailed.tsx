import { AIErrorAlert } from "../ui/AIErrorAlert";
import { Button } from "../ui/Button";
import type { EventProfile } from "../../schemas/event";

type PlanFailedProps = {
  message: string | null;
  profile: EventProfile;
  onBuild: (profile: EventProfile, useStarter?: boolean) => Promise<void>;
};

/** Plan generation failed: retry the AI, or fall back to the starter plan. */
export function PlanFailed({ message, profile, onBuild }: PlanFailedProps) {
  return (
    <AIErrorAlert
      message={`${message ?? ""} Your answers are kept.`}
      onRetry={() => void onBuild(profile)}
    >
      <Button variant="secondary" onClick={() => void onBuild(profile, true)}>
        Use a starter plan instead
      </Button>
    </AIErrorAlert>
  );
}
