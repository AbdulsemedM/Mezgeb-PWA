import { screen, waitFor, within } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetDeviceForTests } from '../../auth/device-key';
import { resetSessionForTests, restoreSession } from '../../auth/session';
import type { Dispute, Order } from '../../data/book';
import { resetQueueForTests } from '../../data/queue';
import { resetDbForTests } from '../../storage/db';
import { account, limits, purchase, shopsApi, signedIn } from '../../test/fixtures';
import { fakeFetch, json, renderApp } from '../../test/render';

const order = (over: Partial<Order> = {}): Order => ({
  id: 'o-1',
  account_id: 'acc-1',
  lines: [{ name: 'Bread', qty: '2' }],
  address_note: null,
  preferred_time: null,
  status: 'sent',
  decline_reason: null,
  delivery_person: null,
  delivered_entry_id: null,
  receipt_confirmed_at: null,
  created_at: '2026-10-21T07:00:00.000Z',
  updated_at: '2026-10-21T07:00:00.000Z',
  ...over,
});

describe('W7: orders (US-12) and disputes (US-13), customer side', () => {
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

  const shop = (over: Partial<Parameters<typeof shopsApi>[0][number]> = {}) => ({
    account: account({ id: 'acc-1' }),
    limits: limits(null),
    catalogue: [
      { id: 'i-1', name: 'Bread', unit: null },
      { id: 'i-2', name: 'Sugar', unit: 'kg' },
    ],
    ...over,
  });

  it('US-12: pick items with − / +, add something else, where and when; sent with a client id', async () => {
    const api = fakeFetch({
      ...shopsApi([shop()]),
      'POST /v1/accounts/:id/orders': () => json(201, order()),
    });
    const app = renderApp('/shops/acc-1/orders/new');
    await userEvent.click(await screen.findByRole('button', { name: /Bread/ }));
    await userEvent.click(screen.getByRole('button', { name: /Sugar/ }));
    const list = screen.getByRole('heading', { name: 'Your list' }).closest('section')!;
    await userEvent.click(within(list).getByRole('button', { name: 'More Bread' }));
    await userEvent.click(within(list).getByRole('button', { name: 'More Bread' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Something else' }), 'Tomato paste');
    await userEvent.click(screen.getByRole('button', { name: 'Add to the list' }));
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Where to bring it (optional)' }),
      'Block 12, floor 4',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Before 8 pm' }));
    await userEvent.click(screen.getByRole('button', { name: 'Send the list to the shop' }));

    await waitFor(() => expect(app.path()).toBe('/shops/acc-1/orders'));
    await waitFor(() =>
      expect(api.calls.some((c) => c.method === 'POST' && c.path.endsWith('/orders'))).toBe(true),
    );
    const sent = api.calls.find((c) => c.method === 'POST' && c.path.endsWith('/orders'))!.body;
    expect(sent.lines).toEqual([
      { name: 'Bread', qty: '3', item_id: 'i-1' },
      { name: 'Sugar', qty: '1', unit: 'kg', item_id: 'i-2' },
      { name: 'Tomato paste', qty: '1' },
    ]);
    expect(sent).toMatchObject({
      address_note: 'Block 12, floor 4',
      preferred_time: 'Before 8 pm',
    });
    expect(sent.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('an empty list is refused in plain words; less to zero removes a line', async () => {
    fakeFetch(shopsApi([shop()]));
    renderApp('/shops/acc-1/orders/new');
    await userEvent.click(await screen.findByRole('button', { name: /Bread/ }));
    const list = screen.getByRole('heading', { name: 'Your list' }).closest('section')!;
    await userEvent.click(within(list).getByRole('button', { name: 'Less Bread' }));
    expect(within(list).getByText('Your list is empty.')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Send the list to the shop' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Add at least one thing to the list.');
  });

  it('follow an order: priced list with what is out of stock, then received', async () => {
    const api = fakeFetch({
      ...shopsApi([
        shop({
          orders: [
            order({
              status: 'delivered',
              delivery_person: 'Dawit',
              lines: [
                { name: 'Bread', qty: '2', unit_price: 1_000, amount: 2_000 },
                {
                  name: 'Oil',
                  qty: '1',
                  unit: 'litre',
                  unit_price: 25_000,
                  amount: 0,
                  unavailable: true,
                },
              ],
            }),
          ],
        }),
      ]),
      'POST /v1/orders/:id/receipt': () => json(200, {}),
    });
    renderApp('/shops/acc-1/orders');
    expect(await screen.findByText('Delivered')).toBeVisible();
    expect(screen.getByText('Not in stock')).toBeVisible();
    expect(screen.getByText('Total ETB 20.00')).toBeVisible();
    expect(screen.getByText('Brought by Dawit')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'I received everything' }));
    await waitFor(() =>
      expect(api.calls.find((c) => c.path === '/v1/orders/o-1/receipt')?.body).toEqual({}),
    );
  });

  it('ORD-4: something missing is sent with what is missing', async () => {
    const api = fakeFetch({
      ...shopsApi([shop({ orders: [order({ status: 'delivered' })] })]),
      'POST /v1/orders/:id/receipt': () => json(200, {}),
    });
    renderApp('/shops/acc-1/orders');
    await userEvent.click(await screen.findByRole('button', { name: 'Something is missing' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'What is missing?' }),
      'One bread',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tell the shop' }));
    await waitFor(() =>
      expect(api.calls.find((c) => c.path === '/v1/orders/o-1/receipt')?.body).toEqual({
        missing: 'One bread',
      }),
    );
  });

  it('a declined order shows the reason', async () => {
    fakeFetch(
      shopsApi([shop({ orders: [order({ status: 'declined', decline_reason: 'Closed today' })] })]),
    );
    renderApp('/shops/acc-1/orders');
    expect(await screen.findByText('The shop says: Closed today')).toBeVisible();
  });

  it('US-13: dispute a purchase with a reason chip and a note; the entry stays', async () => {
    const api = fakeFetch({
      ...shopsApi([shop({ entries: [purchase({ id: 'e-9' })] })]),
      'POST /v1/entries/:id/disputes': () => json(201, {}),
    });
    const app = renderApp('/shops/acc-1/entries/e-9');
    await userEvent.click(
      await screen.findByRole('link', { name: 'Something wrong with this purchase?' }),
    );
    await userEvent.click(await screen.findByRole('radio', { name: 'We did not take this' }));
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Tell the shop more (optional)' }),
      'No bread',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Send to the shop' }));
    await waitFor(() => expect(app.path()).toBe('/shops/acc-1/entries/e-9'));
    await waitFor(() =>
      expect(api.calls.find((c) => c.path === '/v1/entries/e-9/disputes')?.body).toMatchObject({
        reason: 'We did not take this: No bread',
      }),
    );
  });

  it('a dispute shows waiting, then the shop’s answer; no second dispute while open', async () => {
    const open: Dispute = {
      id: 'd-1',
      entry_id: 'e-9',
      reason: 'The amount is wrong',
      status: 'open',
      resolution_entry_id: null,
      resolution_note: null,
      resolved_at: null,
      created_at: '2026-10-21T07:00:00.000Z',
    };
    fakeFetch(shopsApi([shop({ entries: [purchase({ id: 'e-9' })], disputes: [open] })]));
    const first = renderApp('/shops/acc-1/entries/e-9');
    expect(await screen.findByText('Waiting for the shop')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Something wrong with this purchase?' })).toBeNull();
    first.unmount();

    fakeFetch(
      shopsApi([
        shop({
          entries: [purchase({ id: 'e-9' })],
          disputes: [
            { ...open, status: 'resolved', resolution_note: 'We checked: two breads were taken.' },
          ],
        }),
      ]),
    );
    renderApp('/shops/acc-1/entries/e-9');
    expect(
      await screen.findByText('The shop says: We checked: two breads were taken.'),
    ).toBeVisible();
    expect(screen.getByText('The shop answered')).toBeVisible();
  });
});
