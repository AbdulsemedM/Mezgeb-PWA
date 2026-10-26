# web — customer PWA

Read ../backend/CLAUDE.md, the backend's docs/decisions (ADR-001 to ADR-016), MOB-002 (ease of
use, in ../mobile/docs/decisions), docs/decisions/WEB-001, and docs/web-plan.md before working here.

## Rules specific to the PWA
1. **MOB-002 applies to every screen.** Use the components in `src/ui/`; don't build new
   buttons, inputs or dialogs ad hoc.
2. **Stay within the budgets in WEB-001.** Check bundle size in every PR; no new dependency
   without stating its gzip size.
3. **Never block on install.** Installing is always offered, never required.
4. **Offline never looks like an error**; show cached data with "Last updated".
5. **Writes are queued** with a client UUID and are safe to retry.
6. **No browser storage for secrets**: the refresh token lives only in the httpOnly cookie.
7. **No hard-coded user-facing strings**; dates through the shared calendar helper.
8. Customer features only. Merchant features belong in the Flutter app.

## Commands
Node 22, pnpm 10. The backend repo is expected at `../backend` (shared code, local API).

- `pnpm install`, then `pnpm dev` — Vite on :5173; `/v1` is proxied to the API on :3000
  (`MEZGEB_DEV_API` to change), so the refresh cookie is same-origin in development.
- `pnpm test` — checks `src/shared` against `../backend/packages/shared` (skipped without it),
  then Vitest (jsdom, fake-indexeddb). One file: `pnpm exec vitest run src/ui`.
- `pnpm build && pnpm size` — production build and the WEB-001 budget (also fails if zod leaks
  into the bundle). `pnpm test:e2e` — Playwright on the build (`vite preview` on :4173), Pixel 5
  profile, API faked with `page.route`; includes the Slow 3G first-screen budget.
- `pnpm lint`, `pnpm typecheck` (app, service worker, Node configs), `pnpm format`.
- `pnpm sync:shared` — copy the backend's shared code after it changes. Never edit `src/shared`.
- `pnpm font:subset` — after changing `src/i18n/am.ts` (a test fails otherwise). `pnpm icons`.

## Patterns
- Runtime is Preact behind the React API: import from `react`, test with `@testing-library/preact`.
- UI kit in `src/ui/` (Screen, BigButton, Sheet, ConfirmSheet, HelpButton, CalmBanner, ErrorPanel,
  EmptyState, ChoiceTile, TextField, AmountText, AmountKeypad/NumberPad, LimitUsageBar,
  StatusPill, useSuccess). Strings: `useT()` keys in `src/i18n/en.ts` (am/om must have every key;
  ICU plurals as in the app's ARB files). Dates: `src/lib/dates.ts`; money: `src/lib/money.ts`.
- API: `api(method, path, {body})` from `src/api/client.ts` throws `ApiError {status, code}` or
  `OfflineError`; the session (`src/auth/session.ts`) renews the access token itself.
- Storage: IndexedDB via `src/storage/db.ts` (`kv`, `cache`, `queue`). Never the refresh token.
