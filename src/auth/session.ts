import { webRefreshSigningInput } from '@shared/session';
import { api, ApiError, OfflineError, setTokenSource } from '../api/client';
import type { Language } from '../i18n';
import type { CalendarPref } from '../lib/dates';
import { clearPersonalData, kvGet, kvSet } from '../storage/db';
import { type Device, getDevice, replaceDevice, signText } from './device-key';

export interface User {
  id: string;
  phone: string;
  name: string | null;
  language: Language;
  calendar_pref: CalendarPref | null;
}

/** What survives a restart. Not secret: the refresh token itself is in the httpOnly cookie. */
interface StoredSession {
  refreshId: string;
  user: User;
}

interface TokenResponse {
  access_token: string;
  access_expires_at: string;
  refresh_id: string;
  refresh_expires_at: string;
}

interface VerifyResponse extends TokenResponse {
  user: User;
  is_new_user: boolean;
}

export type SessionState =
  { status: 'loading' } | { status: 'signed-out' } | { status: 'signed-in'; user: User };

type Listener = (state: SessionState) => void;

const KEY = 'session';
/** Renew a little before expiry so a request never races the 15-minute access token. */
const EARLY_MS = 30_000;

let state: SessionState = { status: 'loading' };
let access: { token: string; expiresAt: number } | null = null;
let renewing: Promise<string | null> | null = null;
const listeners = new Set<Listener>();

export function sessionState(): SessionState {
  return state;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setState(next: SessionState): void {
  state = next;
  for (const l of listeners) l(next);
}

/** On start: signed in if a session was saved; the access token comes on first use. */
export async function restoreSession(): Promise<SessionState> {
  const saved = await kvGet<StoredSession>(KEY);
  setState(saved ? { status: 'signed-in', user: saved.user } : { status: 'signed-out' });
  return state;
}

/** Step 1 of sign-in: an SMS code. Throws ApiError (`invalid_phone`, `otp_rate_limited`). */
export async function requestCode(
  phone: string,
  language: Language,
): Promise<{ expires_at: string; resend_after_s: number }> {
  return api('POST', '/v1/auth/otp', { body: { phone, language }, auth: false });
}

/** Step 2: verify the code; registers this browser's device key and sets the refresh cookie. */
export async function verifyCode(
  phone: string,
  code: string,
): Promise<{ user: User; isNewUser: boolean }> {
  const send = async (device: Device) =>
    api<VerifyResponse>('POST', '/v1/auth/verify', {
      auth: false,
      body: {
        phone,
        code,
        device: { id: device.id, public_key: device.publicKey, label: 'Nota web' },
        session: 'cookie',
      },
    });
  let res: VerifyResponse;
  try {
    res = await send(await getDevice());
  } catch (err) {
    // A revoked device, or one registered to another person: the server rolled the whole
    // sign-in back (OTP included), so the same code works with a fresh device key.
    if (err instanceof ApiError && ['device_revoked', 'device_conflict'].includes(err.code)) {
      res = await send(await replaceDevice());
    } else {
      throw err;
    }
  }
  access = { token: res.access_token, expiresAt: Date.parse(res.access_expires_at) };
  await kvSet(KEY, { refreshId: res.refresh_id, user: res.user } satisfies StoredSession);
  setState({ status: 'signed-in', user: res.user });
  return { user: res.user, isNewUser: res.is_new_user };
}

/** Keep the saved user in step with `/v1/me` changes (language, calendar). */
export async function updateStoredUser(user: User): Promise<void> {
  const saved = await kvGet<StoredSession>(KEY);
  if (!saved) return;
  await kvSet(KEY, { ...saved, user } satisfies StoredSession);
  setState({ status: 'signed-in', user });
}

/** `PATCH /v1/me`: language and calendar follow the person to the SMS and the app. */
export async function updateMe(
  patch: Partial<Pick<User, 'language' | 'calendar_pref' | 'name'>>,
): Promise<User> {
  const user = await api<User>('PATCH', '/v1/me', { body: patch });
  await updateStoredUser(user);
  return user;
}

export async function signOut(): Promise<void> {
  try {
    await api('POST', '/v1/auth/logout');
  } catch {
    // Offline or already signed out: the local data goes anyway.
  }
  await endSession();
}

async function endSession(): Promise<void> {
  access = null;
  await clearPersonalData();
  setState({ status: 'signed-out' });
}

async function currentToken(): Promise<string | null> {
  if (state.status !== 'signed-in') return null;
  if (access && access.expiresAt - EARLY_MS > Date.now()) return access.token;
  return renew();
}

/**
 * ADR-016 refresh: the cookie carries the token; we sign its `refresh_id`. One refresh at a
 * time across tabs (Web Locks), always with the newest `refresh_id` saved by any tab.
 */
function renew(): Promise<string | null> {
  renewing ??= withLock(async () => {
    const saved = await kvGet<StoredSession>(KEY);
    if (!saved) return null;
    const device = await getDevice();
    try {
      const res = await api<TokenResponse>('POST', '/v1/auth/web/refresh', {
        auth: false,
        body: {
          device_id: device.id,
          device_sig: await signText(device, webRefreshSigningInput(saved.refreshId)),
        },
      });
      access = { token: res.access_token, expiresAt: Date.parse(res.access_expires_at) };
      await kvSet(KEY, { ...saved, refreshId: res.refresh_id } satisfies StoredSession);
      return res.access_token;
    } catch (err) {
      if (err instanceof OfflineError) throw err;
      if (err instanceof ApiError && err.status === 401) {
        await endSession();
        return null;
      }
      throw err;
    }
  }).finally(() => {
    renewing = null;
  });
  return renewing;
}

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  return locks ? (locks.request('mezgeb-refresh', fn) as Promise<T>) : fn();
}

setTokenSource({ accessToken: currentToken, renew });

/** Tests only. */
export function resetSessionForTests(): void {
  state = { status: 'loading' };
  access = null;
  renewing = null;
  listeners.clear();
}
