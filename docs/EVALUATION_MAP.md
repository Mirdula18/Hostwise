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
- Strict TypeScript, Zod-inferred types, no `any`.
- ESLint with typescript-eslint, react-hooks and jsx-a11y; Prettier.
- Pure, framework-free logic in `src/lib`; thin components; one responsibility per module.
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
- Vitest unit tests for every `src/lib` function (≥ 80% coverage, enforced).
- Proxy tests: 400, 403, 413, 429, 502, success, and a check that the key never leaks.
- AI client tests: retry, timeout, cache.
- Component tests with axe; one Playwright journey with intercepted AI responses.
- See `docs/TESTING.md`.

## Accessibility
- WCAG 2.1 AA checklist in `docs/ACCESSIBILITY.md`.
- axe runs in component and e2e tests.
- Keyboard-first rank control and tabs; live regions for AI output; status never shown by colour alone.
- Reduced-motion support; works at 360 px and 200% zoom.
