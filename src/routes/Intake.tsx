import { IntakeChat } from "../components/intake/IntakeChat";
import { PageHeading } from "../components/ui/PageHeading";

export default function Intake() {
  return (
    <section className="space-y-4">
      <PageHeading title="Plan a new event" />
      <p className="max-w-2xl text-muted">
        A few quick questions, one at a time. You can go back and change any answer.
      </p>
      <IntakeChat />
    </section>
  );
}
