# Decisions — Hostwise

Choices made where the spec was silent or ambiguous. Newest last.

| # | Phase | Decision | Why |
|---|---|---|---|
| 1 | 0 | Spec docs copied from `hostwise-docs/hostwise/` to the repo root (`CLAUDE.md`, `README.md`, `docs/`). The original folder stays gitignored. | `BUILD_PLAN.md` and `ARCHITECTURE.md` place `docs/` at the root. |
| 2 | 0 | One `tsconfig.json` (noEmit) covers `src`, `functions` and `tests`; Pages Function types are declared locally instead of pulling in `@cloudflare/workers-types` globals. | Avoids DOM vs Workers global type clashes while keeping one strict config. |
| 3 | 0 | Tailwind v3 with CSS-variable tokens; Vite 6, Vitest 3, ESLint 9 flat config. | Stable, well-known versions that satisfy the stack table. |
| 4 | 0 | Folders are created as they gain real modules rather than shipping empty `index.ts` barrels. | CLAUDE.md forbids unused exports and placeholders. |
| 5 | 0 | Coverage threshold is enforced on `src/lib/**` (80% lines); `functions/` and `src/store/` are reported too. | Matches CLAUDE.md rule 5 without weakening it. |
| 6 | 1 | `Impact` also carries the `request` that produced it, and `applyOption(event, impact, option)` takes the impact. | Options are relative to the post-change baseline, so apply needs to know which change it is. |
| 7 | 1 | An option resolves the gap when, after applying it, allocations sum exactly to the (possibly changed) total. `guestCountChange` options are re-scaled to the final count and their adjustments are relative to that. | Keeps every option checkable by one rule in `applyOption`. |
| 8 | 1 | Lines are never trimmed below what is committed or spent (`max(committed, spent)`), not just below 0. | Cutting below an accepted quote would create an instant overspend. |
| 9 | 1 | Rebalance: a raise takes from the least important lines first (unranked → 3rd → 2nd → 1st), largest line first within a rank; a cut shares the freed money by priority weight. | PRD F3 AC; weights make the top priority gain most. |
| 10 | 1 | Guest-increase options: protect top priority, spread trims, invite half the extra guests (trimming lower priorities), raise the budget. | Allocations always sum to the total, so "fit more guests for free" is never possible; a half-way option is a real trade-off. |
| 11 | 1 | Delays shift the task and all transitive dependents by the same number of days. | Simplest rule that preserves order (PRD F4 AC). |
| 12 | 1 | Added `src/lib/plan.ts` (`planToEvent`) and `src/lib/priorities.ts` beyond the listed files. | Plan conversion is shared by intake and the sample event; category→priority mapping is shared by budget and timeline. |

## Open issues
None yet.
