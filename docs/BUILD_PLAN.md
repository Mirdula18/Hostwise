# Build Plan — Hostwise (fast track)

Each phase has a **copy-paste prompt for Claude Code**. Run phases in order. After each one, run `npm run check` and make a commit. The time estimates assume Claude Code does the typing.

> Tip: start each Claude Code session with: *"Read CLAUDE.md and the docs it references for this phase. Then do the phase below. Stop when npm run check passes."*

---

## Phase 0 — Scaffold (≈ 30 min)
**Prompt:**
```
Read CLAUDE.md and docs/ARCHITECTURE.md.
Scaffold the project exactly as described:
- Vite + React 18 + TypeScript strict, Tailwind, React Router, Zustand, Zod, date-fns, lucide-react.
- ESLint flat config (typescript-eslint, react-hooks, jsx-a11y) + Prettier.
- Vitest + @testing-library/react + jsdom + vitest-axe + @vitest/coverage-v8 (thresholds: src/lib lines 80%).
- Playwright with one placeholder smoke spec that loads "/".
- wrangler as devDependency; wrangler.toml with pages_build_output_dir="dist".
- vite.config.ts: dev proxy /api -> http://localhost:8788.
- npm scripts from CLAUDE.md, including "check".
- .gitignore (node_modules, dist, coverage, .wrangler, playwright-report, test-results, .env*, !.env.example, .dev.vars).
- .env.example and .dev.vars.example with GEMINI_API_KEY= and GEMINI_MODEL= (empty values).
- public/_headers per docs/SECURITY.md, public/_redirects "/* /index.html 200".
- .github/workflows/ci.yml: npm ci, lint, typecheck, test, build, repo-size check (fail if tracked files > 8 MB), bundle check.
- Empty folder structure with index files. A Home route that says "Hostwise".
Make npm run check pass.
```
**Done when:** `npm run check` is green and `npm run dev` shows Home.

---

## Phase 1 — Schemas and pure logic (≈ 1.5 h) ← most test points
**Prompt:**
```
Read docs/DATA_MODEL.md and docs/TESTING.md.
1. Create all Zod schemas in src/schemas/ (event.ts, ai.ts) exactly as specified.
2. Implement src/lib/money.ts (toMinor, fromMinor, format via Intl, allocate largest-remainder).
3. src/lib/budget.ts: fromPercents, normalisePercents, rebalance(lines, changedId, newAmount, priorities),
   scaleForGuests(lines, oldCount, newCount), summary(lines).
4. src/lib/timeline.ts: toDates(aiTasks, eventDate), detectCycle, topoSort,
   shiftWithDependents(tasks, taskId, days), isBlocked, bucket(tasks, today), todayTop3(tasks, today, priorities).
5. src/lib/change.ts: computeImpact(event, changeRequest), generateOptions(event, impact), applyOption(event, option).
6. src/lib/vendors.ts: compareQuotes(vendors, category, allocated), acceptQuote(event, vendorId, quoteId).
7. src/lib/io.ts: exportEvents, importEvents (Zod validated, returns Result type).
8. src/lib/sample.ts: one rich sample event (60-guest anniversary, seniors, vegetarian, wheelchair access).
Write every unit test listed in docs/TESTING.md section 2. Coverage ≥ 80% on src/lib.
```

---

## Phase 2 — Gemini proxy and AI client (≈ 1 h)
**Prompt:**
```
Read docs/PROMPTS.md and docs/SECURITY.md.
1. functions/api/gemini.ts (onRequestPost) + functions/api/_lib/*:
   - Validate body {task, input} with Zod per task; reject > 16 KB (413).
   - Same-origin check on Origin header (allow pages.dev project + localhost).
   - Rate limit: 20 req / 5 min per CF-Connecting-IP (in-memory token bucket) -> 429.
   - Build request from prompts.ts (preamble + task instruction + <user_data>), responseSchema per task.
   - Call Gemini REST generateContent with env.GEMINI_API_KEY via header x-goog-api-key, AbortController 20 s.
   - Return {data: parsedJson} or {error:{code,message}}; never echo upstream errors or the key.
2. src/lib/ai/client.ts: callAI<T>(task, input, schema): fetch /api/gemini, Zod parse, one retry with
   validation error in input._fixHint, typed AIError. Uses cache.ts (LRU 50, key = stable JSON hash).
3. src/lib/ai/debounce.ts.
4. src/lib/intakeFallback.ts static questions.
5. Tests: prompts guardrail tests, client tests with mocked fetch (success, invalid->retry->success,
   invalid twice->AIError, timeout), cache tests, function handler tests (400, 413, 429, 200 with mocked fetch).
```

