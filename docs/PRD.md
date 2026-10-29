# PRD — Hostwise

## 1. Problem
Event planning is a web of dependent decisions:
- Guest count drives catering cost.
- Catering cost competes with décor.
- Vendor delays push other tasks.

Generic AI planners produce inspiration ("10 party themes!") but don't help a host **execute**, or **adapt when things change**.

## 2. Persona
**Maya, 34, first-time host.** She is planning her parents' 35th anniversary dinner.
- Event details: 60 guests, 7 weeks away, fixed budget, mixed ages (8 to 80). Two guests use wheelchairs, and several are vegetarian.
- What matters to her: "Food and comfort for the elders matter most; décor can be simple."
- Her pain: "Every time something changes I lose track of what that means for money and what I should do next."

Secondary uses of the same flow: a kid's birthday, a graduation party, a neighbourhood potluck.

## 3. Three core questions
| Question | Answer |
|---|---|
| Who? | Occasional hosts, 20–100 guests, fixed budget, 2–12 weeks out. |
| Most stressful part? | Understanding the ripple effects of a change, and knowing the next step. |
| How does GenAI help? | Turns vague goals into structure, personalises to context, explains trade-offs in plain language, drafts vendor questions. The math stays deterministic. |

## 4. Feature requirements and acceptance criteria
Challenge-statement line references: **[P]** Personalised planning · **[B]** Budget · **[T]** Timeline · **[C]** Changes/trade-offs · **[V]** Vendors · **[X]** Persona/cultural context.

### F1 — Guided intake [P][X]
- Conversational, one question at a time. Gemini picks the next question based on earlier answers, with a maximum of 10 questions.
- Required fields:
  - occasion,
  - date,
  - guest count,
  - total budget and currency,
  - top 3 priorities ranked from: food, venue, décor, entertainment, photography, guest comfort, attire, favours.
- Optional fields:
  - age mix,
  - accessibility needs,
  - dietary needs,
  - cultural or religious context,
  - indoor/outdoor,
  - city (free text).
- A "Skip / not sure" option on every optional question.
- A progress indicator; the user can go back and edit any answer.

**AC**
- [ ] Two different personas (kid's birthday vs. anniversary) receive visibly different follow-up questions.
- [ ] Intake can be completed by keyboard only.
- [ ] Answers are validated (guest count 1–1000, budget > 0, date in the future).
- [ ] A "Use sample event" button skips intake (for demo and judges).

### F2 — Plan generation [P][B][T]
- One Gemini call with a structured JSON schema returns:
  - budget categories with percentage splits and a rationale,
  - 12–25 tasks with `dueOffsetDays`, `dependsOn` and `category`,
  - a theme direction (3 sentences max),
  - assumptions made.
- Code converts percentages into amounts, and offsets into dates.

**AC**
- [ ] Percentages are normalised to sum to exactly 100; amounts sum to exactly the total budget (rounding remainder goes to the largest category).
- [ ] Every task due date is on or before the event date. If not, it is marked "at risk".
- [ ] Assumptions are listed in a visible "What I assumed" panel.
- [ ] An invalid AI response triggers one retry, then an error state with "Try again".

### F3 — Budget board [B]
- A card per category shows allocated, committed (quotes accepted), spent, remaining, and a source badge.
- Inline edit of an allocation offers two choices: "Rebalance others by priority" or "Keep others; change total".
- Each category can be locked to protect it from rebalancing.
- Each category is marked `perGuest` true or false; per-guest categories scale with guest count.

**AC**
- [ ] Rebalancing takes from the lowest-priority unlocked categories first and never drives a category below 0.
- [ ] Over-budget state is shown in text and an icon, not only in colour.
- [ ] Every AI-derived number shows an "Estimate" badge with a tooltip explaining it.

### F4 — Timeline and Do Next [T]
- A list view grouped into: Overdue / This week / Next 2 weeks / Later.
- Tasks have three states: todo, doing, done. A task is "blocked" while any dependency is not done.
- A "Today" card shows the top 3 tasks by score (overdue, then due soon, then unblocks most tasks, then category priority).
- A "Vendor delayed by N days" action on a task shifts that task and all its dependents. Tasks pushed past the event date are flagged.
- The user can add, edit and delete custom tasks.

**AC**
- [ ] A delay shifts dependents transitively and preserves their order.
- [ ] Circular dependencies are rejected with a clear message.
- [ ] The Today card updates immediately when a task is completed.

### F5 — Change and trade-off engine [C] ★ headline
- A free-text box ("What changed?") plus quick chips: Budget change · Guest change · Date change · Vendor delay.
- Flow:
  1. Gemini parses the text into a typed `ChangeRequest`.
  2. Code computes the impact: new totals, shortfall or surplus, affected tasks.
  3. Code generates candidate options (protect top priority / trim guest list / raise budget).
  4. Gemini ranks and explains the options against the user's priorities, and may propose one custom option expressed as structured adjustments, which code validates.
  5. The user previews a before/after diff, then clicks Apply (or cancels).
- A change history is kept, with undo of the last change.

**AC**
- [ ] "Add 20 guests" correctly scales per-guest categories and reports the shortfall.
- [ ] Options never cut a locked category, and never cut the #1 priority unless no other option exists (and say so).
- [ ] Apply updates budget and timeline in one atomic store update; Undo restores the previous state exactly.
- [ ] The explanation names the user's priorities explicitly.

### F6 — Vendor desk [V]
- Vendor entry fields: name, category, contact (free text), status (`considering | contacted | quoted | booked | declined`), and notes.
- Quotes: amount, what's included, valid-until date, deposit, cancellation terms.
- "Questions to ask": Gemini drafts 6–10 questions tailored to the category plus the event context (for example, wheelchair access and vegetarian options for a caterer).
- A compare view shows quotes in the same category side by side against the allocated budget.
- Accepting a quote sets that category's committed amount, with source `quote`.

**AC**
- [ ] The UI and AI never state that a vendor is available or what they charge; only user-entered quotes show prices.
- [ ] Comparison flags quotes over the allocation.

### F7 — Persistence and export
- Multiple events are stored in localStorage (versioned with migrations).
- Export/import as JSON (validated on import).
- A printable run-of-show via a print stylesheet.

**AC**
- [ ] Reloading keeps all state.
- [ ] Importing a malformed file shows an error and does not corrupt state.

## 5. Non-goals
Payments, real vendor search, accounts or login, real-time pricing, native mobile apps.

## 6. Success demo (what the video must show)
1. Intake.
2. Generated plan.
3. Edit the budget.
4. "Add 20 guests" → choose an option → apply → undo.
5. Vendor delay shifts the timeline.
6. Vendor questions and quote comparison.
7. Export.
8. Keyboard-only and screen-reader moment.
