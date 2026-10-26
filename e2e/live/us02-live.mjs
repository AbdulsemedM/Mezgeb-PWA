// Live US-02 against a local API through the Vite dev server (not run in CI):
//   pnpm dev   (with MEZGEB_DEV_API pointing at the API), then
//   node e2e/live/us02-live.mjs '<json printed by seed-invite.mjs>'
import { chromium, devices } from '@playwright/test';

const { customerPhone, inviteCode } = JSON.parse(process.argv[2]);
const WEB = process.env.WEB ?? 'http://localhost:5173';
const OTP = process.env.OTP ?? '654321';

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['Pixel 5'], locale: 'en-US' });
const page = await context.newPage();
const apiStatuses = [];
page.on('response', (r) => {
  if (r.url().includes('/v1/'))
    apiStatuses.push(`${r.request().method()} ${new URL(r.url()).pathname} ${r.status()}`);
});
const step = (s) => console.log(`✓ ${s}`);

await page.goto(`${WEB}/i/${inviteCode}`);
await page.getByText(/wants to keep your dube book/).waitFor();
step('invite screen shows the shop');
await page.getByRole('link', { name: 'Continue' }).click();
await page.getByRole('link', { name: 'Continue in the browser' }).click();
for (const k of customerPhone) await page.getByRole('button', { name: k, exact: true }).click();
await page.getByRole('button', { name: 'Send code' }).click();
await page.getByText(/We sent a 6-digit code/).waitFor();
step('code sent');
for (const k of OTP) await page.getByRole('button', { name: k, exact: true }).click();
await page.getByRole('heading', { name: 'Which calendar do you use?' }).waitFor();
step('signed in (cookie session)');
const cookies = await context.cookies();
const rt = cookies.find((c) => c.name === 'mz_refresh');
if (!rt?.httpOnly || rt.path !== '/v1/auth')
  throw new Error(`bad refresh cookie: ${JSON.stringify(rt)}`);
step('refresh cookie is httpOnly with Path=/v1/auth');
await page.getByRole('radio', { name: /Ethiopian calendar/ }).click();
await page.getByRole('link', { name: /Live Test Shop/ }).click();
await page.getByRole('button', { name: 'I agree' }).click();
await page.getByText(/Your dube book with .* is open/).waitFor();
await page.waitForURL(`${WEB}/`);
step('invite accepted, home');

// A restart: the access token is gone from memory; the cookie + signature renew it.
await page.reload();
await page.getByRole('button', { name: /Live Test Shop/ }).waitFor();
if (!apiStatuses.some((s) => s.startsWith('POST /v1/auth/web/refresh 200'))) {
  throw new Error('no web refresh happened');
}
step('reload renewed the session with the cookie and a signed refresh_id');
console.log(apiStatuses.join('\n'));
await browser.close();
