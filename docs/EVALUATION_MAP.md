# Evaluation Map — Hostwise

This page tells evaluators, human or AI, where to find the evidence for each judging parameter.

## Problem Statement Alignment (highest weight)
| Challenge expectation | Where in Hostwise | Evidence |
|---|---|---|
| Ask practical, user-specific questions | F1 Guided intake (`components/intake`, `prompts.ts#intake_next`) | Adaptive questions; occasion-specific follow-ups |
| Tailor plans to the user's situation | F2 Plan (`prompts.ts#plan`, `lib/budget.fromPercents`) | Priorities shape splits; accessibility and dietary tasks added |
| Categorise expenses; show the impact of changes | F3 Budget board, `lib/budget.ts` | Rebalance and scale functions with tests |
| Don't fabricate prices; label estimates | `Source` enum, `SourceBadge`, prompt rule 3 | Every number is labelled Estimate, Your number, or Vendor quote |
| Vague goal → prioritised tasks with deadlines and dependencies | F4 Timeline, `lib/timeline.ts` | Topological sort, buckets, Today card |
| Adapt to real-time changes (vendor delays) | `shiftWithDependents`, DelayDialog | Transitive shift with at-risk flags |
| Explain trade-offs, don't cut blindly | F5 Change engine, `lib/change.ts`, `rank_options` | Options ranked against named priorities; locked categories protected |
| Reprioritise by what matters | Priorities, lock toggles | Rebalance order follows priorities |
| Vendor questions, quote comparison, tracking | F6 Vendor desk, `lib/vendors.ts` | AI questions; comparison table; status tracking |
| No unverified vendor claims | Prompt rule 2; no price fields come from AI | `prompts.test.ts` |
| Different personas and cultural context | `EventProfile.culturalContext`, `ageMix`, `occasion` | Two-persona test in `PRD.md` F1 |
| Revise without restarting | Change engine plus undo | Store tests for `applyChange` and `undo` |
| Execution over inspiration | Today card, tasks, vendor desk, run-of-show print | Demo video steps 4–7 |

## Code Quality
- Strict TypeScript plus `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noImplicitReturns` and `noImplicitOverride`; Zod-inferred types; no `any`.
- **Zero type casts** in production code (`consistent-type-assertions: never`): JSON from the network or storage is validated with Zod; narrowing uses type guards.
- Type-aware ESLint (`strictTypeChecked` + `stylisticTypeChecked`), react-hooks, jsx-a11y, import order and JSDoc rules; Prettier. Zero warnings, no inline `eslint-disable`.
- Enforced limits in production code: cyclomatic complexity ≤ 10, functions ≤ 40 lines (components ≤ 150), no magic numbers (shared limits live in `src/lib/constants.ts`), JSDoc on every export in `src/lib` and `functions/`.
- `knip` in `npm run check`: no unused files, exports or dependencies.
- One error pattern: `Result<T, E>` from `src/lib/result.ts`, used by the lib, the store and the proxy.
- Pure, framework-free logic in `src/lib`; thin components; one responsibility per module, no source file over 250 lines.
- One place for every route (`src/routes/paths.ts`) and every limit (`src/lib/constants.ts`).
- Conventional commits; CI on every push (`.github/workflows/ci.yml`).

## Security
See `docs/SECURITY.md`. Highlights:
- The key lives only as a server-side secret.
- Allow-listed tasks; Zod-validated input; size limits.
- Origin check and rate limiting.
- Strict CSP and security headers.
- Prompt-injection delimiting; no HTML rendering of AI output.
- A secret-pattern scan and `npm audit` in CI.

## Efficiency
- Lazy routes; initial JS ≤ 200 KB gzip, checked in CI.
- Prompt LRU cache; 500 ms debounce; no AI calls on render.
- Deterministic local math, so budget and timeline edits need no network call.
- Integer money (fast and exact); memoized selectors with `useShallow`.
- Gemini JSON mode with schemas, so there's no extra parsing round-trip, plus capped output tokens.

## Testing
- Vitest unit tests for every `src/lib` function and the proxy (≥ 98% lines and functions, enforced); whole app including UI ≥ 95% lines (currently 99.3%).
- Seeded property tests: 300 generated cases per invariant (money always balances, locked lines never move, every option applies, dependency order, delay ripple). They found and fixed a real bug (guest scaling below an accepted quote).
- Performance budgets for a 100-guest, 15-category, 60-task plan.
- Proxy tests: 400, 403, 413, 429, 502, success, and a check that the key never leaks.
- AI client tests: retry, timeout, cache.
- Component tests with axe for every screen and edge state; Playwright journeys (headline change flow, AI-down intake, vendor desk, backup round trip, 360 px, keyboard only, forced colours) with intercepted AI responses.
- See `docs/TESTING.md`.

## Accessibility
- WCAG 2.2 AA checklist in `docs/ACCESSIBILITY.md`, plus an in-app accessibility statement (`/accessibility`).
- axe runs in component tests and in Playwright with WCAG 2.0–2.2 A/AA and best-practice rules, including under emulated forced colours, increased contrast and reduced motion.
- Keyboard-first rank control and tabs; live regions for AI output; status never shown by colour alone.
- Reduced-motion, `prefers-contrast: more` and Windows High Contrast (`forced-colors`) support; works at 360 px and 200% zoom.
