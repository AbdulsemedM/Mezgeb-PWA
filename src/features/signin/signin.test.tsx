import { screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { CURRENT_TERMS_VERSION } from '@shared/terms';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetDeviceForTests } from '../../auth/device-key';
import { resetSessionForTests, restoreSession } from '../../auth/session';
import { kvSet, resetDbForTests } from '../../storage/db';
import { fakeFetch, json, renderApp } from '../../test/render';

const USER = {
  id: 'u1',
  phone: '+251911223344',
  name: null,
  language: 'en',
  calendar_pref: null as string | null,
};

const account = (id: string, shop: string, status = 'pending') => ({
  id,
  status,
  shop: { id: `m-${id}`, name: shop, sub_city: 'Bole', woreda: null, landmark: null },
  customer_detail_view: null,
  terms_accepted_at: null,
  created_at: '2026-10-20T07:00:00.000Z',
  head: { seq: 0, hash: '0'.repeat(64) },
  balance_santim: 0,
});

const tokens = {
  access_token: 'a-1',
  access_expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
  refresh_id: 'r-1',
  refresh_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
};

/** A server holding one person and their accounts; records what the PWA sends. */
function server(opts: { calendar?: string | null; accounts?: ReturnType<typeof account>[] } = {}) {
  const user = { ...USER, calendar_pref: opts.calendar ?? null };
  const accounts = opts.accounts ?? [account('acc-1', 'Abebe Shop')];
  return fakeFetch({
    'POST /v1/auth/otp': () => json(202, { expires_at: '', resend_after_s: 60 }),
    'POST /v1/auth/verify': ({ body }) =>
      body.code === '123456'
        ? json(200, { ...tokens, user, is_new_user: true })
        : json(401, { code: 'otp_invalid', details: { attempts_left: 4 } }),
    'POST /v1/auth/web/refresh': () => json(200, tokens),
    'PATCH /v1/me': ({ body }) => {
      Object.assign(user, body);
      return json(200, user);
    },
    'GET /v1/accounts': () => json(200, { accounts, next_after: null }),
    'POST /v1/accounts/:id/accept': ({ path, body }) => {
      const a = accounts.find((x) => path.includes(x.id))!;
      if (body.terms_version !== CURRENT_TERMS_VERSION)
        return json(409, { code: 'terms_outdated' });
      a.status = 'active';
      return json(200, a);
    },
  });
}

async function typeOnPad(keys: string) {
  for (const k of keys) await userEvent.click(screen.getByRole('button', { name: k }));
}

