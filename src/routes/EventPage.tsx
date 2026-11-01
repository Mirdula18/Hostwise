import { Download, Printer, Shuffle } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import NotFound from "./NotFound";
import { paths } from "./paths";
import { BudgetBoard } from "../components/budget/BudgetBoard";
import { EventStats } from "../components/overview/EventStats";
import { Overview } from "../components/overview/Overview";
import { RunOfShow } from "../components/overview/RunOfShow";
import { TaskList } from "../components/timeline/TaskList";
import { Button, buttonClass } from "../components/ui/Button";
import { downloadText } from "../components/ui/download";
import { PageHeading } from "../components/ui/PageHeading";
import { TabPanel, Tabs, type TabItem } from "../components/ui/Tabs";
import { VendorList } from "../components/vendors/VendorList";
import { todayIso } from "../lib/dates";
import { OCCASION_LABELS } from "../lib/intakeFallback";
import { exportEvents } from "../lib/io";
import { useEvent } from "../store/useEventStore";

type TabKey = "overview" | "budget" | "timeline" | "vendors";

const TABS: TabItem<TabKey>[] = [
  { key: "overview", label: "Overview" },
  { key: "budget", label: "Budget" },
  { key: "timeline", label: "Timeline" },
  { key: "vendors", label: "Vendors" },
];

const isTab = (v: string | null): v is TabKey => TABS.some((t) => t.key === v);

export default function EventPage() {
  const { id } = useParams();
  const event = useEvent(id);
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const tab: TabKey = isTab(tabParam) ? tabParam : "overview";

  const today = todayIso();

  if (!event) return <NotFound />;
  const { profile } = event;

  return (
    <article className="space-y-4">
      <header className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand">
              {OCCASION_LABELS[profile.occasion]}
            </p>
            <PageHeading title={profile.title} />
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Link to={paths.change(event.id)} className={buttonClass("primary")}>
              <Shuffle aria-hidden="true" className="h-4 w-4" />
              What changed?
            </Link>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer aria-hidden="true" className="h-4 w-4" />
              Print run-of-show
            </Button>
            <Button
              variant="ghost"
              onClick={() => downloadText(`hostwise-${event.id}.json`, exportEvents([event]))}
            >
              <Download aria-hidden="true" className="h-4 w-4" />
              Export this event
            </Button>
          </div>
        </div>
        <div className="print:hidden">
          <EventStats event={event} today={today} />
        </div>
      </header>

      <div className="print:hidden">
        <Tabs
          label="Plan sections"
          idPrefix="plan"
          tabs={TABS}
          selected={tab}
          onSelect={(key) => setParams({ tab: key }, { replace: true })}
        />
        <TabPanel idPrefix="plan" tabKey={tab}>
          {tab === "overview" ? <Overview event={event} today={today} /> : null}
          {tab === "budget" ? <BudgetBoard event={event} /> : null}
          {tab === "timeline" ? <TaskList event={event} today={today} /> : null}
          {tab === "vendors" ? <VendorList event={event} /> : null}
        </TabPanel>
      </div>
      <RunOfShow event={event} />
    </article>
  );
}
