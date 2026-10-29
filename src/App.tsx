import { PartyPopper } from "lucide-react";
import { lazy, Suspense } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { Toaster } from "./components/ui/Toast";

const Home = lazy(() => import("./routes/Home"));
const Intake = lazy(() => import("./routes/Intake"));
const EventPage = lazy(() => import("./routes/EventPage"));
const Change = lazy(() => import("./routes/Change"));
const NotFound = lazy(() => import("./routes/NotFound"));

const navClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold ${
    isActive ? "bg-brand/10 text-brand" : "text-ink hover:bg-bg"
  }`;

export default function App() {
  const location = useLocation();
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only-focusable fixed left-2 top-2 z-50 rounded-lg bg-brand px-4 py-3 font-semibold text-brand-ink"
      >
        Skip to main content
      </a>
      <header className="border-b border-line bg-surface print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-lg font-bold">
            <PartyPopper aria-hidden="true" className="h-6 w-6 text-brand" />
            Hostwise
          </Link>
          <nav aria-label="Primary">
            <ul className="flex gap-1">
              <li>
                <NavLink to="/" end className={navClass}>
                  My events
                </NavLink>
              </li>
              <li>
                <NavLink to="/intake" className={navClass}>
                  New event
                </NavLink>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <ErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<p aria-busy="true">Loading…</p>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/intake" element={<Intake />} />
              <Route path="/event/:id" element={<EventPage />} />
              <Route path="/event/:id/change" element={<Change />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      <footer className="border-t border-line bg-surface print:hidden">
        <p className="mx-auto max-w-5xl px-4 py-3 text-sm text-muted">
          Your plan is saved in this browser only. Amounts marked “Estimate” are suggestions, not
          vendor prices.
        </p>
      </footer>
      <Toaster />
    </div>
  );
}
