import type { Page, Route } from '@playwright/test';

type Handler = (body: any, route: Route, url: URL) => { status?: number; body?: unknown } | void;

/**
 * Fakes the API for a page: `'GET /v1/invites/:code'` → handler. Unmatched calls get a 404
 * `not_found`, like the real API. Returns the calls made, for assertions.
 */
export async function fakeApi(page: Page, routes: Record<string, Handler>) {
  const calls: { method: string; path: string; body: any }[] = [];
  const compiled = Object.entries(routes).map(([key, handler]) => {
    const [method, pattern] = key.split(' ') as [string, string];
    return { method, re: new RegExp(`^${pattern.replace(/:[a-z_]+/gi, '[^/]+')}$`), handler };
  });
  await page.route('**/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const body = req.postData() ? JSON.parse(req.postData()!) : undefined;
    calls.push({ method: req.method(), path: url.pathname + url.search, body });
    const match = compiled.find((r) => r.method === req.method() && r.re.test(url.pathname));
    if (!match) {
      await route.fulfill({ status: 404, json: { code: 'not_found', message: 'Not found' } });
      return;
    }
    const res = match.handler(body, route, url) ?? {};
    await route.fulfill({ status: res.status ?? 200, json: res.body ?? {} });
  });
  return calls;
}

export const INVITE = {
  code: 'K7M2P9QX',
  account_id: '0199a000-0000-7000-8000-000000000001',
  shop: { name: 'Abebe Shop' },
  language: 'en',
  state: 'open',
  expires_at: '2026-11-09T07:00:00.000Z',
};

/** Chrome's install prompt, as a test double the page can capture. */
export async function fireInstallPrompt(page: Page, outcome: 'accepted' | 'dismissed') {
  await page.evaluate((o) => {
    const e = new Event('beforeinstallprompt') as Event & Record<string, unknown>;
    e.prompt = async () => {
      (window as unknown as Record<string, unknown>).__prompted = true;
    };
    e.userChoice = Promise.resolve({ outcome: o });
    window.dispatchEvent(e);
  }, outcome);
}
