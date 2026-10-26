import { normalizeInviteCode } from '@shared/invite-code';
import { api, ApiError } from '../../api/client';
import type { Language } from '../../i18n';
import { cacheGet, cacheSet, kvGet, kvSet } from '../../storage/db';

/** `GET /v1/invites/{code}` (backend ADR-016): what the invite screen shows before sign-in. */
export interface Invite {
  code: string;
  account_id: string;
  shop: { name: string };
  language: Language;
  state: 'open' | 'expired' | 'accepted' | 'closed';
  expires_at: string;
}

/** The last invite opened in this browser, to preselect its shop after sign-in (WEB-001). */
export interface SavedInvite {
  code: string;
  accountId: string;
  shopName: string;
}

export type InviteLookup =
  | { kind: 'found'; invite: Invite; fromCache: boolean }
  | { kind: 'not-found' }
  | { kind: 'offline' };

/** Resolves a code from the link. Offline, a code opened before still shows its shop. */
export async function lookUpInvite(rawCode: string): Promise<InviteLookup> {
  const code = normalizeInviteCode(rawCode);
  if (!code) return { kind: 'not-found' };
  try {
    const invite = await api<Invite>('GET', `/v1/invites/${code}`, { auth: false });
    await Promise.all([
      cacheSet(`invite:${code}`, invite),
      kvSet('invite', {
        code,
        accountId: invite.account_id,
        shopName: invite.shop.name,
      } satisfies SavedInvite),
    ]);
    return { kind: 'found', invite, fromCache: false };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return { kind: 'not-found' };
    if (err instanceof ApiError) throw err;
    const cached = await cacheGet<Invite>(`invite:${code}`);
    return cached ? { kind: 'found', invite: cached.data, fromCache: true } : { kind: 'offline' };
  }
}

export function savedInvite(): Promise<SavedInvite | undefined> {
  return kvGet<SavedInvite>('invite');
}
