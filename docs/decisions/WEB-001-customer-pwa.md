# WEB-001 — Customer PWA: invite, install and offline behaviour

Status: accepted (install-first) · Date: 2026-10-22 · Revised 2026-10-26 (see the end) ·
Builds on ADR-002, ADR-005 and MOB-002 (ease of use). Was numbered ADR-006, which clashed with
the backend's ADR-006; the backend side of this decision is the backend's ADR-016.

## Context
Customers get an SMS invite link from the merchant. We want them to end up with Mezgeb on their
home screen. Install prompts only exist in Chromium browsers on Android, need a user tap first,
and don't work inside in-app browsers (Telegram, Facebook). iPhones have no prompt at all.
Our users are not comfortable with technology (ADR-005), so the flow must never dead-end.

## Decision: install first, then the dube book

The product owner chose install-first: customers install Mezgeb before seeing their book.
The flow below keeps that order while making sure nobody gets stuck.

### Invite flow
1. **SMS**: short link `https://<domain>/i/<code>` (8-character code, expires in 14 days).
2. **Invite screen (browser)**: shop name and one plain sentence
   ("Abebe Shop wants to keep your dube book with you on Mezgeb"), plus a language choice.
   These taps also help Chrome consider the page installable before the next step.
3. **Install screen (browser)**: one big button "Put Mezgeb on my home screen".
   - Chromium on Android with a captured `beforeinstallprompt` → the button opens the prompt.
   - Prompt not ready yet → short "Getting ready…" wait (up to ~5 s), then the picture guide
     for Chrome's menu (⋮ → "Install app" / "Add to Home screen").
   - In-app browser (Telegram, Facebook…) → "Open in Chrome" button (Android `intent://` link).
   - iPhone / other browsers → picture guide for that browser (2–3 images).
   - A small, quiet "Continue in the browser" link at the bottom, so nobody is ever stuck.
4. **After install**: "Mezgeb is on your home screen. Open it from there." with a picture of
   the icon. (On Android, the `appinstalled` event confirms success.)
5. **In the installed app**: confirm phone (OTP; Android Chrome fills the code automatically via
   WebOTP: OTP SMS texts end with `@<domain> #<code>`), calendar choice (ADR-003), terms in plain
   language → "I agree", then **the dube book**.

### Finding the invite after install
The installed app opens at `start_url`, not at the invite link, and on iPhone it does not share
storage with Safari. So the app never depends on the invite code after install: after OTP,
the server returns **all pending invites for that phone number**, and the person accepts them.
The invite code is still stored (IndexedDB) to preselect the shop where storage is shared.

### Opening later links
- On Android, the installed PWA opens links inside its scope, so later SMS links open the app.
- If the person has the **Flutter app** installed (they are a merchant elsewhere), Android App
  Links (`/.well-known/assetlinks.json`) open the invite in the Flutter app instead.

### Sign-in and session
- Same OTP login as the app. Session uses an **httpOnly, Secure, SameSite=Lax refresh cookie**
  on the same site as the API (e.g. `mezgeb.et` + `api.mezgeb.et`); access token in memory.
- Sign-in happens inside the installed app, so the iPhone storage split doesn't cost an extra login.

### Notifications
- Web Push (VAPID) as an additional channel behind the backend's `PushSender`; SMS fallback stays.
- Permission asked only after a meaningful moment with a plain explanation
  ("Get a message when Abebe adds a purchase"), never on first load.

### Offline
- Service worker caches the app shell and fonts; the last-seen data is stored in IndexedDB and
  shown with "Last updated 10:42".
- Writes (order, payment report, dispute, representative changes) are queued in IndexedDB with
  client UUIDs and sent when online or when the app is next opened. Raise approvals are online-only.
- The PWA creates **no ledger entries**, so it needs no device signing key (ADR-001). If a future
  feature lets customers create entries, use a non-extractable WebCrypto ECDSA P-256 key.

## Budgets (3G, low-end Android)
- Initial JavaScript ≤ 170 KB gzip; first meaningful screen < 5 s on Chrome's "Slow 3G" profile.
- Noto Sans Ethiopic self-hosted as a **subset** woff2, preloaded; system font fallback.
- Lighthouse: installable, accessibility ≥ 95.

## Stack
React 18 + TypeScript + Vite, `vite-plugin-pwa` (injectManifest, Workbox), react-router,
`idb` for IndexedDB, zod schemas and i18n strings shared from `packages/shared`.
No UI framework; a small component kit implementing ADR-005, mirroring the Flutter UI kit.

## Backend changes required (do before W1)
- Invite short codes and the `/i/<code>` resolver; an endpoint returning pending invites for the signed-in phone.
- WebOTP line in OTP SMS template.
- Cookie-based refresh for web clients (alongside the mobile token flow).
- Web Push subscriptions + VAPID sender.
- `assetlinks.json` and the web manifest served from the PWA domain.

## Revisions (2026-10-26, decided with the product owner)
- **Repository**: the PWA lives in its own repository (`web/`, next to `backend/` and `mobile/`).
  `@mezgeb/shared` is copied into `src/shared/` by `pnpm sync:shared` (like the app copies the test
  vectors, MOB-003); `pnpm test` fails when the copy differs from a `../backend` checkout.
  Runtime code imports only zod-free shared modules; schemas are `import type` only.
- **Refresh with proof of possession**: the refresh token stays in the httpOnly cookie, and the PWA
  signs the token's public `refresh_id` with its non-extractable WebCrypto key
  (`POST /v1/auth/web/refresh`, backend ADR-016). The cookie alone is not enough to refresh.
- **Preact instead of React at runtime**: screens are written against the React API, and
  `react` resolves to `preact/compat` (`@preact/preset-vite`). Measured on the shell: React
  104 KB gzip / 4.5 s on Slow 3G; Preact 43 KB / 3.3 s. Removing the alias brings React back.
- **One request on first visit**: the entry script and stylesheet are inlined into `index.html`
  (Slow 3G costs 2 s per round trip); the service worker precaches it. No code splitting.
- **Lighthouse**: Lighthouse 12 has no PWA/installable audits any more. Installability (manifest,
  icons, service worker, offline start) is checked in Playwright; Lighthouse CI asserts
  accessibility ≥ 95.
- **Font**: the subset holds the Ethiopic characters of the app's own Amharic text (~21 KB per
  weight, `pnpm font:subset`); names people type fall back to the phone's Ethiopic system font.
