# Testing — Hostwise

## 1. Strategy
| Layer | Tool | Target |
|---|---|---|
| Pure logic (`src/lib`) and proxy (`functions/`) | Vitest | ≥ 90% lines, branches and functions; all edge cases |
| AI client and proxy | Vitest with mocked `fetch` | All success and failure paths |
| Components | Testing Library + vitest-axe | Behaviour plus zero axe violations |
| End to end | Playwright (1 smoke spec) | Headline journey; AI routes intercepted |

Rules:
- Tests never hit the real Gemini API.
- Use fixed dates: `vi.setSystemTime("2026-11-01")`.
- Test names describe behaviour: `"rebalance takes from lowest priority first"`.

## 2. Unit tests (must exist)

### money.ts
- `allocate(10000, [1,1,1])` → `[3334,3333,3333]`, summing to 10000.
- `allocate` with all-zero weights → an even split. With an empty array → `[]`. With a total of 0 → all zeros.
- `format(123456, "INR")` returns a locale-formatted string containing the ₹ symbol.

### budget.ts
- `normalisePercents([30,30,30])` sums to 100.
- `fromPercents` amounts sum exactly to the total.
- `rebalance` raising a category takes from the lowest-priority unlocked lines first.
- `rebalance` never takes from locked lines. If not enough room is unlocked, it returns an error result.
- `rebalance` never produces negative values.
- `scaleForGuests(60→80)` scales only `perGuest` lines by 80/60, leaving fixed lines unchanged.
- `scaleForGuests` with the same count is a no-op. Scaling to 1 guest works.
- `summary` reports the over-budget flag when committed is greater than allocated.

### timeline.ts
- `toDates` maps an offset of 0 to the event date and 14 to two weeks before.
- `detectCycle` finds a→b→a. On an acyclic graph it returns null.
- `topoSort` keeps every dependency before its dependent.
- `shiftWithDependents` moves a task and its transitive dependents but not unrelated tasks.
- `shiftWithDependents` flags tasks that move past the event date as at risk.
- `isBlocked` is true while any dependency is not done.
- `bucket` puts overdue, this week, next two weeks and later tasks in the right groups.
- `todayTop3` orders overdue first, then by due date, then by number of tasks unblocked. It returns fewer than 3 when fewer remain.

### change.ts
- **Budget cut 20%:** the gap is negative and the options protect the #1 priority.
- **Add 20 guests** (60 → 80): the per-guest required sum increases and the gap equals the shortfall.
- **Budget increase:** the gap is positive and the options distribute the surplus by priority.
- `generateOptions` never adjusts locked lines. Each option's deltas resolve the gap exactly.
- When the only way to fit touches the top priority, `respectsTopPriority` is false.
- `applyOption` returns a new event without mutating the input. It appends to the changeLog.
- **Date change:** tasks move by the difference between the new and old dates.

### vendors.ts and io.ts
- `compareQuotes` sorts by amount and flags quotes over the allocation.
- `acceptQuote` sets committed, sets source to `quote`, and unaccepts other quotes from the same vendor.
- Export followed by import round-trips identical data. A malformed import returns an error and leaves state unchanged.

### ai/
- `client`: success returns parsed data.
- `client`: an invalid response triggers a retry, and a valid retry returns data.
- `client`: two invalid responses throw `AIError`.
- `client`: a timeout throws `AIError("timeout")`.
- `cache`: identical input is served from cache, and the LRU evicts the oldest entry.
- `prompts`: every template contains the preamble and wraps input in `<user_data>`. Injection text stays inside the data block.

### functions/api/gemini.ts
- Unknown task → 400.
- Body over 16 KB → 413.
- 21st request in the window → 429.
- Bad origin → 403.
- Upstream 500 → 502 with a generic message (no upstream body).
- Success → `{ data }`.
- The API key is never present in any response body.

## 3. Component tests
- Every route and UI kit component: `expect(await axe(container)).toHaveNoViolations()`.
- **Rank control:** arrow buttons reorder the list, and focus follows the moved item.
- **Dialog:** focus is trapped, Esc closes it, and focus returns to the trigger.
- **CategoryCard:** an over-budget card shows the text "Over by …", not only colour.
- **Change flow** (mocked AI): enter "add 20 guests" → options render → Apply → the budget updates → Undo restores it.
- **AI failure:** shows `role="alert"` and a Try again button.

## 4. End to end
`tests/e2e/smoke.spec.ts` follows the PRD success demo. It uses `page.route("**/api/gemini", ...)` with fixtures from `tests/fixtures/ai/*.json`, and runs `@axe-core/playwright` on each tab.

## 5. Commands
```bash
npm test                # unit + component, with coverage
npm run test:e2e        # builds and serves, runs Playwright
```
