# Deploying the customer PWA

The PWA is static files (`dist/`) on HTTPS, on the same site as the API (for example
`https://mezgeb.et` and `https://api.mezgeb.et`): the refresh cookie is `SameSite=Lax` and must
reach the API from the PWA (backend ADR-016).

## Build

```sh
pnpm install --frozen-lockfile
VITE_API_URL=https://api.mezgeb.et \
VITE_SUPPORT_PHONE=+2519XXXXXXXX \
ANDROID_CERT_SHA256=AA:BB:…        # the Flutter app's release signing certificate(s)
pnpm build && pnpm size
```

| Variable | Used for |
| --- | --- |
| `VITE_API_URL` | The API origin. Empty means the same origin (only for a proxy setup). Also goes into the CSP `connect-src`. |
| `VITE_SUPPORT_PHONE` | "Call Nota support" everywhere. **Still a placeholder** (`+251900000000`). |
| `ANDROID_CERT_SHA256` | `/.well-known/assetlinks.json` for Android App Links (comma separated). Empty: links open in the browser/PWA only. |

The build writes `dist/csp.txt`: the exact `Content-Security-Policy` header value, including the
hash of the inline app script. It changes with every build, so the host must read it from the
build, never from a copy. `e2e/csp.spec.ts` proves the app runs under it.

## Host settings

| Path | Header / rule |
| --- | --- |
| every page | `Content-Security-Policy: <dist/csp.txt>`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `Strict-Transport-Security: max-age=31536000` |
| `/index.html`, `/sw.js`, `/manifest.webmanifest` | `Cache-Control: no-cache` (the service worker decides what is fresh) |
| `/fonts/*`, `/icons/*` | `Cache-Control: public, max-age=604800` |
| `/.well-known/assetlinks.json` | `Content-Type: application/json`; never rewritten to the app |
| any other path | serve `/index.html` (the app routes `/i/<code>`, `/shops/…` itself) |

Example (Caddy):

```caddy
mezgeb.et {
  root * /srv/nota-web/dist
  header Content-Security-Policy "{file./srv/nota-web/dist/csp.txt}"
  header X-Content-Type-Options nosniff
  header Referrer-Policy same-origin
  header Strict-Transport-Security "max-age=31536000"
  @nocache path /index.html /sw.js /manifest.webmanifest
  header @nocache Cache-Control no-cache
  @static path /fonts/* /icons/*
  header @static Cache-Control "public, max-age=604800"
  @wellknown path /.well-known/*
  handle @wellknown {
    header Content-Type application/json
    file_server
  }
  try_files {path} /index.html
  file_server
}
```

## API settings (backend `.env`, ADR-016)

- `PUBLIC_WEB_URL=https://mezgeb.et`: invite links (`/i/<code>`), the WebOTP line in the code
  SMS, and the allowed CORS origin.
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (`npx web-push generate-vapid-keys`), `VAPID_SUBJECT`:
  without them the PWA never offers messages and SMS carries everything.
- `OTP_FIXED_CODE` must be **unset** (backend security checklist).
- Object storage (`S3_*`) for receipt photos.

## After deploying

1. Open `https://mezgeb.et/start` on an Android phone: language, sign-in with a real SMS (the
   code should fill itself), install from the menu.
2. `curl -sI https://mezgeb.et/.well-known/assetlinks.json` gives `application/json`.
3. Watch: uptime of `https://mezgeb.et/` and `https://api.mezgeb.et/v1/health`; API logs for
   `refresh_reused` and 4xx on `/v1/sync`-less PWA routes (`/v1/accounts/…`); SMS volume.

## Release checklist

- `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm size && pnpm test:e2e`
  (CI does this) and Lighthouse CI.
- `pnpm sync:shared` after any backend `packages/shared` change; `pnpm font:subset` after any
  Amharic text change (a test fails otherwise).
- Native-speaker review of `docs/i18n-review.csv` (`pnpm strings:export`) before the pilot.
