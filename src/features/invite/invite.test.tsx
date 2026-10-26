import { screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { kvGet, resetDbForTests } from '../../storage/db';
import { fakeFetch, json, renderApp } from '../../test/render';

const invite = (state: string, language = 'am') => ({
  code: 'K7M2P9QX',
  account_id: '0199a000-0000-7000-8000-000000000001',
  shop: { name: 'Abebe Shop' },
  language,
  state,
  expires_at: '2026-11-09T07:00:00.000Z',
});

describe('W2: invite screen (WEB-001 step 2)', () => {
  beforeEach(async () => {
    await resetDbForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the shop's sentence, keeps the code, and continues to install", async () => {
    fakeFetch({ 'GET /v1/invites/:code': () => json(200, invite('open', 'en')) });
    const app = renderApp('/i/k7m2-p9qx');
    expect(
      await screen.findByText('Abebe Shop wants to keep your dube book with you on Mezgeb'),
    ).toBeVisible();
    expect(screen.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'true');
    expect(await kvGet('invite')).toEqual({
      code: 'K7M2P9QX',
      accountId: invite('open').account_id,
      shopName: 'Abebe Shop',
    });
    await userEvent.click(screen.getByRole('link', { name: 'Continue' }));
    expect(app.path()).toBe('/install');
  });

  it("preselects the shop's SMS language", async () => {
    fakeFetch({ 'GET /v1/invites/:code': () => json(200, invite('open', 'am')) });
    renderApp('/i/K7M2P9QX');
    expect(
      await screen.findByText('Abebe Shop የዱቤ ደብተርዎን ከእርስዎ ጋር በመዝገብ ላይ መያዝ ይፈልጋል'),
    ).toBeVisible();
    expect(screen.getByRole('radio', { name: 'አማርኛ' })).toHaveAttribute('aria-checked', 'true');
  });

  it('switching language translates the screen at once', async () => {
    fakeFetch({ 'GET /v1/invites/:code': () => json(200, invite('open', 'am')) });
    renderApp('/i/K7M2P9QX');
    await screen.findByRole('radio', { name: 'English' });
    await userEvent.click(screen.getByRole('radio', { name: 'English' }));
    expect(
      screen.getByText('Abebe Shop wants to keep your dube book with you on Mezgeb'),
    ).toBeVisible();
  });

  it('an expired link still lets the person go on', async () => {
    fakeFetch({ 'GET /v1/invites/:code': () => json(200, invite('expired', 'en')) });
    renderApp('/i/K7M2P9QX');
    expect(await screen.findByText('This invite link is old')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Continue' })).toHaveAttribute('href', '/install');
  });

  it('an accepted invite says so', async () => {
    fakeFetch({ 'GET /v1/invites/:code': () => json(200, invite('accepted', 'en')) });
    renderApp('/i/K7M2P9QX');
    expect((await screen.findAllByText('You already joined Abebe Shop')).length).toBeGreaterThan(0);
  });

  it('an unknown code explains what to do and offers support, not a dead end', async () => {
    fakeFetch({ 'GET /v1/invites/:code': () => json(404, { code: 'invite_not_found' }) });
    renderApp('/i/ZZZZZZZZ');
    expect((await screen.findAllByText('This link does not work')).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Call Mezgeb support' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Continue' })).toBeVisible();
  });

  it('a malformed code never calls the server', async () => {
    const api = fakeFetch({});
    renderApp('/i/not-a-code');
    expect((await screen.findAllByText('This link does not work')).length).toBeGreaterThan(0);
    expect(api.calls).toHaveLength(0);
  });

  it('offline is calm, with a retry; a code seen before still shows its shop', async () => {
    fakeFetch({});
    renderApp('/i/K7M2P9QX');
    const calm = await screen.findByText('No internet. Connect, then open the link again.');
    expect(calm.closest('[role="status"]')).not.toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();

    // Online once, then offline again: the cached invite shows.
    const online = fakeFetch({ 'GET /v1/invites/:code': () => json(200, invite('open', 'en')) });
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Abebe Shop wants to keep your dube book with you on Mezgeb');
    expect(online.calls).toHaveLength(1);

    fakeFetch({});
    const again = renderApp('/i/K7M2P9QX');
    await waitFor(() =>
      expect(
        again.getAllByText('No internet. Showing what was saved on this phone.')[0],
      ).toBeVisible(),
    );
  });
});
