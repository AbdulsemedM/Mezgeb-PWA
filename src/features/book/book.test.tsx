import { screen, waitFor, within } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetDeviceForTests } from '../../auth/device-key';
import { resetSessionForTests, restoreSession } from '../../auth/session';
import { cacheGet, resetDbForTests } from '../../storage/db';
import { account, limits, payme, purchase, rep, shopsApi, signedIn } from '../../test/fixtures';
import { fakeFetch, renderApp } from '../../test/render';

const shop = (over: Parameters<typeof shopsApi>[0][number]) => over;

describe('W4: the dube book (read)', () => {
  beforeEach(async () => {
    await resetDbForTests();
    forgetDeviceForTests();
    resetSessionForTests();
    await signedIn();
    await restoreSession();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('home lists each shop with balance, limit usage in words, and the due date', async () => {
    fakeFetch(
      shopsApi([
        shop({
          account: account({ id: 'acc-1', balance_santim: 85_000 }),
          limits: limits(100_000, { state: 'due_soon', due: '2026-10-30' }),
        }),
        shop({
          account: account({
            id: 'acc-2',
            balance_santim: 0,
            shop: { id: 'm2', name: 'Lomi Pharmacy', sub_city: null, woreda: null, landmark: null },
          }),
          limits: limits(null),
        }),
      ]),
    );
    renderApp('/');
    const abebe = (await screen.findByText('Abebe Shop')).closest('a')!;
    expect(within(abebe).getByRole('img', { name: '850 birr' })).toHaveTextContent('ETB 850.00');
    expect(within(abebe).getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      '85% of the limit used',
    );
    expect(within(abebe).getByText('Limit ETB 1,000.00')).toBeVisible();
    expect(within(abebe).getByText('Pay by 30 Oct 2026')).toBeVisible();
    expect(within(abebe).getByText('Due soon')).toBeVisible();
    const lomi = screen.getByText('Lomi Pharmacy').closest('a')!;
    expect(within(lomi).getByText('No limit set')).toBeVisible();
  });

  it('home shows pending invites and pay-me requests first', async () => {
    fakeFetch(
      shopsApi([
        shop({
          account: account({ id: 'acc-1', balance_santim: 50_000 }),
          limits: limits(null),
          payme: [payme()],
        }),
        shop({
          account: account({
            id: 'acc-9',
            status: 'pending',
            shop: {
              id: 'm9',
              name: 'Tigist Mini Market',
              sub_city: null,
              woreda: null,
              landmark: null,
            },
          }),
          limits: limits(null),
        }),
      ]),
    );
    renderApp('/');
    expect(await screen.findByText('A shop invited you.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'See the invite' })).toHaveAttribute(
      'href',
      '/invites',
    );
    expect(screen.getByText('Abebe Shop asks you to pay ETB 500.00')).toBeVisible();
    expect(screen.getByText('How to pay: telebirr 0911 000 000')).toBeVisible();
  });

  it('the book shows entries newest first, who took them, payments as credit', async () => {
    const selam = rep({ id: 'r-1', name: 'Selam' });
    fakeFetch(
      shopsApi([
        shop({
          account: account({ id: 'acc-1', balance_santim: 7_000 }),
          limits: limits(null),
          reps: [selam],
          entries: [
            purchase({ recorded_at: '2026-10-18T07:00:00.000Z' }),
            purchase({
              taken_by_type: 'representative',
              representative_id: 'r-1',
              recorded_at: '2026-10-19T07:00:00.000Z',
              lines: [
                {
                  line_no: 1,
                  name: 'Oil',
                  qty: '1',
                  unit: 'l',
                  unit_price: 5_000,
                  amount: 5_000,
                  source: 'manual',
                },
              ],
              amount: 5_000,
            }),
            {
              ...purchase({ recorded_at: '2026-10-20T07:00:00.000Z' }),
              type: 'payment',
              amount: 10_000,
              lines: [],
              taken_by_type: null,
              payment_method: 'telebirr',
            },
          ],
        }),
      ]),
    );
    renderApp('/shops/acc-1');
    const rows = await screen.findAllByRole('link', { name: /Purchase|Payment/ });
    expect(rows[0]).toHaveTextContent('Payment');
    expect(rows[0]).toHaveTextContent('Paid with telebirr');
    expect(within(rows[0]!).getByRole('img', { name: 'minus 100 birr' })).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent('Taken by Selam');
    expect(rows[2]).toHaveTextContent('Taken by you');
    expect(rows[2]).toHaveTextContent('Sugar and 1 more');
  });

  it('Detailed shows each item; the filter shows one person', async () => {
    const api = fakeFetch(
      shopsApi([
        shop({
          account: account({ id: 'acc-1' }),
          limits: limits(null),
          reps: [rep({ id: 'r-1', name: 'Selam' })],
          entries: [
            purchase(),
            purchase({ taken_by_type: 'representative', representative_id: 'r-1' }),
          ],
        }),
      ]),
    );
    renderApp('/shops/acc-1');
    await screen.findAllByRole('link', { name: /Purchase/ });
    await userEvent.click(screen.getByRole('radio', { name: 'Detailed' }));
    expect(screen.getAllByText('(2 kg × ETB 50.00)')[0]).toBeVisible();
    expect(api.calls.find((c) => c.method === 'PATCH')!.body).toEqual({
      customer_detail_view: 'detailed',
    });

    await userEvent.click(screen.getByRole('button', { name: 'Selam' }));
    const rows = screen.getAllByRole('link', { name: /Purchase/ });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Taken by Selam');
  });

  it('offline: the saved book shows with "Last updated", calmly, with Refresh', async () => {
    fakeFetch(
      shopsApi([
        shop({
          account: account({ id: 'acc-1', balance_santim: 12_000 }),
          limits: limits(null),
          entries: [purchase()],
        }),
      ]),
    );
    const first = renderApp('/shops/acc-1');
    await screen.findAllByRole('link', { name: /Purchase/ });
    await waitFor(async () => expect(await cacheGet('book:acc-1')).toBeDefined());
    first.unmount();

    fakeFetch({});
    renderApp('/shops/acc-1');
    expect(
      await screen.findByText('No internet. Showing what was saved on this phone.'),
    ).toBeVisible();
    expect(screen.getAllByText(/Last updated \d\d:\d\d/)[0]).toBeVisible();
    expect(screen.getAllByRole('link', { name: /Purchase/ })).toHaveLength(1);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Refresh' }).length).toBeGreaterThan(0);
  });

  it('offline with nothing saved: a calm note and Try again', async () => {
    fakeFetch({});
    renderApp('/shops/acc-1');
    expect(
      await screen.findByText('You need internet for this. Connect, then try again.'),
    ).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('an entry shows its items, who took it, and what a correction corrects', async () => {
    const original = purchase({ id: 'e-orig', recorded_at: '2026-10-18T07:00:00.000Z' });
    fakeFetch(
      shopsApi([
        shop({
          account: account({ id: 'acc-1' }),
          limits: limits(null),
          entries: [
            original,
            {
              ...purchase({ id: 'e-cor' }),
              type: 'correction',
              amount: -2_000,
              lines: [],
              ref_entry_id: 'e-orig',
              reason: 'Bread was not taken',
            },
          ],
        }),
      ]),
    );
    renderApp('/shops/acc-1/entries/e-cor');
    expect(await screen.findByRole('heading', { name: 'Correction' })).toBeVisible();
    expect(screen.getByText('Reason: Bread was not taken')).toBeVisible();
    expect(screen.getByText('Corrects the purchase of 18 Oct 2026')).toBeVisible();
    expect(screen.getByRole('img', { name: 'minus 20 birr' })).toBeInTheDocument();
  });
});
