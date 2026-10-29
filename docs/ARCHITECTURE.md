# Architecture — Hostwise

## 1. System overview
```
┌──────────────────────────── Browser (React SPA) ────────────────────────────┐
│  routes/ (lazy)   components/   store/ (Zustand + persist → localStorage)   │
│        │                │                 │                                  │
│        └──── calls ─────┴──── src/lib/ (pure TS: budget, timeline, change)  │
│                               src/lib/ai/client.ts ── fetch POST /api/gemini │
└───────────────────────────────────────────┬──────────────────────────────────┘
                                            │ JSON { task, input }
                         ┌──────────────────▼──────────────────┐
                         │ Cloudflare Pages Function            │
                         │ functions/api/gemini.ts              │
                         │ - validate body (Zod, ≤ 16 KB)       │
                         │ - rate limit per IP                  │
                         │ - build prompt from task template    │
                         │ - call Gemini with env.GEMINI_API_KEY│
                         │ - return JSON text only              │
                         └──────────────────┬──────────────────┘
                                            ▼
                                     Gemini REST API
```

**Key decision: the browser never sends raw prompts.** It sends a `task` name (`intake_next | plan | parse_change | rank_options | vendor_questions`) plus typed input. The function owns the prompt templates. As a result:
- The proxy can't be abused as a free general-purpose Gemini endpoint.
- Prompt injection is limited, because user text is only ever placed inside delimited data fields.

## 2. Folder structure
```
hostwise/
├─ functions/
│  └─ api/
│     ├─ gemini.ts            # Pages Function entry (onRequestPost)
│     └─ _lib/
│        ├─ prompts.ts        # task → systemInstruction + responseSchema
│        ├─ schemas.ts        # Zod request schemas (shared shapes)
│        ├─ rateLimit.ts      # in-memory token bucket per IP (per isolate)
│        └─ gemini.ts         # fetch wrapper with timeout
├─ public/
│  ├─ _headers               # CSP and security headers
│  ├─ _redirects             # SPA fallback: /* /index.html 200
│  └─ favicon.svg
├─ src/
│  ├─ main.tsx, App.tsx       # router and Suspense
│  ├─ routes/                 # Home, Intake, Plan (tabs: Budget, Timeline, Vendors), Change
│  ├─ components/
│  │  ├─ ui/                  # Button, Field, Badge, Dialog, Tabs, LiveRegion, Toast
│  │  ├─ budget/              # BudgetBoard, CategoryCard, SourceBadge
│  │  ├─ timeline/            # TaskList, TaskItem, TodayCard, DelayDialog
│  │  ├─ vendors/             # VendorList, VendorForm, QuoteCompare, QuestionList
│  │  ├─ change/              # ChangeBox, OptionCard, DiffPreview
│  │  └─ intake/              # IntakeChat, QuestionStep, ProgressBar
│  ├─ lib/                    # NO React imports
│  │  ├─ money.ts             # integer minor units, format, allocate
│  │  ├─ budget.ts            # fromPercents, rebalance, scaleForGuests, summary
│  │  ├─ timeline.ts          # toDates, topoSort, detectCycle, shiftWithDependents, todayTop3, bucket
│  │  ├─ change.ts            # computeImpact, generateOptions, applyOption
│  │  ├─ vendors.ts           # compareQuotes, acceptQuote
│  │  ├─ sample.ts            # sample event for demo
│  │  ├─ io.ts                # export/import JSON with validation
│  │  └─ ai/
│  │     ├─ client.ts         # callAI(task, input, schema) with retry and validation
│  │     ├─ cache.ts          # LRU keyed by hash(task+input), max 50 entries
│  │     └─ debounce.ts
│  ├─ schemas/                # Zod: event.ts, ai.ts (AI response schemas)
│  ├─ store/
│  │  ├─ useEventStore.ts     # events, activeId, actions, undo stack
│  │  └─ migrations.ts
│  └─ styles/index.css        # Tailwind and design tokens
├─ tests/
│  ├─ unit/                   # mirrors src/lib
│  ├─ components/             # RTL and axe
│  └─ e2e/smoke.spec.ts
├─ .github/workflows/ci.yml
├─ .gitignore  .env.example  .dev.vars.example
├─ wrangler.toml  vite.config.ts  tsconfig*.json  eslint.config.js
└─ CLAUDE.md  README.md  docs/
```

## 3. Data flow (each kind of operation)
| Operation | Path |
|---|---|
| Intake question | `IntakeChat` → `callAI("intake_next", answersSoFar)` → validated `NextQuestion` → render |
| Plan | `callAI("plan", profile)` → `AIPlan` (percents, offsets) → `lib/budget.fromPercents` + `lib/timeline.toDates` → store |
| Edit budget | UI → `lib/budget.rebalance` → store (no AI) |
| Delay | UI → `lib/timeline.shiftWithDependents` → store (no AI) |
| Change | `callAI("parse_change", text)` → `ChangeRequest` → `lib/change.computeImpact` + `generateOptions` → `callAI("rank_options", {impact, options, priorities})` → user Apply → `lib/change.applyOption` → store (pushes undo snapshot) |
| Vendor questions | `callAI("vendor_questions", {category, eventContext})` → list |

## 4. Money representation
- All amounts are **integers in minor units** (paise or cents), so there are no float errors.
- `currency` is stored per event and formatted with `Intl.NumberFormat`.
- `allocate(total, weights)` uses the largest-remainder method, so the parts always sum to the total.

## 5. State
- Store shape: `{ version, events: Record<id, Event>, activeId, history: Record<id, Event[]> }`.
- The undo stack is capped at 20 entries per event.
- `persist` writes only `events` and `activeId`. History is session-only.
- Selectors are memoized; components subscribe to slices with `useShallow`.

## 6. Error handling
| Layer | Behaviour |
|---|---|
| Function | Returns `{ error: { code, message } }` with status 400/429/502/504. Never leaks the key or upstream body. |
| `client.ts` | Timeout of 20 s. Parse with Zod; on failure, retry once with a "fix to match schema" hint; then throw `AIError`. |
| UI | Error boundary per route; inline `role="alert"` with a "Try again" button. The app stays usable without AI (manual edits work). |

## 7. Performance
- Route-level `React.lazy`.
- The `date-fns` import is tree-shaken.
- No heavy chart library: budget bars are plain CSS.
- Bundle budget: initial JS ≤ 200 KB gzip. CI checks `dist/assets/*.js` size.
