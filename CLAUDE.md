# CLAUDE.md — Hostwise

Instructions for Claude Code. Read this file fully before every task. Then read the doc for the area you are touching (see "Doc map").

## What we are building
**Hostwise** is an AI co-planner for budget-bound celebrations with 20–100 guests (milestone birthdays, anniversaries, graduation parties, small community get-togethers).
- It turns a vague goal into a personalised budget, a dependency-aware timeline, and a vendor desk.
- It adapts the plan when budget, guest count or schedule change, without a restart.

This is a hackathon submission scored on: **Code Quality, Security, Efficiency, Testing, Accessibility, Problem Statement Alignment**. Every change should improve at least one of these and regress none.

## Golden rule: AI proposes, code computes
- **Gemini handles:** intake questions, plan structure, percentage splits, trade-off explanations, vendor questions, theme ideas.
- **TypeScript handles:** all money math, date math, dependency shifting, totals, and validation. This code is pure, deterministic and unit-tested.
- **Gemini output is untrusted:** it is always parsed with Zod. On failure, retry once with the validation error appended. If that also fails, show a friendly error with a "Try again" button.
- **Every money value carries `source`:** `"estimate" | "user" | "quote"`. AI-produced numbers are always `"estimate"`, and the UI says so.
- **No availability claims:** the AI never claims a vendor is available, booked or priced. Prompts forbid it (see `docs/PROMPTS.md`).

## Stack (do not change without asking)
| Area | Tools |
|---|---|
| App | Vite, React 18, TypeScript (strict), Tailwind CSS, Zustand (with `persist` to localStorage), Zod, React Router, date-fns |
| AI | Gemini REST API, called **only** from the Cloudflare Pages Function `functions/api/gemini.ts` |
| Hosting | Cloudflare Pages (static `dist/`) plus Pages Functions |
| Tests | Vitest, @testing-library/react, vitest-axe, Playwright (1 smoke spec) |
| Lint | ESLint (typescript-eslint, react-hooks, jsx-a11y), Prettier |

## Commands
```bash
npm install
npm run dev          # Vite on :5173 (proxies /api to wrangler on :8788)
npm run dev:api      # wrangler pages dev --port 8788 (reads .dev.vars)
npm run lint
npm run typecheck    # tsc --noEmit
npm test             # vitest run --coverage
npm run test:e2e     # playwright
npm run build        # tsc -b && vite build
npm run check        # lint + typecheck + test + build  <- run before every commit
```

## Hard rules
1. **Secrets**
   - Never put an API key in `src/` or in any `VITE_*` variable, and never commit one.
   - The only place the key is read is `env.GEMINI_API_KEY` inside `functions/`.
   - `.dev.vars` and `.env*` are gitignored. Only `.env.example` and `.dev.vars.example` are committed.
2. **Repo under 10 MB**
   - Never commit `node_modules`, `dist`, `coverage`, `.wrangler`, `playwright-report`, videos, or images over 200 KB.
   - Use SVG icons (lucide-react).
3. **TypeScript**
   - No `any`, and no `// @ts-ignore`.
   - Prefer `type` aliases inferred from Zod schemas (`z.infer`).
4. **Module structure**
   - Pure logic lives in `src/lib/` with no React imports.
   - Components stay thin: they read from the store and call lib functions.
5. **Tests**
   - Every function in `src/lib/` gets unit tests, covering edge cases: zero, negative, empty, and over-budget.
   - Coverage target is ≥ 80% lines on `src/lib/`.
6. **Accessibility**
   - Semantic elements; every input has a `<label>`.
   - Visible focus rings; keyboard-only flow works.
   - AI responses render inside `aria-live="polite"` regions.
   - Follow `docs/ACCESSIBILITY.md`.
7. **Efficiency**
   - Lazy-load routes and debounce AI-triggering inputs (500 ms).
   - Cache identical prompts (see `src/lib/ai/cache.ts`).
   - Use memoized Zustand selectors, and never call Gemini on render.
8. **Commits**
   - Small, conventional commits (`feat:`, `fix:`, `test:`, `docs:`).
   - Update `docs/PROMPTS.md` "Evolution log" whenever a prompt changes.
9. **No placeholders**
   - Don't leave TODO comments in merged code. Ship working or don't ship.

## Definition of done (per task)
- [ ] `npm run check` passes.
- [ ] New logic has tests; new UI has an axe test.
- [ ] Works on keyboard only and at 360 px width.
- [ ] No secret, no `console.log`, no unused export.
- [ ] Relevant doc updated.

## Doc map
| Need | Read |
|---|---|
| What and why, acceptance criteria | `docs/PRD.md` |
| Folders, data flow, proxy | `docs/ARCHITECTURE.md` |
| Types and schemas | `docs/DATA_MODEL.md` |
| Gemini prompts and JSON schemas | `docs/PROMPTS.md` |
| Step-by-step build order | `docs/BUILD_PLAN.md` |
| Tests to write | `docs/TESTING.md` |
| Security controls | `docs/SECURITY.md` |
| A11y checklist | `docs/ACCESSIBILITY.md` |
| Cloudflare deploy | `docs/DEPLOYMENT.md` |
| How we map to judging | `docs/EVALUATION_MAP.md` |
| Video, LinkedIn, final checklist | `docs/SUBMISSION.md` |
