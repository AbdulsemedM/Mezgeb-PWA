import { expect, test } from '@playwright/test';
import { expectBigTapTargets, expectNoSidewaysOverflow, setTextScale } from './checks';

test.describe('W1: installable shell', () => {
  test('loads with a manifest, icons and a service worker', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBeTruthy();
    const manifest = await (await page.request.get(manifestHref!)).json();
    expect(manifest).toMatchObject({
      name: 'Mezgeb',
      start_url: '/',
      scope: '/',
      display: 'standalone',
    });
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(
      expect.arrayContaining(['192x192', '512x512']),
    );

    const sw = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return reg.active?.scriptURL ?? null;
    });
    expect(sw).toMatch(/\/sw\.js$/);
  });

  test('opens offline after the first visit', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.goto('/i/K7M2P9QX');
    await expect(page.locator('#root')).not.toBeEmpty();
    await context.setOffline(false);
  });

  test('big tap targets, and no sideways scrolling at 200% text', async ({ page }) => {
    await page.goto('/');
    await expectBigTapTargets(page);
    await setTextScale(page, 200);
    await expectNoSidewaysOverflow(page);
    await expectBigTapTargets(page);
  });

  test('preloads the subset Ethiopic font and uses it for Amharic', async ({ page }) => {
    const font = page.waitForResponse((r) => r.url().endsWith('noto-sans-ethiopic-400.woff2'));
    await page.goto('/');
    expect((await font).status()).toBe(200);
    await page.getByRole('radio', { name: 'አማርኛ' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'am');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ቋንቋ ይምረጡ');
  });
});
