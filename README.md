# Hostwise

**An AI co-planner for celebrations on a real budget.** Tell Hostwise what you're celebrating, how many people are coming, and what matters most. It builds a budget, a timeline and a vendor checklist, and it keeps them in sync when things change.

> Live demo: `https://<your-project>.pages.dev` · Video walkthrough: `<unlisted link>`

## The problem
- A party lasts an evening; planning it takes weeks.
- Budget, guest count, venue, food and vendors all affect one another.
- Most "AI party planners" stop at theme ideas.
- Hosts actually get stuck when something changes ("my budget just got cut", "15 more people are coming", "the caterer is late") and they can't see the ripple effects.

## Who it's for
First-time or occasional hosts planning a **20–100 guest** celebration, **2–12 weeks out**, on a **fixed budget**.

## What it does
| Feature | What happens |
|---|---|
| **Guided intake** | An adaptive conversation captures occasion, date, guests, budget, age mix, accessibility, dietary and cultural context, and your top priorities. |
| **Personalised plan** | Gemini drafts budget splits, a task timeline with dependencies, and a theme direction, all tailored to your answers. |
| **Budget board** | Category envelopes, spent vs. remaining, and a label on every number: *Estimate*, *Your number*, or *Vendor quote*. |
| **Timeline and Do Next** | Tasks ordered by deadline and dependency. A "Today" card tells you the next three things to do. A vendor delay shifts the tasks that depend on it. |
| **Change and trade-offs** | Type "budget is now 40,000" or "add 20 guests". Hostwise computes the impact, offers 2–3 options ranked by *your* priorities, and applies the one you pick. No restart. |
| **Vendor desk** | AI-drafted questions per vendor type, side-by-side quote comparison, and status tracking. Hostwise never claims availability or prices. |
| **Save and export** | Multiple events are saved in your browser, with JSON export/import and a printable run-of-show. |

## How GenAI is used (and where it isn't)
**AI proposes, code computes.** Gemini does the parts that need judgment and language:
- adaptive questions,
- plan structure,
- trade-off reasoning,
- vendor questions.

All arithmetic (totals, rebalancing, per-guest scaling, date shifting) runs in tested TypeScript. Every Gemini response is validated against a schema before the app uses it. See [`docs/PROMPTS.md`](docs/PROMPTS.md) for prompts and their evolution.

## Tech
Vite · React · TypeScript · Tailwind · Zustand · Zod · Gemini API · Cloudflare Pages + Pages Functions · Vitest · Testing Library · axe · Playwright

## Architecture in one picture
```
Browser (React SPA) ──POST /api/gemini──▶ Cloudflare Pages Function ──▶ Gemini API
   │  state: Zustand + localStorage          (holds GEMINI_API_KEY secret,
   │  math: src/lib (pure, tested)            validates, rate-limits)
```

## Run locally
```bash
git clone <repo> && cd hostwise
npm install
cp .dev.vars.example .dev.vars      # put your Gemini key here (gitignored)
npm run dev:api                     # terminal 1: Pages Functions on :8788
npm run dev                         # terminal 2: app on :5173
```

## Quality gates
```bash
npm run check   # lint + typecheck + unit/component tests + build
npm run test:e2e
```

## Security
- The API key lives only as a Cloudflare secret and never reaches the browser.
- Requests and responses are validated, and the API is rate-limited.
- Pages ship with strict CSP headers.

Details: [`docs/SECURITY.md`](docs/SECURITY.md).

## Accessibility
WCAG 2.1 AA target: keyboard-first, screen-reader announcements for AI replies, contrast-checked colours, reduced-motion support. See [`docs/ACCESSIBILITY.md`](docs/ACCESSIBILITY.md).

## License
MIT
