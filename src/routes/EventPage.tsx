import { CalendarDays, Users, Wallet } from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";
import { BudgetBoard } from "../components/budget/BudgetBoard";
import { Overview } from "../components/overview/Overview";
import { TaskList } from "../components/timeline/TaskList";
import { PageHeading } from "../components/ui/PageHeading";
import { TabPanel, Tabs, type TabItem } from "../components/ui/Tabs";
import { VendorList } from "../components/vendors/VendorList";
import { format } from "../lib/money";
import { OCCASION_LABELS } from "../lib/intakeFallback";
import { todayIso } from "../lib/timeline";
import { useEvent } from "../store/useEventStore";
import NotFound from "./NotFound";

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
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">
          {OCCASION_LABELS[profile.occasion]}
        </p>
        <PageHeading title={profile.title} />
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <li className="inline-flex items-center gap-1">
            <CalendarDays aria-hidden="true" className="h-4 w-4" />
            {profile.date}
          </li>
          <li className="inline-flex items-center gap-1">
            <Users aria-hidden="true" className="h-4 w-4" />
            {profile.guestCount} guests
          </li>
          <li className="inline-flex items-center gap-1">
            <Wallet aria-hidden="true" className="h-4 w-4" />
            {format(profile.totalBudget, profile.currency)} budget
          </li>
        </ul>
      </header>

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
    </article>
  );
}
