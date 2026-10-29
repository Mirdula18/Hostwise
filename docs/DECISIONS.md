# Decisions — Hostwise

Choices made where the spec was silent or ambiguous. Newest last.

| # | Phase | Decision | Why |
|---|---|---|---|
| 1 | 0 | Spec docs copied from `hostwise-docs/hostwise/` to the repo root (`CLAUDE.md`, `README.md`, `docs/`). The original folder stays gitignored. | `BUILD_PLAN.md` and `ARCHITECTURE.md` place `docs/` at the root. |
| 2 | 0 | One `tsconfig.json` (noEmit) covers `src`, `functions` and `tests`; Pages Function types are declared locally instead of pulling in `@cloudflare/workers-types` globals. | Avoids DOM vs Workers global type clashes while keeping one strict config. |
| 3 | 0 | Tailwind v3 with CSS-variable tokens; Vite 6, Vitest 3, ESLint 9 flat config. | Stable, well-known versions that satisfy the stack table. |
| 4 | 0 | Folders are created as they gain real modules rather than shipping empty `index.ts` barrels. | CLAUDE.md forbids unused exports and placeholders. |
| 5 | 0 | Coverage threshold is enforced on `src/lib/**` (80% lines); `functions/` and `src/store/` are reported too. | Matches CLAUDE.md rule 5 without weakening it. |

## Open issues
None yet.
