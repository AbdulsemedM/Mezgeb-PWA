import type { MyAccount } from '../data/accounts';
import type { Entry, Limits, PaymeRequest, Representative } from '../data/book';
import { kvSet } from '../storage/db';
import { json } from './render';

export const USER = {
  id: 'u1',
  phone: '+251911223344',
  name: null,
  language: 'en',
  calendar_pref: 'gregorian',
};

export const TOKENS = {
  access_token: 'a-1',
  access_expires_at: '2099-01-01T00:00:00.000Z',
  refresh_id: 'r-1',
  refresh_expires_at: '2099-01-01T00:00:00.000Z',
};

/** A saved session, as after sign-in (the access token is renewed on first use). */
export async function signedIn(user: Partial<typeof USER> = {}): Promise<void> {
  await kvSet('session', { refreshId: 'r-1', user: { ...USER, ...user } });
}

export function account(over: Partial<MyAccount> & { id: string }): MyAccount {
  return {
    status: 'active',
    shop: {
      id: `m-${over.id}`,
      name: 'Abebe Shop',
      sub_city: 'Bole',
      woreda: null,
      landmark: null,
    },
    customer_detail_view: null,
    terms_accepted_at: '2026-10-01T07:00:00.000Z',
    created_at: '2026-10-01T07:00:00.000Z',
    head: { seq: 3, hash: 'a'.repeat(64) },
    balance_santim: 0,
    ...over,
  };
}

/** Limits with an effective value limit and a due date (or none). */
export function limits(
  effective: number | null,
  time: { state?: Limits['state']['time']['state']; due?: string | null } = {},
): Limits {
  return {
    merchant:
      effective === null ? null : { value: effective, period: null, mode: 'alert', updated_at: '' },
    customer: null,
    state: {
      status: 'ok',
      value: { status: 'ok', effective_limit: effective, projected_balance: 0, crossed: [] },
      representative: null,
      time: {
        state: time.state ?? 'none',
        due_date: time.due ?? null,
        merchant_due_date: time.due ?? null,
        customer_due_date: null,
        period_start: null,
      },
      flags: [],
    },
  };
}

let seq = 0;
export function purchase(over: Partial<Entry> = {}): Entry {
  seq += 1;
  return {
    id: `e-${seq}`,
    account_id: 'acc-1',
    type: 'purchase',
    amount: 12_000,
    lines: [
      {
        line_no: 1,
        name: 'Sugar',
        qty: '2',
        unit: 'kg',
        unit_price: 5_000,
        amount: 10_000,
        source: 'manual',
      },
      {
        line_no: 2,
        name: 'Bread',
        qty: '4',
        unit: null,
        unit_price: 500,
        amount: 2_000,
        source: 'manual',
      },
    ],
    taken_by_type: 'customer',
    representative_id: null,
    order_id: null,
    ref_entry_id: null,
    reason: null,
    payment_method: null,
    seq,
    hash: 'b'.repeat(64),
    recorded_at: '2026-10-20T07:42:00.000Z',
    flags: [],
    ...over,
  };
}

export function rep(over: Partial<Representative> & { id: string; name: string }): Representative {
  return {
    account_id: 'acc-1',
    relationship: 'household',
    status: 'active',
    may_order: false,
    has_pin: false,
    limit: null,
    phone: null,
    sms_receipt: false,
    ...over,
  };
}

export function payme(over: Partial<PaymeRequest> = {}): PaymeRequest {
  return {
    id: 'p-1',
    account_id: 'acc-1',
    amount: 50_000,
    message: 'Please pay before the holiday',
    due_date: '2026-11-01',
    payment_details: 'telebirr 0911 000 000',
    status: 'sent',
    created_at: '2026-10-21T07:00:00.000Z',
    ...over,
  };
}

/** API routes for one customer with these shops; extend with more routes per test. */
export function shopsApi(
  shops: {
    account: MyAccount;
    limits: Limits;
    entries?: Entry[];
    payme?: PaymeRequest[];
    reps?: Representative[];
  }[],
) {
  const find = (path: string) => shops.find((s) => path.includes(`/accounts/${s.account.id}`))!;
  return {
    'POST /v1/auth/web/refresh': () => json(200, TOKENS),
    'GET /v1/accounts': () =>
      json(200, { accounts: shops.map((s) => s.account), next_after: null }),
    'GET /v1/accounts/:id': ({ path }: { path: string }) => json(200, find(path).account),
    'GET /v1/accounts/:id/limits': ({ path }: { path: string }) => json(200, find(path).limits),
    'GET /v1/accounts/:id/entries': ({ path }: { path: string }) =>
      json(200, { entries: find(path).entries ?? [] }),
    'GET /v1/accounts/:id/payme-requests': ({ path }: { path: string }) =>
      json(200, { payme_requests: find(path).payme ?? [] }),
    'GET /v1/accounts/:id/representatives': ({ path }: { path: string }) =>
      json(200, { representatives: find(path).reps ?? [] }),
    'PATCH /v1/accounts/:id': ({ path }: { path: string }) => json(200, find(path).account),
  };
}