---

## Phase 3 — Store and app shell (≈ 45 min)
**Prompt:**
```
1. src/store/useEventStore.ts: Zustand + persist (key "hostwise:v1", partialize events+activeId),
   actions: createEvent, setActive, updateBudgetLine, lockLine, addTask, updateTask, delayTask,
   addVendor, updateVendor, addQuote, acceptQuote, applyChange (pushes undo snapshot), undo, deleteEvent,
   importEvents. All actions call src/lib functions; no math in the store.
2. migrations.ts with version 1.
3. App shell: header with skip link, nav, <main id="main">, lazy routes:
   / (Home: event list, "New event", "Use sample event", import/export)
   /intake, /event/:id (tabs: Overview, Budget, Timeline, Vendors), /event/:id/change.
4. UI kit in components/ui per docs/ACCESSIBILITY.md (Button, Field, Badge, Tabs, Dialog with focus trap,
   LiveRegion, Toast). Design tokens in styles/index.css (contrast ≥ 4.5:1). Mobile-first 360px.
5. Store tests (applyChange + undo restores exactly) and axe tests for Home and UI kit.
```

---

## Phase 4 — Intake and plan generation (≈ 1 h)
**Prompt:**
```
Build components/intake: IntakeChat uses callAI("intake_next") step by step, renders QuestionStep
by inputType (text, number, date, select, multiselect, rank with up/down buttons — keyboard accessible),
ProgressBar, Back/Skip. Validate answers with EventProfile partial schemas. On AI failure use intakeFallback.
On completion: callAI("plan"), convert via lib, createEvent, navigate to /event/:id.
Overview tab: profile summary, theme, "What I assumed" list, Today card, budget summary.
Loading states with aria-busy; AI text in LiveRegion. Tests: rank control keyboard, axe, flow with mocked AI.
```

---

## Phase 5 — Budget, timeline, vendors (≈ 2 h)
**Prompt:**
```
Budget tab: CategoryCard (allocated/committed/spent/remaining, CSS bar, SourceBadge with tooltip,
lock toggle, inline edit -> dialog choosing "Rebalance others by priority" vs "Change total"),
over-budget shown with icon + text.
Timeline tab: TaskList bucketed (Overdue/This week/Next 2 weeks/Later), TaskItem (status select,
blocked badge with reason, at-risk badge), DelayDialog (days input -> preview affected tasks -> confirm),
add/edit custom task, TodayCard.
Vendors tab: VendorList, VendorForm, quotes sub-form, "Draft questions" (callAI vendor_questions,
copy button), QuoteCompare table (<table> with <caption>, scope headers) vs allocation, accept quote.
Tests per docs/TESTING.md section 3.
```

---

## Phase 6 — Change and trade-off engine (≈ 1.5 h) ★
**Prompt:**
```
/event/:id/change route + ChangeBox (textarea + chips Budget/Guests/Date/Delay that open typed mini-forms
so it works without AI). Flow: parse_change -> if unclear show clarifying question -> computeImpact ->
generateOptions -> rank_options (fallback: show options unranked with code-written labels) ->
OptionCard list (rank, why, what you give up, respects top priority badge) -> DiffPreview (before/after table
per category + affected tasks) -> Apply (store.applyChange) -> toast with Undo.
Show changeLog on Overview. Tests: the "add 20 guests" scenario end-to-end with mocked AI, undo, axe.
```

---

## Phase 7 — Polish, e2e, deploy (≈ 1 h)
**Prompt:**
```
1. Print stylesheet for a run-of-show (Overview + Timeline) and a "Print" button.
2. Error boundaries per route; 404 route.
3. Playwright smoke: Home -> Use sample event -> Budget edit -> Change "add 20 guests" (route intercepted
   to return a fixed AI response) -> Apply -> Undo -> Timeline delay. Run axe in e2e on each tab.
4. README: fill in live link placeholder instructions, screenshots folder excluded.
5. Verify docs/SUBMISSION.md checklist items that can be automated.
```
Then follow `docs/DEPLOYMENT.md`.

---

## If time runs short, cut in this order
1. Print stylesheet.
2. Custom AI option in `rank_options`.
3. Import (keep export).
4. Multiple events (keep one).

**Never cut:** the change engine, tests for `src/lib`, the proxy and its security, or the accessibility basics.
