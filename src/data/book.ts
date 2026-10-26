import type { LimitsResult } from '@shared/limits/engine';
import { api } from '../api/client';
import { listMyAccounts, type MyAccount } from './accounts';

/** `EntryView` from the API. Entries are append-only: corrections are new entries. */
export interface Entry {
  id: string;
  account_id: string;
  type: 'purchase' | 'payment' | 'correction';
  amount: number;
  lines: {
    line_no: number;
    name: string;
    qty: string | null;
    unit: string | null;
    unit_price: number | null;
    amount: number;
    source: 'manual' | 'photo' | 'order';
  }[];
  taken_by_type: 'customer' | 'representative' | 'delivery' | null;
  representative_id: string | null;
  order_id: string | null;
  ref_entry_id: string | null;
  reason: string | null;
  payment_method: PaymentMethod | null;
  seq: number;
  hash: string;
  recorded_at: string;
  flags: string[];
}

export type PaymentMethod = 'cash' | 'telebirr' | 'cbe_birr' | 'mpesa' | 'bank_transfer' | 'other';

export interface LimitSetting {
  value: number | null;
  period: { type: 'weekly' | 'biweekly' | 'monthly' | 'custom_days'; days: number | null } | null;
  mode: 'alert' | 'hard_stop';
  updated_at: string;
}

/** `GET /v1/accounts/{id}/limits`: both sides and the engine's state on the current balance. */
export interface Limits {
  merchant: LimitSetting | null;
  customer: LimitSetting | null;
  state: LimitsResult;
}

export interface PaymeRequest {
  id: string;
  account_id: string;
  amount: number;
  message: string | null;
  due_date: string | null;
  payment_details: string | null;
  status: 'sent' | 'seen' | 'partially_paid' | 'paid' | 'expired';
  created_at: string;
}

/** The customer's own view of a person who may take goods for them (ADR-009). */
export interface Representative {
  id: string;
  account_id: string;
  name: string;
  relationship: 'household' | 'maid' | 'guard' | 'driver' | 'other';
  status: 'active' | 'paused' | 'revoked';
  may_order: boolean;
  has_pin: boolean;
  limit: {
    value: number;
    period: { type: string; days: number | null; calendar: string | null };
    set_at: string;
  } | null;
  phone: string | null;
  sms_receipt: boolean;
}

/** ADR-011: the shop asks to go over the customer's hard stop once (ADR-016 lists them). */
export interface Raise {
  id: string;
  account_id: string;
  amount: number;
  status: 'pending' | 'approved' | 'used' | 'expired';
  expires_at: string;
  valid_until: string | null;
}

/** One shop's dube book, cached whole for offline reading (WEB-001). */
export interface Book {
  account: MyAccount;
  entries: Entry[];
  limits: Limits;
  payme: PaymeRequest[];
  representatives: Representative[];
  /** Waiting raise requests; acted on online only. */
  raises: Raise[];
}

export async function fetchBook(accountId: string): Promise<Book> {
  const base = `/v1/accounts/${accountId}`;
  const [account, entries, limits, payme, reps, raises] = await Promise.all([
    api<MyAccount>('GET', base),
    api<{ entries: Entry[] }>('GET', `${base}/entries`),
    api<Limits>('GET', `${base}/limits`),
    api<{ payme_requests: PaymeRequest[] }>('GET', `${base}/payme-requests`),
    api<{ representatives: Representative[] }>('GET', `${base}/representatives`),
    api<{ raises: Raise[] }>('GET', `${base}/raises`),
  ]);
  return {
    account,
    entries: entries.entries,
    limits,
    payme: payme.payme_requests,
    representatives: reps.representatives,
    raises: raises.raises,
  };
}

/** Home: every shop with its limit state, so balances and due dates show without opening each. */
export interface HomeData {
  accounts: MyAccount[];
  limits: Record<string, Limits>;
  payme: PaymeRequest[];
  raises: Raise[];
}

export async function fetchHome(): Promise<HomeData> {
  const accounts = await listMyAccounts();
  const open = accounts.filter((a) => a.status === 'active' || a.status === 'paused');
  const perShop = await Promise.all(
    open.map(async (a) => {
      const [limits, payme, raises] = await Promise.all([
        api<Limits>('GET', `/v1/accounts/${a.id}/limits`),
        api<{ payme_requests: PaymeRequest[] }>('GET', `/v1/accounts/${a.id}/payme-requests`),
        api<{ raises: Raise[] }>('GET', `/v1/accounts/${a.id}/raises`),
      ]);
      return { id: a.id, limits, payme: payme.payme_requests, raises: raises.raises };
    }),
  );
  return {
    accounts,
    limits: Object.fromEntries(perShop.map((s) => [s.id, s.limits])),
    payme: perShop.flatMap((s) => s.payme),
    raises: perShop.flatMap((s) => s.raises),
  };
}
