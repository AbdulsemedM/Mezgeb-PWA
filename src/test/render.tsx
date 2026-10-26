import { render } from '@testing-library/preact';
import { useEffect } from 'react';
import { MemoryRouter, useLocation } from '../app/router';
import { vi } from 'vitest';
import { AppRoutes } from '../app/App';
import { I18nProvider, type Language } from '../i18n';
import { SuccessFeedbackProvider } from '../ui';

const probe = { path: '' };

function LocationProbe() {
  const { pathname } = useLocation();
  useEffect(() => {
    probe.path = pathname;
  }, [pathname]);
  return null;
}

/** Renders the whole app at `path` (MemoryRouter), in English unless asked. */
export function renderApp(path: string, language: Language = 'en') {
  const result = render(
    <I18nProvider language={language}>
      <SuccessFeedbackProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
          <LocationProbe />
        </MemoryRouter>
      </SuccessFeedbackProvider>
    </I18nProvider>,
  );
  return { ...result, path: () => probe.path };
}

type Handler = (req: { method: string; path: string; body: any }) => Response | Promise<Response>;

/** A JSON response like the API's. */
export function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Replaces fetch with routes like `'GET /v1/invites/:code'`. Unmatched calls fail the way a
 * phone without internet does.
 */
export function fakeFetch(routes: Record<string, Handler>) {
  const calls: { method: string; path: string; body: any }[] = [];
  const compiled = Object.entries(routes).map(([key, handler]) => {
    const [method, pattern] = key.split(' ') as [string, string];
    const re = new RegExp(`^${pattern.replace(/:[a-z_]+/gi, '[^/]+')}$`);
    return { method, re, handler };
  });
  const fn = vi.fn(async (url: string, init: RequestInit = {}) => {
    const u = new URL(url, 'http://localhost');
    const method = init.method ?? 'GET';
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
    const req = { method, path: u.pathname + u.search, body };
    calls.push(req);
    const route = compiled.find((r) => r.method === method && r.re.test(u.pathname));
    if (!route) throw new TypeError('Failed to fetch');
    return route.handler(req);
  });
  vi.stubGlobal('fetch', fn);
  return { calls, fn };
}
