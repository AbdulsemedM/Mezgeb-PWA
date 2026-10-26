import { screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetDeviceForTests } from '../../auth/device-key';
import { resetSessionForTests, restoreSession } from '../../auth/session';
import { resetQueueForTests } from '../../data/queue';
import { kvGet, resetDbForTests } from '../../storage/db';
import { account, limits, shopsApi, signedIn } from '../../test/fixtures';
import { fakeFetch, json, renderApp } from '../../test/render';
import { resetPushForTests } from './push';
import { pathForPush } from './push-path';

const KEY =
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

/** The browser's Notification and PushManager, as a phone that can do Web Push. */
function fakePushBrowser(
  permission: NotificationPermission = 'default',
  answer: NotificationPermission = 'granted',
) {
  const sub = {
    toJSON: () => ({
      endpoint: 'https://fcm.googleapis.com/fcm/send/x',
      keys: { p256dh: 'p', auth: 'a' },
    }),
    unsubscribe: vi.fn(async () => true),
  };
  const pushManager = {
    getSubscription: vi.fn(async () => null),
    subscribe: vi.fn(async () => sub),
  };
  const N = Object.assign(function Notification() {}, {
    permission,
    requestPermission: vi.fn(async () => {
      N.permission = answer;
      return answer;
    }),
  });
  vi.stubGlobal('Notification', N);
  vi.stubGlobal('PushManager', function PushManager() {});
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      ready: Promise.resolve({ pushManager }),
      getRegistration: async () => ({ pushManager }),
      addEventListener: () => undefined,
    },
  });
  return { N, pushManager };
}

describe('W8: notifications and statements', () => {
  beforeEach(async () => {
    await resetDbForTests();
    forgetDeviceForTests();
    resetSessionForTests();
    resetQueueForTests();
    resetPushForTests();
    // jsdom has no object URLs; browsers do.
    URL.createObjectURL = vi.fn(() => 'blob:statement');
    URL.revokeObjectURL = vi.fn();
    await signedIn();
    await restoreSession();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  const api = (extra: Record<string, () => Response> = {}) =>
    fakeFetch({
      ...shopsApi([
        {
          account: account({ id: 'acc-1', created_at: '2026-03-02T07:00:00.000Z' }),
          limits: limits(null),
        },
      ]),
      'GET /v1/devices/web-push-key': () => json(200, { vapid_public_key: KEY }),
      'PUT /v1/devices/me/push-token': () => new Response(null, { status: 204 }),
      ...extra,
    });

  it('a tapped message opens the screen it is about', () => {
    expect(pathForPush({ event: 'purchase_recorded', account_id: 'a' })).toBe('/shops/a');
    expect(pathForPush({ event: 'order_priced', account_id: 'a' })).toBe('/shops/a/orders');
    expect(pathForPush({ event: 'payme_sent', account_id: 'a' })).toBe('/shops/a/pay');
    expect(pathForPush({ event: 'payment_rejected', account_id: 'a' })).toBe('/shops/a/pay');
    expect(pathForPush({ event: 'representative_revoked', account_id: 'a' })).toBe(
      '/shops/a/people',
    );
    expect(pathForPush({ event: 'limit_80', account_id: 'a' })).toBe('/shops/a/limits');
    expect(pathForPush({ event: 'payme_sent' })).toBe('/');
  });

  it('asked after a tap with a plain reason, then the subscription becomes the push token', async () => {
    const { N, pushManager } = fakePushBrowser();
    const calls = api();
    renderApp('/');
    expect(await screen.findByText('Get a message when Abebe Shop adds a purchase')).toBeVisible();
    expect(N.requestPermission).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Turn on messages' }));
    expect(await screen.findByText('Messages are on.')).toBeVisible();
    expect(pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    );
    const put = calls.calls.find((c) => c.path === '/v1/devices/me/push-token')!;
    expect(put.body.token).toMatch(/^webpush:\{"endpoint":"https:\/\/fcm\.googleapis\.com/);
  });

  it('"Not now" hides the card for good', async () => {
    fakePushBrowser();
    api();
    const first = renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: 'Not now' }));
    expect(screen.queryByText(/Get a message when/)).toBeNull();
    await waitFor(async () => expect(await kvGet('push.dismissed')).toBe(true));
    first.unmount();
    renderApp('/');
    await screen.findByText('Abebe Shop');
    expect(screen.queryByText(/Get a message when/)).toBeNull();
  });

  it('no card when the server has no web push, or the browser cannot do it', async () => {
    fakePushBrowser();
    api({ 'GET /v1/devices/web-push-key': () => json(200, { vapid_public_key: null }) });
    renderApp('/');
    await screen.findByText('Abebe Shop');
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText(/Get a message when/)).toBeNull();
  });

  it('Settings says when messages are blocked, calmly', async () => {
    fakePushBrowser('denied');
    api();
    renderApp('/settings');
    expect(await screen.findByText('Turned off in the browser. You still get SMS.')).toBeVisible();
  });

  it('a statement of everything since the dube book started, ready to save', async () => {
    const calls = api({
      'GET /v1/accounts/:id/statement.pdf': () =>
        new Response('%PDF-1.7', { status: 200, headers: { 'content-type': 'application/pdf' } }),
    });
    renderApp('/shops/acc-1');
    await userEvent.click(await screen.findByRole('button', { name: 'Share a statement' }));
    await userEvent.click(screen.getByRole('button', { name: 'Everything' }));
    const save = await screen.findByRole('link', { name: 'Save on this phone' });
    expect(save).toHaveAttribute(
      'download',
      expect.stringMatching(/^Abebe-Shop-2026-03-02-\d{4}-\d\d-\d\d\.pdf$/),
    );
    expect(calls.calls.find((c) => c.path.includes('statement.pdf'))!.path).toMatch(
      /^\/v1\/accounts\/acc-1\/statement\.pdf\?from=2026-03-02&to=\d{4}-\d\d-\d\d$/,
    );
  });

  it('a statement without internet: a calm note and Try again', async () => {
    api();
    renderApp('/shops/acc-1');
    await userEvent.click(await screen.findByRole('button', { name: 'Share a statement' }));
    fakeFetch({});
    await userEvent.click(screen.getByRole('button', { name: 'This month' }));
    expect(
      await screen.findByText('You need internet to make a statement. Connect, then try again.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});
