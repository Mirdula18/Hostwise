# Submission — Hostwise

You get a maximum of **3 attempts**, and only the last one counts. Submit only when every box below is ticked.

## 1. Pre-submit checklist
### Repo
- [ ] The GitHub repo is **Public**. Check by opening it in an incognito window.
- [ ] Repo size is under 10 MB. Check with `git count-objects -vH` (look at size-pack) and the CI size step.
- [ ] No `node_modules`, `dist`, `coverage`, `.dev.vars` or videos are committed. `git ls-files | grep -E "node_modules|dist/|\.dev\.vars$"` returns nothing.
- [ ] Searching the repo for `AIza` returns nothing.
- [ ] The README has the live link, the video link, and the GenAI usage section.
- [ ] CI is green on the latest commit.

### App
- [ ] The production URL works in an incognito window with no login, on desktop and mobile.
- [ ] The latest commit is the deployed one (compare the Cloudflare deployment SHA with GitHub).
- [ ] "Use sample event" and at least one AI action work live.
- [ ] Gemini quota or credits are sufficient for evaluators to try it.

### Video
- [ ] The video is uploaded to YouTube as **Unlisted**, or to Drive with **Anyone with the link → Viewer**.
- [ ] The link opens in an incognito window.
- [ ] It shows every feature (see the shot list below).

### LinkedIn post
- [ ] Published, and covering the tools used, how the prompts evolved, and where GenAI is used (and where it isn't).

## 2. Video shot list (target 3–4 minutes)
| # | Time | Show | Say (optional voiceover) |
|---|---|---|---|
| 1 | 0:00 | Home, then the problem in one line | "Planning changes all the time. Hostwise keeps the budget, timeline and vendors in sync." |
| 2 | 0:15 | Intake: anniversary, 60 guests, priorities food > guest comfort > venue, seniors, wheelchair access | "It asks questions that fit this event." |
| 3 | 0:45 | Generated plan: budget with Estimate badges, "What I assumed", accessibility tasks | "AI suggests the split. Code does the math. Every number is labelled." |
| 4 | 1:15 | Budget: raise catering → rebalance by priority; lock décor | |
| 5 | 1:35 | **Change:** "15 more guests are coming" → impact → 3 ranked options → diff → Apply → Undo | "It explains trade-offs using my priorities, and nothing is cut blindly." |
| 6 | 2:20 | Timeline: caterer delayed 5 days → dependents shift → at-risk flag → Today card | |
| 7 | 2:45 | Vendors: draft questions for the caterer → add two quotes → compare → accept | "It never claims availability or prices; only my quotes." |
| 8 | 3:15 | Export JSON, print run-of-show | |
| 9 | 3:30 | Keyboard-only moment plus a screen-reader announcement; quick look at the test and CI badge | "Built for everyone, and tested." |

Record at 1080p. Hide bookmarks and any key-bearing tabs. Keep the file out of the repo.

## 3. LinkedIn post draft
```
Built Hostwise for Prompt Wars Virtual – Challenge 5 (Celebration & Event Planner) 🎉

The problem: AI party planners give you themes. Real hosts struggle when things CHANGE —
budget cuts, 15 extra guests, a late caterer — and can't see the ripple effects.

Hostwise is an AI co-planner for budget-bound celebrations:
✅ Adaptive intake that personalises to occasion, guests, accessibility & culture
✅ Budget board where every number is labelled Estimate / Your number / Vendor quote
✅ Dependency-aware timeline + "what to do today"
✅ Change engine: type "add 20 guests" → see impact → pick a trade-off ranked by YOUR priorities → undo anytime
✅ Vendor desk: AI-drafted questions + quote comparison (no fake prices or availability claims)

How I used GenAI
• Built with prompt-driven development in Claude Code (CLAUDE.md + spec docs → phased prompts)
• Gemini (structured JSON output) for questions, plan structure, trade-off reasoning and vendor questions
• Key principle: AI proposes, code computes. All money and dates are deterministic, tested TypeScript.

Prompt evolution
1️⃣ Free-text plans → invented prices
2️⃣ JSON schema with percentages only → code does the money math
3️⃣ <user_data> delimiting + shared guardrail preamble → injection-resistant
4️⃣ AI ranks code-generated options instead of inventing them → trade-offs always add up

Stack: React · TypeScript · Vite · Zustand · Zod · Gemini API · Cloudflare Pages + Functions · Vitest · Playwright · axe

🔗 Live: <link>  💻 Code: <link>  🎥 Demo: <link>
#PromptWars #GenAI #Gemini #ClaudeCode #React #Cloudflare
```

## 4. Attempt strategy
| Attempt | When | Goal |
|---|---|---|
| 1 | As soon as Phases 0–6 are done | Get the feedback report |
| 2 | After fixing every item in the report | Push the score |
| 3 | Only if attempt 2 has clear fixable issues | Final. Never submit a riskier build than attempt 2 |

After each report, log the issues in `docs/FEEDBACK_LOG.md` and fix them in order: security → problem alignment → testing → code quality → accessibility → efficiency.
