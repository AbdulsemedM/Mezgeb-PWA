import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/**
 * W9: the Content-Security-Policy the build writes to dist/csp.txt (docs/deployment.md) must
 * let the inline app script run: served with that exact header, the app renders and the
 * browser reports no violation.
 */
test('the app runs under the CSP from dist/csp.txt', async ({ page }) => {
  const csp = readFileSync(new URL('../dist/csp.txt', import.meta.url), 'utf8').trim();
  expect(csp).toMatch(/script-src 'self' 'sha256-[A-Za-z0-9+/]+=*'/);

  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const res = await route.fetch();
    await route.fulfill({
      response: res,
      headers: { ...res.headers(), 'content-security-policy': csp },
    });
  });
  const violations: string[] = [];
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
  });

  await page.goto('/start');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(violations).toEqual([]);
});
