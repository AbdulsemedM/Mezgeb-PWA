import { derToP1363 } from '@shared/ecdsa';
import { webRefreshSigningInput } from '@shared/session';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, OfflineError } from '../api/client';
import { kvGet, resetDbForTests } from '../storage/db';
import { forgetDeviceForTests } from './device-key';
import { resetSessionForTests, restoreSession, sessionState, signOut, verifyCode } from './session';

const user = { id: 'u1', phone: '+251911000001', name: null, language: 'am', calendar_pref: null };

/** A tiny fake API: records calls, checks refresh signatures against the registered key. */
function fakeApi() {
  const calls: { method: string; path: string; body: any; headers: Record<string, string> }[] = [];
  let publicKey: CryptoKey | null = null;
  let refreshId = 'r-1';
  let accessN = 0;
  let expired = new Set<string>();
  let refreshResult: 'ok' | 'revoked' | 'offline' = 'ok';

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const tokens = () => {
    accessN += 1;
    return {
      access_token: `a-${accessN}`,
      access_expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      refresh_id: refreshId,
      refresh_expires_at: new Date(Date.now() + 60 * 86_400_000).toISOString(),
    };
  };

  const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
    const path = new URL(url, 'http://x').pathname;
    const headers = (init.headers ?? {}) as Record<string, string>;
    const body = init.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ method: init.method ?? 'GET', path, body, headers });
    expect(init.credentials).toBe('include');

    if (path === '/v1/auth/verify') {
      const spki = Uint8Array.from(atob(body.device.public_key), (c) => c.charCodeAt(0));
      publicKey = await crypto.subtle.importKey(
        'spki',
        spki,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify'],
      );
      expect(body.session).toBe('cookie');
      return json(200, { ...tokens(), user, is_new_user: true });
    }
    if (path === '/v1/auth/web/refresh') {
      if (refreshResult === 'offline') throw new TypeError('Failed to fetch');
      if (refreshResult === 'revoked') return json(401, { code: 'device_revoked' });
      const der = Uint8Array.from(atob(body.device_sig), (c) => c.charCodeAt(0));
      const ok = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        publicKey!,
        new Uint8Array(derToP1363(der)),
        new TextEncoder().encode(webRefreshSigningInput(refreshId)),
      );
      if (!ok) return json(401, { code: 'refresh_invalid' });
      refreshId = `r-${Number(refreshId.slice(2)) + 1}`;
      return json(200, tokens());
    }
    if (path === '/v1/auth/logout') return new Response(null, { status: 204 });
    if (path === '/v1/me') {
      const token = headers.authorization?.slice('Bearer '.length) ?? '';
      if (expired.has(token)) return json(401, { code: 'token_expired' });
      return json(200, user);
    }
    return json(404, { code: 'not_found' });
  });

  return {
    calls,
    fetchImpl,
    expire: (token: string) => expired.add(token),
    reset: () => (expired = new Set()),
    setRefresh: (r: typeof refreshResult) => (refreshResult = r),
  };
}

describe('session (ADR-016 cookie + signature)', () => {
  let server: ReturnType<typeof fakeApi>;

  beforeEach(async () => {
    await resetDbForTests();
    forgetDeviceForTests();
    resetSessionForTests();
    server = fakeApi();
    vi.stubGlobal('fetch', server.fetchImpl);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('signs in with the device key and keeps no refresh token in storage', async () => {
    await verifyCode('0911000001', '123456');
    expect(sessionState()).toEqual({ status: 'signed-in', user });
    const saved = await kvGet<Record<string, unknown>>('session');
    expect(saved).toEqual({ refreshId: 'r-1', user });
    expect(JSON.stringify(saved)).not.toMatch(/refresh_token/);
    const verify = server.calls.find((c) => c.path === '/v1/auth/verify')!;
    expect(verify.body.device.label).toBe('Nota web');
  });

  it('uses the access token, and renews it with a valid signature on token_expired', async () => {
    await verifyCode('0911000001', '123456');
    server.expire('a-1');
    await expect(api('GET', '/v1/me')).resolves.toEqual(user);
    const refresh = server.calls.filter((c) => c.path === '/v1/auth/web/refresh');
    expect(refresh).toHaveLength(1);
    expect(server.calls.at(-1)!.headers.authorization).toBe('Bearer a-2');
    expect((await kvGet<{ refreshId: string }>('session'))!.refreshId).toBe('r-2');
  });

  it('restores a saved session after a restart and renews on first use', async () => {
    await verifyCode('0911000001', '123456');
    resetSessionForTests();
    expect((await restoreSession()).status).toBe('signed-in');
    await api('GET', '/v1/me');
    expect(server.calls.filter((c) => c.path === '/v1/auth/web/refresh')).toHaveLength(1);
  });

  it('one renewal for parallel requests', async () => {
    await verifyCode('0911000001', '123456');
    resetSessionForTests();
    await restoreSession();
    await Promise.all([api('GET', '/v1/me'), api('GET', '/v1/me'), api('GET', '/v1/me')]);
    expect(server.calls.filter((c) => c.path === '/v1/auth/web/refresh')).toHaveLength(1);
  });

  it('a refused refresh signs out and removes personal data', async () => {
    await verifyCode('0911000001', '123456');
    server.expire('a-1');
    server.setRefresh('revoked');
    await expect(api('GET', '/v1/me')).rejects.toMatchObject({ status: 401 });
    expect(sessionState()).toEqual({ status: 'signed-out' });
    expect(await kvGet('session')).toBeUndefined();
    // The device key stays: signing in again reuses it.
    expect(await kvGet('device')).toBeDefined();
  });

  it('no internet during refresh keeps the session', async () => {
    await verifyCode('0911000001', '123456');
    server.expire('a-1');
    server.setRefresh('offline');
    await expect(api('GET', '/v1/me')).rejects.toBeInstanceOf(OfflineError);
    expect(sessionState().status).toBe('signed-in');
  });

  it('sign out clears the session even offline', async () => {
    await verifyCode('0911000001', '123456');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await signOut();
    expect(sessionState()).toEqual({ status: 'signed-out' });
  });
});
