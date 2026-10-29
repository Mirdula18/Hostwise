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
| 13 | 2 | The function exports a single `onRequest` that returns 405 for non-POST methods instead of `onRequestPost`. | With only `onRequestPost`, other methods would fall through to the SPA `_redirects` rule and return 200. |
| 14 | 2 | Origin check allows same-origin (covers custom domains), `hostwise.pages.dev` and its preview subdomains, and localhost dev ports; a missing Origin is rejected. | Matches SECURITY.md; browsers always send Origin on POST. Rename the regex if the Pages project is not called `hostwise`. |
| 15 | 2 | If `GEMINI_MODEL` is empty the function falls back to `gemini-2.5-flash`; model names are restricted to `[\w.-]+`. | Keeps the app working if the variable is forgotten; set the current Flash model in the dashboard. |
| 16 | 2 | Request schemas in `functions/api/_lib/schemas.ts` import the shared Zod shapes from `src/schemas/event.ts` and are `.strict()`. | One source of truth; unknown keys (e.g. a smuggled `prompt`) are rejected with 400. |
| 17 | 2 | Rate limiting happens before the body is read; the 413 check runs on both `Content-Length` and the actual byte length. | Cheap rejection first; a missing or false Content-Length cannot bypass the size cap. |
| 18 | 3 | The active tab lives in the URL (`/event/:id?tab=budget`). | Deep links, back button and e2e tests can target a tab directly. |
| 19 | 3 | Vendor delays from the Timeline go through the change engine (`delayTask` = `applyChange` with a `delay` request), so they appear in the change log and can be undone. | One code path for every change; undo works everywhere. |
| 20 | 3 | Persisted state is re-validated with Zod on load (`merge` → `migrate`); corrupt events are dropped instead of crashing. | localStorage can be edited or truncated by the user or another tab. |
| 21 | 3 | Toasts stay 10 s and pause while focused or hovered. | ACCESSIBILITY.md asks for at least 8 s and a reachable Undo. |
| 22 | 4 | Code owns each intake field input type and options (`normalizeQuestion`); the AI only picks the field and wording. Unknown/repeated fields or a premature `done` fall back to the static flow. | Keeps the rank control and validation reliable regardless of AI output. |
| 23 | 4 | After the first AI failure, intake switches to the static questions for the rest of the session and shows a notice. | Avoids a 20 s timeout on every question. |
| 24 | 4 | If plan generation fails, the alert offers Try again plus "Use a starter plan instead" (`lib/starterPlan.ts`, priority-weighted, deadlines compressed to the time left). | The app must stay usable without AI (ARCHITECTURE §6); judges may hit quota limits. |
| 25 | 4 | `title` is an optional intake question; if skipped it defaults to "<Occasion> on <date>". | DATA_MODEL requires a title but PROMPTS lists it outside the required order. |
| 26 | 4 | The question is an `h2` that receives focus; each control has its own short visible label (e.g. "Number of guests"). | Screen readers hear the new question; every input still has a `<label>`. |

## Open issues
None yet.
