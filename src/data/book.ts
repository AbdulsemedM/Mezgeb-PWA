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

/** PAY-2: the customer's "I paid", until the shop confirms or rejects it. */
export interface PaymentReport {
  id: string;
  account_id: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  status: 'reported' | 'confirmed' | 'rejected';
  reject_reason: string | null;
  entry_id: string | null;
  resubmitted_from_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  has_receipt: boolean;
}

/** ADR-014: what the customer asked for; the priced list once the shop priced it. */
export interface OrderLine {
  name: string;
  qty?: string | null;
  unit?: string | null;
  item_id?: string | null;
  note?: string | null;
  unit_price?: number;
  amount?: number;
  unavailable?: boolean;
}

export interface Order {
  id: string;
  account_id: string;
  lines: OrderLine[];
  address_note: string | null;
  preferred_time: string | null;
  status: 'sent' | 'accepted' | 'priced' | 'out_for_delivery' | 'delivered' | 'declined';
  decline_reason: string | null;
  delivery_person: string | null;
  delivered_entry_id: string | null;
  receipt_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** LED-5/6: the customer's dispute of an entry, answered by a correction or a note. */
export interface Dispute {
  id: string;
  entry_id: string;
  reason: string;
  status: 'open' | 'resolved';
  resolution_entry_id: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
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
  reports: PaymentReport[];
  orders: Order[];
  disputes: Dispute[];
}

export async function fetchBook(accountId: string): Promise<Book> {
  const base = `/v1/accounts/${accountId}`;
  const [account, entries, limits, payme, reps, raises, reports, orders, disputes] =
    await Promise.all([
      api<MyAccount>('GET', base),
      api<{ entries: Entry[] }>('GET', `${base}/entries`),
      api<Limits>('GET', `${base}/limits`),
      api<{ payme_requests: PaymeRequest[] }>('GET', `${base}/payme-requests`),
      api<{ representatives: Representative[] }>('GET', `${base}/representatives`),
      api<{ raises: Raise[] }>('GET', `${base}/raises`),
      api<{ payment_reports: PaymentReport[] }>('GET', `${base}/payment-reports`),
      api<{ orders: Order[] }>('GET', `${base}/orders`),
      api<{ disputes: Dispute[] }>('GET', `${base}/disputes`),
    ]);
  return {
    account,
    entries: entries.entries,
    limits,
    payme: payme.payme_requests,
    representatives: reps.representatives,
    raises: raises.raises,
    reports: reports.payment_reports,
    orders: orders.orders,
    disputes: disputes.disputes,
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

/** ADR-016: the shop's items the customer can order (names and units only). */
export interface CatalogueItem {
  id: string;
  name: string;
  unit: string | null;
}

export async function fetchCatalogue(accountId: string): Promise<CatalogueItem[]> {
  return (await api<{ items: CatalogueItem[] }>('GET', `/v1/accounts/${accountId}/catalogue`))
    .items;
}
