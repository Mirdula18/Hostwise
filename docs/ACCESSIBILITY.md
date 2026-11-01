# Accessibility — Hostwise

Target: **WCAG 2.2 AA**. This is checked automatically (axe in unit and e2e tests) and by hand (the checklist below).

## Structure
- [x] `<html lang="en">`, a meaningful `<title>` per route (update `document.title` on navigation).
- [x] A skip link ("Skip to main content") is the first focusable element and targets `<main id="main" tabindex="-1">`.
- [x] Landmarks: `<header>`, `<nav aria-label="Primary">`, `<main>`, `<footer>`.
- [x] Exactly one `<h1>` per page, with logical heading order.
- [x] On route change, move focus to the page `<h1>`.

## Forms
- [x] Every input has a visible `<label>`. Helper text is linked with `aria-describedby`.
- [x] Errors are shown inline in text, linked with `aria-describedby` and `aria-invalid="true"`. An error summary with `role="alert"` appears on submit.
- [x] Required fields are marked in text ("required"), not only with an asterisk.
- [x] Inputs use the correct types: `type="number"` with `inputMode="numeric"` for money, `type="date"` for dates.
- [x] The rank control uses a list of items with "Move up" and "Move down" buttons (`aria-label` names the item). After a move, announce "Food moved to position 1".

## Keyboard
- [x] Every action works with Tab, Shift+Tab, Enter, Space and Esc.
- [x] Visible focus ring: `focus-visible:outline-2 outline-offset-2` with a high-contrast colour.
- [x] Tabs follow the WAI-ARIA Tabs pattern (arrow keys move between tabs; `role="tablist"`, `tab`, `tabpanel`).
- [x] Dialogs: focus is trapped, Esc closes, focus returns to the trigger, and `aria-modal="true"` with `aria-labelledby` is set.
- [x] No keyboard traps; no positive `tabindex` values.

## Dynamic and AI content
- [x] AI responses and computed results render inside `<div aria-live="polite">`.
- [x] Loading regions use `aria-busy="true"` plus visible text such as "Drafting your plan…".
- [x] Errors use `role="alert"`.
- [x] Toasts (for example "Change applied. Undo") are polite and stay at least 8 s. The Undo button is reachable by keyboard.

## Visual
- [x] Text contrast ≥ 4.5:1; large text and UI elements ≥ 3:1. Tokens are defined in `styles/index.css` and checked.
- [x] Status is never shown by colour alone. Over-budget, blocked and at-risk states each pair an icon with text.
- [x] Source badges carry text labels ("Estimate", "Your number", "Vendor quote").
- [x] Layout works at 360 px and at 200% zoom with no horizontal scroll.
- [x] `@media (prefers-reduced-motion: reduce)` disables transitions.
- [x] Tap targets are at least 44×44 px.

## User preferences and modes
- [x] `prefers-reduced-motion`: animations and transitions are effectively disabled.
- [x] `prefers-contrast: more`: secondary text, card edges and input borders switch to near-black.
- [x] `forced-colors: active` (Windows High Contrast): progress and split bars keep an outline and a `Highlight` fill; every button variant has a border so filled buttons stay outlined; the selected tab keeps its indicator.
- [x] An in-app accessibility statement (`/accessibility`, linked in the footer) lists what is supported, how it is tested and how to report a problem.

## Automated checks
- [x] vitest-axe on every screen and dialog in component tests.
- [x] Playwright + axe with WCAG 2.0/2.1/2.2 A and AA tags plus best practices on every tab, at 360 px, and with forced colours, increased contrast and reduced motion emulated.

## Tables and data
- [x] The quote comparison uses a `<table>` with a `<caption>` and `<th scope>`.
- [x] Budget bars have a text equivalent ("₹12,000 of ₹15,000 used, 80%").
- [x] Icons are `aria-hidden="true"` when decorative. Icon-only buttons have an `aria-label`.

## Manual test script (5 minutes, before each submission)
1. Unplug the mouse. Complete: sample event → edit budget → add 20 guests → apply → undo → delay a task.
2. With NVDA or VoiceOver: confirm the AI plan and the change result are announced.
3. Zoom to 200% and resize to 360 px: everything is usable.
4. Run a Lighthouse accessibility audit on Home and Plan pages: score ≥ 95.
