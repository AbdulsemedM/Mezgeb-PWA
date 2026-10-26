import type { Page } from '@playwright/test';

/** One signed-in customer with one shop (Abebe Shop), for e2e tests with a faked API. */
export const USER = {
  id: 'u1',
  phone: '+251911223344',
  name: null,
  language: 'en',
  calendar_pref: 'gregorian',
};

export const ACCOUNT = {
  id: 'acc-1',
  status: 'active',
  shop: { id: 'm1', name: 'Abebe Shop', sub_city: 'Bole', woreda: null, landmark: null },
  customer_detail_view: null,
  terms_accepted_at: '2026-10-01T07:00:00.000Z',
  created_at: '2026-10-01T07:00:00.000Z',
  head: { seq: 1, hash: 'a'.repeat(64) },
  balance_santim: 85_000,
};

export const LIMITS = {
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

export const ENTRY = {
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

export const REP = {
  id: 'r-1',
  account_id: 'acc-1',
  name: 'Selam',
  relationship: 'maid',
  status: 'active',
  may_order: false,
  has_pin: true,
  limit: null,
  phone: null,
  sms_receipt: false,
};

/** The read routes of that shop, to spread into fakeApi() with a test's own routes. */
export function shopRoutes() {
  return {
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
    'GET /v1/accounts/:id/representatives': () => ({ body: { representatives: [REP] } }),
    'GET /v1/accounts/:id/raises': () => ({ body: { raises: [] } }),
    'GET /v1/accounts/:id/payment-reports': () => ({ body: { payment_reports: [] } }),
  };
}

/** Writes the saved session into IndexedDB, as after sign-in. Call after faking the API. */
export async function seedSession(page: Page): Promise<void> {
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
