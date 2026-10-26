import { type Page, expect, test } from '@playwright/test';
import { expectBigTapTargets, expectNoSidewaysOverflow, setTextScale } from './checks';
import { fakeApi, INVITE } from './fake-api';

const USER = { id: 'u1', phone: '+251911223344', name: null, language: 'en', calendar_pref: null };
const TOKENS = {
  access_token: 'a-1',
  access_expires_at: '2099-01-01T00:00:00.000Z',
  refresh_id: 'r-1',
  refresh_expires_at: '2099-01-01T00:00:00.000Z',
};

function backend(page: Page) {
  const user = { ...USER };
  const account = {
    id: INVITE.account_id,
    status: 'pending',
    shop: { id: 'm1', name: 'Abebe Shop', sub_city: 'Bole', woreda: null, landmark: null },
    customer_detail_view: null,
    terms_accepted_at: null,
    created_at: '2026-10-20T07:00:00.000Z',
    head: { seq: 0, hash: '0'.repeat(64) },
    balance_santim: 0,
  };
  return fakeApi(page, {
    'GET /v1/invites/:code': () => ({ body: INVITE }),
    'POST /v1/auth/otp': () => ({ status: 202, body: { expires_at: '', resend_after_s: 60 } }),
    'POST /v1/auth/verify': (body) =>
      body.code === '123456'
        ? { body: { ...TOKENS, user, is_new_user: true } }
        : { status: 401, body: { code: 'otp_invalid', details: { attempts_left: 4 } } },
    'PATCH /v1/me': (body) => {
      Object.assign(user, body);
      return { body: user };
    },
    'GET /v1/accounts': () => ({ body: { accounts: [account], next_after: null } }),
    'POST /v1/accounts/:id/accept': () => {
      account.status = 'active';
      return { body: account };
    },
  });
}

async function typeOnPad(page: Page, keys: string) {
  for (const k of keys) await page.getByRole('button', { name: k, exact: true }).click();
}

async function signInAndAccept(page: Page) {
  await typeOnPad(page, '0911223344');
  await page.getByRole('button', { name: 'Send code' }).click();
  await expect(page.getByText('We sent a 6-digit code to 09 11 22 33 44.')).toBeVisible();
  await expectBigTapTargets(page);
  await typeOnPad(page, '123456');
  await page.getByRole('radio', { name: /Ethiopian calendar/ }).click();
  await page.getByRole('link', { name: /Abebe Shop/ }).click();
  await expect(page.getByText('Your dube book with Abebe Shop')).toBeVisible();
  await page.getByRole('button', { name: 'I agree' }).click();
  await expect(page.getByText('Done. Your dube book with Abebe Shop is open.')).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
}

test.describe('W3: US-02 sign-in and accept the invite', () => {
  test('Android: invite link → continue in the browser → sign in → accept', async ({ page }) => {
    const calls = await backend(page);
    await page.goto('/i/K7M2P9QX');
    await page.getByRole('link', { name: 'Continue' }).click();
    await page.getByRole('link', { name: 'Continue in the browser' }).click();
    await signInAndAccept(page);
    const verify = calls.find((c) => c.path === '/v1/auth/verify')!;
    expect(verify.body.session).toBe('cookie');
    // The refresh token is never in browser storage (CLAUDE.md rule 6).
    const stored = await page.evaluate(async () => {
      const dump: string[] = [JSON.stringify(localStorage)];
      const db = await new Promise<IDBDatabase>((res) => {
        const r = indexedDB.open('mezgeb');
        r.onsuccess = () => res(r.result);
      });
      const all = await new Promise<unknown[]>((res) => {
        const r = db.transaction('kv').objectStore('kv').getAll();
        r.onsuccess = () => res(r.result);
      });
      dump.push(JSON.stringify(all));
      return dump.join('\n');
    });
    expect(stored).not.toMatch(/refresh_token/);
  });

  test('iPhone: the installed app opens with no stored invite code, and still finds the shop', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      locale: 'en-US',
    });
    const page = await context.newPage();
    await backend(page);
    // A fresh app: start_url, nothing in storage from Safari.
    await page.goto('/');
    await expect(page).toHaveURL(/\/start$/);
    await page.getByRole('radio', { name: 'English' }).click();
    await page.getByRole('link', { name: 'Next' }).click();
    await signInAndAccept(page);
    await context.close();
  });

  test('sign-in screens work at 200% text', async ({ page }) => {
    await backend(page);
    await page.goto('/signin');
    await setTextScale(page, 200);
    await expectNoSidewaysOverflow(page);
    await expectBigTapTargets(page);
  });
});
