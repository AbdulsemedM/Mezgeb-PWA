import { CURRENT_TERMS_VERSION } from '@shared/terms';
import { api } from '../api/client';

/** `CustomerSideAccountView` from the API (no nickname or location note: CLAUDE.md rule 8). */
export interface MyAccount {
  id: string;
  status: 'pending' | 'active' | 'paused' | 'closed';
  shop: {
    id: string;
    name: string;
    sub_city: string | null;
    woreda: string | null;
    landmark: string | null;
  };
  customer_detail_view: 'simple' | 'detailed' | null;
  terms_accepted_at: string | null;
  created_at: string;
  head: { seq: number; hash: string };
  balance_santim: number;
}

/** Every account where I am the customer: invites (`pending`) and my dube books. */
export async function listMyAccounts(): Promise<MyAccount[]> {
  const out: MyAccount[] = [];
  let after: string | null = null;
  do {
    const page: { accounts: MyAccount[]; next_after: string | null } = await api(
      'GET',
      `/v1/accounts?role=customer&limit=500${after ? `&after=${after}` : ''}`,
    );
    out.push(...page.accounts);
    after = page.next_after;
  } while (after);
  return out;
}

/** US-02: accept the dube agreement for one shop. Online only. */
export function acceptInvite(accountId: string): Promise<MyAccount> {
  return api('POST', `/v1/accounts/${accountId}/accept`, {
    body: { terms_version: CURRENT_TERMS_VERSION },
  });
}

/** Where a shop is, in its own words (never the merchant's private notes). */
export function shopPlace(shop: MyAccount['shop']): string | undefined {
  return [shop.landmark, shop.woreda, shop.sub_city].filter(Boolean).join(', ') || undefined;
}
