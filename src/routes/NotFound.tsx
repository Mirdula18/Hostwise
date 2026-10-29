import { Link } from "react-router-dom";
import { buttonClass } from "../components/ui/Button";
import { PageHeading } from "../components/ui/PageHeading";

export default function NotFound() {
  return (
    <section className="space-y-4">
      <PageHeading title="Page not found" />
      <p>That page doesn't exist. It may be an event that was deleted from this browser.</p>
      <Link to="/" className={buttonClass("primary")}>
        Go to my events
      </Link>
    </section>
  );
}
