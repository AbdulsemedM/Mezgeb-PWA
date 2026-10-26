import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { fakeApi, INVITE } from './fake-api';
import { seedSession, shopRoutes } from './session';

/**
 * W9 accessibility pass (MOB-002 §8, WEB-001: Lighthouse accessibility ≥ 95): axe on every
 * screen, light and dark, English and Amharic. TalkBack with real people is still needed.
 */
const SCREENS: string[] = [
  '/start',
  '/i/K7M2P9QX',
  '/install',
  '/installed',
  '/signin',
  '/',
  '/shops/acc-1',
  '/shops/acc-1/entries/e-1',
  '/shops/acc-1/limits',
  '/shops/acc-1/people',
  '/shops/acc-1/people/new',
  '/shops/acc-1/pay',
  '/shops/acc-1/orders',
  '/shops/acc-1/orders/new',
  '/shops/acc-1/entries/e-1/dispute',
  '/settings',
];

async function audit(page: Page, path: string) {
  await page.goto(path);
  await page.getByRole('heading', { level: 1 }).waitFor();
  // Let cached data and the network answer settle before judging the page.
  await page.waitForLoadState('networkidle');
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  return result.violations.map(
    (v) =>
      `${path} ${v.id} (${v.impact}): ${v.nodes
        .map((n) => n.target.join(' '))
        .slice(0, 3)
        .join(', ')}`,
  );
}

for (const scheme of ['light', 'dark'] as const) {
  for (const language of ['en', 'am'] as const) {
    test(`axe: every screen, ${scheme}, ${language}`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.emulateMedia({ colorScheme: scheme });
      await fakeApi(page, {
        ...shopRoutes(),
        'GET /v1/invites/:code': () => ({ body: { ...INVITE, language } }),
        'GET /v1/devices/web-push-key': () => ({ body: { vapid_public_key: null } }),
      });
      await seedSession(page);
      await page.evaluate((l) => localStorage.setItem('mezgeb.language', l), language);
      const problems: string[] = [];
      for (const path of SCREENS) {
        // Signed-out screens: no session for these.
        if (['/start', '/signin'].includes(path)) continue;
        problems.push(...(await audit(page, path)));
      }
      expect(problems).toEqual([]);
    });
  }
}

test('axe: signed-out screens', async ({ page }) => {
  await fakeApi(page, {});
  const problems: string[] = [];
  for (const path of ['/start', '/signin']) problems.push(...(await audit(page, path)));
  expect(problems).toEqual([]);
});
