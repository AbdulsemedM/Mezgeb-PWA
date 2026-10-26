import { type Page, expect, test } from '@playwright/test';
import { expectBigTapTargets, expectNoSidewaysOverflow, setTextScale } from './checks';
import { fakeApi } from './fake-api';

const USER = {
  id: 'u1',
  phone: '+251911223344',
  name: null,
  language: 'en',
  calendar_pref: 'gregorian',
};
const ACCOUNT = {
  id: 'acc-1',
  status: 'active',
  shop: { id: 'm1', name: 'Abebe Shop', sub_city: 'Bole', woreda: null, landmark: null },
  customer_detail_view: null,
  terms_accepted_at: '2026-10-01T07:00:00.000Z',
  created_at: '2026-10-01T07:00:00.000Z',
  head: { seq: 1, hash: 'a'.repeat(64) },
  balance_santim: 85_000,
};
const LIMITS = {
  merchant: { value: 100_000, period: null, mode: 'alert', updated_at: '' },
  customer: null,
  state: {
    status: 'warn80',
    value: { status: 'warn80', effective_limit: 100_000, projected_balance: 85_000, crossed: [] },
    representative: null,
    time: {
      state: 'running',
      due_date: '2026-11-15',
      merchant_due_date: '2026-11-15',
      customer_due_date: null,
      period_start: '2026-10-15',
    },
    flags: [],
  },
};
const ENTRY = {
  id: 'e-1',
  account_id: 'acc-1',
  type: 'purchase',
  amount: 85_000,
  lines: [
    {
      line_no: 1,
      name: 'Teff',
      qty: '5',
      unit: 'kg',
      unit_price: 17_000,
      amount: 85_000,
      source: 'manual',
    },
  ],
  taken_by_type: 'customer',
  representative_id: null,
  order_id: null,
  ref_entry_id: null,
  reason: null,
  payment_method: null,
  seq: 1,
  hash: 'a'.repeat(64),
  recorded_at: '2026-10-20T07:42:00.000Z',
  flags: [],
};

/** A signed-in phone: the saved session as after sign-in, then the faked API. */
async function signedInBook(page: Page) {
  await fakeApi(page, {
    'POST /v1/auth/web/refresh': () => ({
      body: {
        access_token: 'a',
        access_expires_at: '2099-01-01T00:00:00.000Z',
        refresh_id: 'r-2',
        refresh_expires_at: '2099-01-01T00:00:00.000Z',
      },
    }),
    'GET /v1/accounts': () => ({ body: { accounts: [ACCOUNT], next_after: null } }),
    'GET /v1/accounts/:id': () => ({ body: ACCOUNT }),
    'GET /v1/accounts/:id/limits': () => ({ body: LIMITS }),
    'GET /v1/accounts/:id/entries': () => ({ body: { entries: [ENTRY] } }),
    'GET /v1/accounts/:id/payme-requests': () => ({ body: { payme_requests: [] } }),
    'GET /v1/accounts/:id/representatives': () => ({ body: { representatives: [] } }),
  });
  await page.goto('/start');
  await page.evaluate(async (user) => {
    const db = await new Promise<IDBDatabase>((res) => {
      const r = indexedDB.open('mezgeb', 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore('kv');
        r.result.createObjectStore('cache');
        r.result
          .createObjectStore('queue', { keyPath: 'id' })
          .createIndex('createdAt', 'createdAt');
      };
      r.onsuccess = () => res(r.result);
    });
    await new Promise((res) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put({ refreshId: 'r-1', user }, 'session');
      tx.oncomplete = res;
    });
    db.close();
  }, USER);
}

test.describe('W4: the dube book', () => {
  test('home → book → entry, readable at 200% with big tap targets', async ({ page }) => {
    await signedInBook(page);
    await page.goto('/');
    const card = page.getByRole('link', { name: /Abebe Shop/ });
    await expect(card).toContainText('ETB 850.00');
    await expect(card.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      '85% of the limit used',
    );
    await expect(card).toContainText('Pay by 15 Nov 2026');
    await expectBigTapTargets(page);
    await setTextScale(page, 200);
    await expectNoSidewaysOverflow(page);

    await card.click();
    await expect(page.getByRole('heading', { level: 1, name: 'Abebe Shop' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Purchase/ })).toContainText('Taken by you');
    await expectBigTapTargets(page);
    await setTextScale(page, 200);
    await expectNoSidewaysOverflow(page);

    await page.getByRole('link', { name: /Purchase/ }).click();
    await expect(page.getByText('Teff')).toBeVisible();
  });

  test('offline after a visit: the saved book with "Last updated"', async ({ page, context }) => {
    await signedInBook(page);
    await page.goto('/shops/acc-1');
    await expect(page.getByRole('link', { name: /Purchase/ })).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready);
    // The faked API would still answer: make every call fail like a dropped connection.
    await page.unrouteAll();
    await page.route('**/v1/**', (route) => route.abort('internetdisconnected'));
    await context.setOffline(true);
    await page.reload();
    await expect(
      page.getByText('No internet. Showing what was saved on this phone.'),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Purchase/ })).toBeVisible();
    await context.setOffline(false);
  });
});