describe('W3: sign-in, calendar, terms and pending invites (US-02)', () => {
  beforeEach(async () => {
    await resetDbForTests();
    forgetDeviceForTests();
    resetSessionForTests();
    await restoreSession();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('US-02 on iPhone: no stored invite code, the server lists the pending invite', async () => {
    const api = server();
    const app = renderApp('/signin');
    await typeOnPad('0911223344');
    expect(
      screen.getByRole('status', { name: 'Phone number 0 9 1 1 2 2 3 3 4 4' }),
    ).toHaveTextContent('09 11 22 33 44');
    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText('We sent a 6-digit code to 09 11 22 33 44.')).toBeVisible();
    expect(api.calls.find((c) => c.path === '/v1/auth/otp')!.body).toEqual({
      phone: '+251911223344',
      language: 'en',
    });

    // The sixth digit sends the code.
    await typeOnPad('123456');
    expect(
      await screen.findByRole('heading', { name: 'Which calendar do you use?' }),
    ).toBeVisible();
    const verify = api.calls.find((c) => c.path === '/v1/auth/verify')!;
    expect(verify.body.session).toBe('cookie');
    expect(verify.body.device.public_key).toMatch(/^MF/);

    await userEvent.click(screen.getByRole('radio', { name: /Ethiopian calendar/ }));
    expect(await screen.findByRole('heading', { name: 'Shops that invited you' })).toBeVisible();
    expect(api.calls.find((c) => c.method === 'PATCH')!.body).toEqual({
      calendar_pref: 'ethiopian',
    });

    await userEvent.click(await screen.findByRole('link', { name: /Abebe Shop/ }));
    expect(await screen.findByText('Your dube book with Abebe Shop')).toBeVisible();
    expect(screen.getByText('Nota never adds interest or fees.')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'I agree' }));

    expect(await screen.findByText('Done. Your dube book with Abebe Shop is open.')).toBeVisible();
    await waitFor(() => expect(app.path()).toBe('/'));
    const accept = api.calls.find((c) => c.path.endsWith('/accept'))!;
    expect(accept.body).toEqual({ terms_version: CURRENT_TERMS_VERSION });
  });

  it('shows the calendar choice with today in each calendar', async () => {
    server();
    renderApp('/signin');
    await typeOnPad('0911223344');
    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await screen.findByText(/We sent a 6-digit code/);
    await typeOnPad('123456');
    await screen.findByRole('heading', { name: 'Which calendar do you use?' });
    const tiles = screen.getAllByRole('radio');
    expect(tiles[0]).toHaveTextContent(/Today: \d+ \w+ 20\d\d/);
    expect(tiles[1]).toHaveTextContent(/Today: \d+ \w{3} 20\d\d/);
  });

  it('a wrong code says how many tries are left and clears the boxes', async () => {
    server();
    renderApp('/signin');
    await typeOnPad('0911223344');
    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await screen.findByText(/We sent a 6-digit code/);
    await typeOnPad('111111');
    expect(await screen.findByRole('alert')).toHaveTextContent('The code is wrong. 4 tries left.');
    expect(screen.getByRole('status', { name: 'Code: 0 of 6 numbers typed' })).toBeInTheDocument();
  });

  it('a number that is not Ethiopian mobile is refused before sending', async () => {
    const api = server();
    renderApp('/signin');
    await typeOnPad('0111234567');
    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));
    expect(screen.getByRole('alert')).toHaveTextContent('It starts with 09 or 07.');
    expect(api.calls).toHaveLength(0);
  });

  it('no internet while sending the code is calm, not an error', async () => {
    fakeFetch({});
    renderApp('/signin');
    await typeOnPad('0911223344');
    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));
    expect(
      await screen.findByText('You need internet to sign in. Connect, then try again.'),
    ).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('too many codes: says when to try again', async () => {
    fakeFetch({
      'POST /v1/auth/otp': () =>
        json(429, { code: 'otp_rate_limited', details: { retry_after_s: 125 } }),
    });
    renderApp('/signin');
    await typeOnPad('0911223344');
    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many codes asked. Try again in 3 minutes.',
    );
  });

  it('a revoked device key is replaced and the same code signs in', async () => {
    let n = 0;
    fakeFetch({
      'POST /v1/auth/otp': () => json(202, { expires_at: '', resend_after_s: 60 }),
      'POST /v1/auth/verify': () =>
        ++n === 1
          ? json(403, { code: 'device_revoked' })
          : json(200, {
              ...tokens,
              user: { ...USER, calendar_pref: 'gregorian' },
              is_new_user: false,
            }),
      'GET /v1/accounts': () => json(200, { accounts: [], next_after: null }),
    });
    renderApp('/signin');
    await typeOnPad('0911223344');
    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await screen.findByText(/We sent a 6-digit code/);
    await typeOnPad('123456');
    expect(await screen.findByText('No shop has invited this number yet.')).toBeVisible();
    expect(n).toBe(2);
  });

  it('the invite opened in this browser comes first', async () => {
    server({
      calendar: 'gregorian',
      accounts: [account('acc-1', 'Abebe Shop'), account('acc-2', 'Tigist Mini Market')],
    });
    await kvSet('invite', { code: 'K7M2P9QX', accountId: 'acc-2', shopName: 'Tigist Mini Market' });
    await kvSet('session', { refreshId: 'r-1', user: { ...USER, calendar_pref: 'gregorian' } });
    resetSessionForTests();
    await restoreSession();
    renderApp('/invites');
    const tiles = await screen.findAllByRole('link');
    expect(tiles[0]).toHaveTextContent('Tigist Mini Market');
    expect(tiles[1]).toHaveTextContent('Abebe Shop');
  });

  it('no invite for this number: the number, Refresh, and "wrong number?" help', async () => {
    server({ calendar: 'gregorian', accounts: [] });
    await kvSet('session', { refreshId: 'r-1', user: { ...USER, calendar_pref: 'gregorian' } });
    resetSessionForTests();
    await restoreSession();
    renderApp('/invites');
    expect(
      await screen.findByText('Ask the shop to add 09 11 22 33 44 in Nota. Then tap Refresh.'),
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Wrong number?' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sign in with another number' })).toBeVisible();
  });

  it('signed out, the book sends people to the language choice', async () => {
    const app = renderApp('/');
    await waitFor(() => expect(app.path()).toBe('/start'));
  });
});
