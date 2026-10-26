# Customer PWA build plan (apps/web)

Same method as before: plan → OK → tests first → implement → full test run → commit.
Usability check with 3 real customers per milestone with screens (see docs/mobile-plan.md),
plus a test on a low-end Android phone over a throttled connection.

## Prompt for each milestone

> Read CLAUDE.md, apps/web/CLAUDE.md, every file in docs/decisions/, and milestone **W_** in
> docs/web-plan.md. Read the backend code in apps/api for every endpoint used, and the matching
> customer screens in docs/reference/Mezgeb_Demo.html. Give me a short plan (screens, components,
> storage, tests) and wait for my OK. Then write tests first and implement. Ask me if anything is unclear.

---

## W0 — Backend prerequisites (in apps/api)
The five backend changes listed at the end of ADR-006, with tests.

## W1 — Scaffolding and UI kit
- Vite + React + TS in `apps/web`, vite-plugin-pwa, manifest (name, icons, theme colour,
  scope, start_url), service worker shell caching, subset Ethiopic font.
- UI kit mirroring the Flutter one (BigButton, AmountText, AmountKeypad, ConfirmSheet,
  SuccessFeedback, CalmBanner, ErrorPanel, EmptyState, HelpSheet), i18n am/om/en.
- CI: lint, unit tests (Vitest), Playwright smoke test, bundle-size check, Lighthouse CI.

**Done when:** installable shell loads under budget on Slow 3G.

## W2 — Invite and install
Steps 1–4 of ADR-006: invite screen with language choice, install screen with every branch
(prompt, "Getting ready…" fallback, Open in Chrome, picture guides, quiet "Continue in the browser"),
post-install screen.

**Done when:** tested on Android Chrome, Telegram in-app browser, Samsung Internet, iPhone Safari;
usability check passed (3 people install unaided, 2 of 3 minimum).

## W3 — Sign-in, terms and pending invites
Step 5 of ADR-006 and "Finding the invite after install": OTP with WebOTP, calendar choice,
terms, accept pending invites, expired/used invite screens, "wrong number?" help.

**Done when:** US-02 passes in Playwright, including the iPhone case where the app opens with no stored invite code.

## W4 — Dube book (read)
- My shops list; per shop: balance, limit usage (bar + words), due date, entries with who took
  them, payments, pay-me requests.
- Offline cache with "Last updated"; pull-to-refresh plus a visible Refresh button.

**Done when:** US-07 (customer side) passes.

## W5 — Limits and people
- Set my limits (amount and/or time, "ask me before selling over my limit").
- People who can take goods for me: add, pause, remove, their limit, optional PIN.
- Approve a one-time raise (online only).

**Done when:** US-06 and the customer side of US-08 pass.

## W6 — Payments
- See pay-me requests; "I paid" with method, amount, reference and optional receipt photo
  (compressed on the phone before upload).
- Status: waiting / confirmed / rejected with reason; resubmit.

**Done when:** US-10 (customer side) passes.

## W7 — Orders and disputes
- Order for delivery from the shop's catalogue (picture tiles) or free text; follow status;
  confirm received or flag a missing item.
- Dispute a purchase with a reason chip and optional note.

**Done when:** US-12 and US-13 (customer side) pass.

## W8 — Notifications and statements
- Web Push permission at the right moment (ADR-006); notification taps open the right screen.
- Download/share a statement PDF.

## W9 — Polish and launch
- Native-speaker copy review, accessibility pass (TalkBack, 200% text), offline queue edge
  cases, budgets re-checked, production deploy and monitoring.
