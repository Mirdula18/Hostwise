# Accessibility — Hostwise

Target: **WCAG 2.1 AA**. This is checked automatically (axe in unit and e2e tests) and by hand (the checklist below).

## Structure
- [ ] `<html lang="en">`, a meaningful `<title>` per route (update `document.title` on navigation).
- [ ] A skip link ("Skip to main content") is the first focusable element and targets `<main id="main" tabindex="-1">`.
- [ ] Landmarks: `<header>`, `<nav aria-label="Primary">`, `<main>`, `<footer>`.
- [ ] Exactly one `<h1>` per page, with logical heading order.
- [ ] On route change, move focus to the page `<h1>`.

## Forms
- [ ] Every input has a visible `<label>`. Helper text is linked with `aria-describedby`.
- [ ] Errors are shown inline in text, linked with `aria-describedby` and `aria-invalid="true"`. An error summary with `role="alert"` appears on submit.
- [ ] Required fields are marked in text ("required"), not only with an asterisk.
- [ ] Inputs use the correct types: `type="number"` with `inputMode="numeric"` for money, `type="date"` for dates.
- [ ] The rank control uses a list of items with "Move up" and "Move down" buttons (`aria-label` names the item). After a move, announce "Food moved to position 1".

## Keyboard
- [ ] Every action works with Tab, Shift+Tab, Enter, Space and Esc.
- [ ] Visible focus ring: `focus-visible:outline-2 outline-offset-2` with a high-contrast colour.
- [ ] Tabs follow the WAI-ARIA Tabs pattern (arrow keys move between tabs; `role="tablist"`, `tab`, `tabpanel`).
- [ ] Dialogs: focus is trapped, Esc closes, focus returns to the trigger, and `aria-modal="true"` with `aria-labelledby` is set.
- [ ] No keyboard traps; no positive `tabindex` values.

## Dynamic and AI content
- [ ] AI responses and computed results render inside `<div aria-live="polite">`.
- [ ] Loading regions use `aria-busy="true"` plus visible text such as "Drafting your plan…".
- [ ] Errors use `role="alert"`.
- [ ] Toasts (for example "Change applied. Undo") are polite and stay at least 8 s. The Undo button is reachable by keyboard.

## Visual
- [ ] Text contrast ≥ 4.5:1; large text and UI elements ≥ 3:1. Tokens are defined in `styles/index.css` and checked.
- [ ] Status is never shown by colour alone. Over-budget, blocked and at-risk states each pair an icon with text.
- [ ] Source badges carry text labels ("Estimate", "Your number", "Vendor quote").
- [ ] Layout works at 360 px and at 200% zoom with no horizontal scroll.
- [ ] `@media (prefers-reduced-motion: reduce)` disables transitions.
- [ ] Tap targets are at least 44×44 px.

## Tables and data
- [ ] The quote comparison uses a `<table>` with a `<caption>` and `<th scope>`.
- [ ] Budget bars have a text equivalent ("₹12,000 of ₹15,000 used, 80%").
- [ ] Icons are `aria-hidden="true"` when decorative. Icon-only buttons have an `aria-label`.

## Manual test script (5 minutes, before each submission)
1. Unplug the mouse. Complete: sample event → edit budget → add 20 guests → apply → undo → delay a task.
2. With NVDA or VoiceOver: confirm the AI plan and the change result are announced.
3. Zoom to 200% and resize to 360 px: everything is usable.
4. Run a Lighthouse accessibility audit on Home and Plan pages: score ≥ 95.
