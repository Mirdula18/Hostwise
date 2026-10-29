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
| 27 | 5 | Source badges are focusable buttons with a `role="tooltip"` explanation shown on hover or focus and linked via `aria-describedby`. | Screen-reader and keyboard users get the same explanation as mouse users. |
| 28 | 5 | Built-in tasks can be edited, delayed and marked done; only custom tasks can be deleted. | PRD F4: "add, edit and delete custom tasks". |
| 29 | 5 | The task editor hides tasks that already depend on the task being edited, and the store still rejects any cycle with a clear message. | Prevents most cycles up front; the lib check is the safety net. |
| 30 | 5 | Vitest `testTimeout` is 20 s. | Long keyboard-driven flows exceed 5 s when the whole suite runs in parallel on Windows; no assertion is weakened. |
| 31 | 6 | Free-text submissions to `parse_change` are debounced by 500 ms; quick-form chips build a `ChangeRequest` directly and skip the AI. | CLAUDE.md rule 7, and the change engine must work without AI. |
| 32 | 6 | `checkChange` rejects no-op changes, past dates and unknown task ids before the engine runs; `unclear` shows the AI clarifying question. | Gives the host something to act on instead of a confusing empty option list. |
| 33 | 6 | `rank_options` is skipped when there is only one option (date and delay changes). | Saves a Gemini call when there is nothing to rank. |
| 34 | 6 | The preview is produced by running the real `applyOption` on a copy and diffing (`diffEvents`), so the preview and the applied result cannot disagree. | One source of truth for the numbers. |
| 35 | 6 | After Apply the user returns to the event Overview, where the change log and a toast with Undo are shown. | Matches the PRD flow: apply → see result → undo. |
| 36 | 7 | The run-of-show is a print-only section (`RunOfShow`) on the event page: details, tasks in dependency/date order, budget table and booked vendors. Header, nav, tabs and buttons are `print:hidden`. | One click prints a usable sheet without a separate route. |
| 37 | 7 | A single `ErrorBoundary` around the routes resets on every path change, which acts as a per-route boundary. | Same behaviour with less code. |
| 38 | 7 | `scripts/verify.mjs` (`npm run verify`) automates the SUBMISSION repo checks (secret pattern, forbidden files, images over 200 KB, tracked size ≤ 8 MB, initial JS ≤ 200 KB gzip) and replaces the inline bash in CI. | Cross-platform and runnable locally on Windows. |
| 39 | 7 | `wrangler.toml` has no `[vars]` block; `GEMINI_MODEL` is set in the dashboard. DEPLOYMENT.md is updated to match. | With a wrangler.toml present, its vars override dashboard values, so an empty `GEMINI_MODEL` there would hide the real one. |
| 40 | 7 | Upgraded zod 3 → 4 and react-router-dom 6 → 7. | CI's `npm audit --audit-level=high` failed on a high-severity zod advisory; react-router 6 had two moderate ones. Only the AI client's generic signature needed changing. |
| 41 | 7 | The proxy test uses a fake key that does not match the Google key pattern. | The repo secret scan (and GitHub push protection) would otherwise flag it. |
| 42 | 7 | Accessible names that differ from visible text now contain it ("Mark done: …", "Unaccept"). | Found by Playwright axe (`label-content-name-mismatch`), which the jsdom axe run does not catch. |

## Open issues
1. **Live Gemini not exercised.** No API key was used during the build, so every AI path is tested against mocks and fixtures only. After the first deploy, run one intake and one "add 20 guests" change to confirm the live model accepts the `responseSchema` format in `prompts.ts`. Every failure path falls back gracefully (static questions, starter plan, quick forms, unranked options).
2. **Default model name.** If `GEMINI_MODEL` is unset, the function uses `gemini-2.5-flash`, which may be outdated. Set `GEMINI_MODEL` to the current Flash model from Google AI Studio.
3. **Origin allow-list is tied to the project name.** `PAGES_ORIGIN` in `functions/api/gemini.ts` matches `hostwise.pages.dev` and its previews. If the Pages project has another name, update it (same-origin requests always pass).
4. **Rate limiting is per isolate.** The in-memory token bucket is best effort. Add the optional Cloudflare WAF rule from DEPLOYMENT.md §6 for a global limit.
5. **Manual accessibility checks remain.** NVDA/VoiceOver announcements, 200% zoom and the Lighthouse ≥ 95 audit (the manual script in ACCESSIBILITY.md) can't be automated here. axe runs in jsdom and in Playwright on every tab, and 360 px has no horizontal scroll.
6. **Colour contrast is only checked in Playwright.** jsdom has no canvas, so vitest-axe skips colour contrast; the e2e axe run covers it.
