import { screen, waitFor, within } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetDeviceForTests } from '../../auth/device-key';
import { resetSessionForTests, restoreSession } from '../../auth/session';
import { queuedWrites, resetQueueForTests } from '../../data/queue';
import { resetDbForTests } from '../../storage/db';
import { account, limits, rep, shopsApi, signedIn } from '../../test/fixtures';
import { fakeFetch, json, renderApp } from '../../test/render';

async function tap(
  name: string | RegExp,
  role: 'button' | 'radio' | 'checkbox' | 'link' = 'button',
) {
  await userEvent.click(await screen.findByRole(role, { name }));
}

async function typeOnPad(keys: string) {
  const dialog = await screen.findByRole('dialog');
  for (const k of keys) await userEvent.click(within(dialog).getByRole('button', { name: k }));
}

describe('W5: limits, people and one-time raises', () => {
  beforeEach(async () => {
    await resetDbForTests();
    forgetDeviceForTests();
    resetSessionForTests();
    resetQueueForTests();
    await signedIn();
    await restoreSession();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const book = (over: Partial<Parameters<typeof shopsApi>[0][number]> = {}) => ({
    account: account({ id: 'acc-1', balance_santim: 30_000 }),
    limits: limits(100_000),
    ...over,
  });

  it('US-07: set an amount, a month to pay back and "ask me first"', async () => {
    const api = fakeFetch({
      ...shopsApi([book()]),
      'PUT /v1/accounts/:id/limits/customer': () => json(200, {}),
    });
    const app = renderApp('/shops/acc-1/limits');
    expect(await screen.findByText('ETB 1,000.00')).toBeVisible(); // the shop's limit
    await tap(/No amount limit/);
    await typeOnPad('500');
    await tap('Done');
    await tap('1 month', 'radio');
    await tap(/Ask me before selling over my limit/, 'checkbox');
    await tap('Save my limit');

    await waitFor(() => expect(app.path()).toBe('/shops/acc-1'));
    await waitFor(() => expect(api.calls.some((c) => c.method === 'PUT')).toBe(true));
    expect(api.calls.find((c) => c.method === 'PUT')).toMatchObject({
      path: '/v1/accounts/acc-1/limits/customer',
      body: { value: 50_000, period: { type: 'monthly' }, mode: 'hard_stop' },
    });
  });

  it('asking first needs an amount; nothing set is refused in plain words', async () => {
    fakeFetch(shopsApi([book()]));
    renderApp('/shops/acc-1/limits');
    await screen.findByText('ETB 1,000.00');
    expect(screen.getByText('To be asked first, set the most you may owe.')).toBeVisible();
    await tap('Save my limit');
    expect(screen.getByRole('alert')).toHaveTextContent('Set an amount, a time, or both.');
  });

  it('a custom number of days', async () => {
    const api = fakeFetch({
      ...shopsApi([book()]),
      'PUT /v1/accounts/:id/limits/customer': () => json(200, {}),
    });
    renderApp('/shops/acc-1/limits');
    await screen.findByText('ETB 1,000.00');
    await tap('Another number of days', 'radio');
    await typeOnPad('10');
    await tap('Done');
    expect(screen.getByRole('radio', { name: '10 days' })).toHaveAttribute('aria-checked', 'true');
    await tap('Save my limit');
    await waitFor(() =>
      expect(api.calls.find((c) => c.method === 'PUT')?.body).toEqual({
        value: null,
        period: { type: 'custom_days', days: 10 },
        mode: 'alert',
      }),
    );
  });

  it('offline: the limit is saved on the phone and shown as not sent yet', async () => {
    const routes = shopsApi([book()]);
    fakeFetch(routes);
    const first = renderApp('/shops/acc-1/limits');
    await screen.findByText('ETB 1,000.00');
    first.unmount();

    // The book is cached; now the internet is gone.
    fakeFetch({});
    renderApp('/shops/acc-1/limits');
    await tap('1 week', 'radio');
    await tap('Save my limit');
    expect(
      await screen.findByText('Saved on this phone. Will send when internet returns.'),
    ).toBeVisible();
    expect(await queuedWrites()).toHaveLength(1);
  });

  it('REP-1: add a person with a monthly limit and a PIN (sent with a client id)', async () => {
    const api = fakeFetch({
      ...shopsApi([book()]),
      'POST /v1/accounts/:id/representatives': () => json(201, {}),
    });
    const app = renderApp('/shops/acc-1/people/new');
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Selam');
    await tap('House help', 'radio');
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Their phone number (optional)' }),
      '0911 22 33 55',
    );
    await tap('Send them an SMS for each purchase', 'checkbox');
    await tap(/Their own limit each month/);
    await typeOnPad('300');
    await tap('Done');
    await tap(/A 4-number PIN/);
    await typeOnPad('1234');
    await tap('Done');
    await tap('Add this person');

    await waitFor(() => expect(app.path()).toBe('/shops/acc-1/people'));
    await waitFor(() =>
      expect(
        api.calls.some((c) => c.path.endsWith('/representatives') && c.method === 'POST'),
      ).toBe(true),
    );
    const sent = api.calls.find(
      (c) => c.method === 'POST' && c.path.endsWith('/representatives'),
    )!.body;
    expect(sent).toMatchObject({
      name: 'Selam',
      relationship: 'maid',
      phone: '+251911223355',
      sms_receipt: true,
      limit: { value: 30_000, period: { type: 'monthly' } },
      pin: '1234',
    });
    expect(sent.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('a person needs a name; an SMS needs a phone', async () => {
    fakeFetch(shopsApi([book()]));
    renderApp('/shops/acc-1/people/new');
    await tap('Send them an SMS for each purchase', 'checkbox');
    await tap('Add this person');
    expect(screen.getByText('Write their name.')).toBeVisible();
    expect(screen.getByText('An SMS needs their phone number.')).toBeVisible();
  });

  it('REP-3: pause and remove (with a confirmation)', async () => {
    const api = fakeFetch({
      ...shopsApi([book({ reps: [rep({ id: 'r-1', name: 'Selam' })] })]),
      'POST /v1/representatives/:id/status': () => json(200, {}),
    });
    renderApp('/shops/acc-1/people');
    expect(await screen.findByText('Selam')).toBeVisible();
    await tap('Pause');
    await waitFor(() =>
      expect(api.calls.find((c) => c.path === '/v1/representatives/r-1/status')?.body).toEqual({
        status: 'paused',
      }),
    );
    expect(await screen.findByText('Selam is paused.')).toBeVisible();

    await tap('Remove');
    expect(
      screen.getByRole('heading', { name: 'Remove Selam? They can no longer take goods for you.' }),
    ).toBeVisible();
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }),
    );
    await waitFor(() =>
      expect(
        api.calls.filter((c) => c.path === '/v1/representatives/r-1/status').at(-1)?.body,
      ).toEqual({
        status: 'revoked',
      }),
    );
  });

  it('LIM-3: the customer approves a waiting raise without a code', async () => {
    const raise = {
      id: 'raise-1',
      account_id: 'acc-1',
      amount: 2_000,
      status: 'pending' as const,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      valid_until: null,
    };
    const api = fakeFetch({
      ...shopsApi([book({ raises: [raise] })]),
      'POST /v1/accounts/:id/raises/:rid/approve': () =>
        json(200, { ...raise, status: 'approved' }),
    });
    renderApp('/');
    expect(
      await screen.findByText('Abebe Shop asks to write ETB 20.00 more than your limit, once.'),
    ).toBeVisible();
    await tap('Approve once');
    expect(await screen.findByText('Approved. Abebe Shop can write it now.')).toBeVisible();
    expect(api.calls.find((c) => c.path.endsWith('/approve'))).toMatchObject({
      path: '/v1/accounts/acc-1/raises/raise-1/approve',
      body: {},
    });
  });

  it('LIM-3: approving needs internet, said calmly; an ended request is not shown', async () => {
    const live = {
      id: 'raise-1',
      account_id: 'acc-1',
      amount: 2_000,
      status: 'pending' as const,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      valid_until: null,
    };
    const ended = { ...live, id: 'raise-0', expires_at: new Date(Date.now() - 1000).toISOString() };
    const routes = shopsApi([book({ raises: [live, ended] })]);
    fakeFetch(routes);
    renderApp('/shops/acc-1');
    expect(await screen.findAllByText(/asks to write ETB 20.00/)).toHaveLength(1);
    fakeFetch({});
    await tap('Approve once');
    expect(
      await screen.findByText('You need internet for this. Connect, then try again.'),
    ).toBeVisible();
  });
});
