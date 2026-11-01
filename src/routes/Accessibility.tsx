import { PageHeading } from "../components/ui/PageHeading";

const SUPPORT = [
  "Everything works with a keyboard alone, with a visible focus outline and a skip link.",
  "Assistant replies, plan updates and errors are announced to screen readers.",
  "Text and controls meet WCAG 2.2 AA contrast; status is never shown by colour alone.",
  "Pages reflow at 360 px wide and at 200% zoom without sideways scrolling.",
  "Reduced-motion, increased-contrast and Windows High Contrast settings are respected.",
  "Drag and drop is never required: priorities are ranked with Move up and Move down buttons.",
  "Notifications stay for 10 seconds and pause while you hover or focus them.",
];

const TESTING = [
  "Automated axe checks (WCAG 2.2 AA and best practices) on every screen, in unit tests and in a real browser.",
  "Keyboard-only journeys in end-to-end tests.",
  "Manual checks with NVDA and VoiceOver before each release.",
];

/** How Hostwise supports accessibility, how it is tested, and how to report a problem. */
export default function Accessibility() {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeading title="Accessibility" />
      <p className="text-muted">
        Hostwise aims to meet WCAG 2.2 level AA so that every host can plan their celebration,
        whatever device or assistive technology they use.
      </p>
      <section aria-labelledby="a11y-support" className="space-y-2">
        <h2 id="a11y-support" className="text-xl font-bold">
          What you can expect
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          {SUPPORT.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="a11y-testing" className="space-y-2">
        <h2 id="a11y-testing" className="text-xl font-bold">
          How we test
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          {TESTING.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="a11y-feedback" className="space-y-2">
        <h2 id="a11y-feedback" className="text-xl font-bold">
          Tell us about a problem
        </h2>
        <p>
          If something is hard to use,{" "}
          <a
            className="font-semibold text-brand underline"
            href="https://github.com/Mirdula18/Hostwise/issues"
            rel="noreferrer"
            target="_blank"
          >
            open an issue on GitHub (opens in a new tab)
          </a>
          . Describe the page, what you expected and the assistive technology you use.
        </p>
      </section>
    </div>
  );
}
