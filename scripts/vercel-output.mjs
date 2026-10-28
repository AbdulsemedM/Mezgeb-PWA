// Vercel hosting (backend ADR-017): turns dist/ into Vercel's Build Output (v3) with the host
// settings of docs/deployment.md. The CSP changes with every build, so the headers are written
// here from dist/csp.txt instead of a static vercel.json. /v1/* is proxied to the API project,
// so the PWA and the API share one origin and the SameSite=Lax refresh cookie reaches the API.
// Usage: API_ORIGIN=https://<api>.vercel.app pnpm build && node scripts/vercel-output.mjs
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const api = process.env.API_ORIGIN;
if (!api) throw new Error('Set API_ORIGIN to the API origin, e.g. https://mezgeb-api.vercel.app');
const apiOrigin = new URL(api).origin;

const dist = new URL('../dist/', import.meta.url);
const out = new URL('../.vercel/output/', import.meta.url);
const csp = (await readFile(new URL('csp.txt', dist), 'utf8')).trim();

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(dist, new URL('static/', out), {
  recursive: true,
  filter: (src) => !/[\\/]\.vite([\\/]|$)|[\\/]csp\.txt$|\.map$/.test(src),
});

const config = {
  version: 3,
  routes: [
    { src: '^/v1/(.*)$', dest: `${apiOrigin}/v1/$1` },
    {
      src: '^/(.*)$',
      headers: {
        'Content-Security-Policy': csp,
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'same-origin',
        'Strict-Transport-Security': 'max-age=31536000',
        // index.html, sw.js, the manifest and every app route: the service worker decides.
        'Cache-Control': 'no-cache',
      },
      continue: true,
    },
    {
      src: '^/(fonts|icons)/(.*)$',
      headers: { 'Cache-Control': 'public, max-age=604800' },
      continue: true,
    },
    {
      src: '^/\\.well-known/assetlinks\\.json$',
      headers: { 'Content-Type': 'application/json' },
      continue: true,
    },
    { handle: 'filesystem' },
    { src: '^/\\.well-known/.*$', status: 404 },
    { src: '^/(.*)$', dest: '/index.html' },
  ],
};
await writeFile(new URL('config.json', out), `${JSON.stringify(config, null, 2)}\n`);
console.log(`.vercel/output written (API ${apiOrigin})`);
