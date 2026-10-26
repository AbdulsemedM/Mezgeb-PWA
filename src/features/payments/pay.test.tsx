import { screen, waitFor, within } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetDeviceForTests } from '../../auth/device-key';
import { resetSessionForTests, restoreSession } from '../../auth/session';
import type { PaymentReport } from '../../data/book';
import { queuedWrites, resetQueueForTests } from '../../data/queue';
import { cacheGet, resetDbForTests } from '../../storage/db';
import { account, limits, payme, shopsApi, signedIn } from '../../test/fixtures';
import { fakeFetch, json, renderApp } from '../../test/render';
import { resetMarkSeenForTests } from './use-mark-seen';

const report = (over: Partial<PaymentReport> = {}): PaymentReport => ({
  id: 'rep-1',
  account_id: 'acc-1',
  amount: 50_000,
  method: 'telebirr',
  reference: 'TB9X01',
  status: 'reported',
  reject_reason: null,
  entry_id: null,
  resubmitted_from_id: null,
  reviewed_at: null,
  created_at: '2026-10-21T07:00:00.000Z',
  has_receipt: false,
  ...over,
});

describe('W6: payments (US-10, customer side)', () => {
  beforeEach(async () => {
    await resetDbForTests();
    forgetDeviceForTests();
    resetSessionForTests();
    resetQueueForTests();
    resetMarkSeenForTests();
    await signedIn();
    await restoreSession();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const shop = (over: Partial<Parameters<typeof shopsApi>[0][number]> = {}) => ({
    account: account({ id: 'acc-1', balance_santim: 80_000 }),
    limits: limits(null),
    ...over,
  });

  it('answering a pay-me request: amount prefilled, method, transaction number, sent with a client id', async () => {
    const api = fakeFetch({
      ...shopsApi([shop({ payme: [payme({ status: 'seen' })] })]),
      'POST /v1/accounts/:id/payment-reports': () => json(201, report()),
    });
    const app = renderApp('/shops/acc-1/pay?payme=p-1');
    expect(await screen.findByText('telebirr 0911 000 000')).toBeVisible();
    expect(screen.getByRole('img', { name: '500 birr' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'telebirr' }));
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Transaction number (optional)' }),
      'TB9X01',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Tell the shop I paid' }));

    await waitFor(() => expect(app.path()).toBe('/shops/acc-1'));
    await waitFor(() =>
      expect(
        api.calls.some((c) => c.path.endsWith('/payment-reports') && c.method === 'POST'),
      ).toBe(true),
    );
    const sent = api.calls.find(
      (c) => c.method === 'POST' && c.path.endsWith('/payment-reports'),
    )!.body;
    expect(sent).toMatchObject({ amount: 50_000, method: 'telebirr', reference: 'TB9X01' });
    expect(sent.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await screen.findByText('Sent. Abebe Shop will check and confirm.')).toBeVisible();
  });

  it('nothing chosen: says what is missing; cash needs no transaction number', async () => {
    fakeFetch(shopsApi([shop({ account: account({ id: 'acc-1', balance_santim: 0 }) })]));
    renderApp('/shops/acc-1/pay');
    await screen.findByRole('radio', { name: 'Cash' });
    await userEvent.click(screen.getByRole('button', { name: 'Tell the shop I paid' }));
    expect(screen.getByText('Type the amount you paid.')).toBeVisible();
    expect(screen.getByText('Choose how you paid.')).toBeVisible();
    await userEvent.click(screen.getByRole('radio', { name: 'Cash' }));
    expect(screen.queryByRole('textbox', { name: 'Transaction number (optional)' })).toBeNull();
  });

  it('offline: the report waits on the phone and shows as not sent yet', async () => {
    fakeFetch(shopsApi([shop()]));
    const first = renderApp('/shops/acc-1/pay');
    await waitFor(async () => expect(await cacheGet('book:acc-1')).toBeDefined());
    first.unmount();
    fakeFetch({});
    renderApp('/shops/acc-1/pay');
    await userEvent.click(await screen.findByRole('radio', { name: 'Cash' }));
    await userEvent.click(screen.getByRole('button', { name: 'Tell the shop I paid' }));
    expect(
      await screen.findByText('Saved on this phone. Will send when internet returns.'),
    ).toBeVisible();
    expect((await queuedWrites()).map((w) => w.kind)).toEqual(['report.create']);
  });

  it('statuses: waiting, confirmed, and not accepted with the reason and "Send again"', async () => {
    fakeFetch(
      shopsApi([
        shop({
          reports: [
            report({ id: 'r-a', status: 'confirmed', created_at: '2026-10-19T07:00:00.000Z' }),
            report({
              id: 'r-b',
              status: 'rejected',
              reject_reason: 'No such telebirr payment',
              created_at: '2026-10-20T07:00:00.000Z',
            }),
            report({ id: 'r-c', status: 'reported', has_receipt: true }),
          ],
        }),
      ]),
    );
    renderApp('/shops/acc-1');
    const list = (
      await screen.findByRole('heading', { name: 'Payments you told the shop about' })
    ).closest('section')!;
    const items = within(list).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Waiting for the shop');
    expect(items[0]).toHaveTextContent('Photo attached');
    expect(items[1]).toHaveTextContent('Not accepted');
    expect(items[1]).toHaveTextContent('The shop says: No such telebirr payment');
    expect(within(items[1]!).getByRole('link', { name: 'Send again' })).toHaveAttribute(
      'href',
      '/shops/acc-1/pay?again=r-b',
    );
    expect(items[2]).toHaveTextContent('Confirmed');
  });

  it('sending again points at the rejected report', async () => {
    const api = fakeFetch({
      ...shopsApi([
        shop({
          reports: [
            report({
              id: 'r-b',
              status: 'rejected',
              reject_reason: 'Wrong amount',
              amount: 40_000,
            }),
          ],
        }),
      ]),
      'POST /v1/accounts/:id/payment-reports': () => json(201, report()),
    });
    renderApp('/shops/acc-1/pay?again=r-b');
    expect(await screen.findByText('Sending again: ETB 400.00 by telebirr')).toBeVisible();
    expect(screen.getByRole('radio', { name: 'telebirr' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Tell the shop I paid' }));
    await waitFor(() =>
      expect(
        api.calls.find((c) => c.method === 'POST' && c.path.endsWith('/payment-reports'))?.body,
      ).toMatchObject({
        amount: 40_000,
        method: 'telebirr',
        resubmitted_from_id: 'r-b',
      }),
    );
  });

  it('a pay-me request on screen is marked seen, once', async () => {
    const api = fakeFetch({
      ...shopsApi([shop({ payme: [payme({ status: 'sent' })] })]),
      'POST /v1/payme-requests/:id/seen': () => json(200, payme({ status: 'seen' })),
    });
    renderApp('/');
    expect(await screen.findByRole('link', { name: 'I paid' })).toHaveAttribute(
      'href',
      '/shops/acc-1/pay?payme=p-1',
    );
    await waitFor(() =>
      expect(api.calls.filter((c) => c.path === '/v1/payme-requests/p-1/seen')).toHaveLength(1),
    );
  });
});
