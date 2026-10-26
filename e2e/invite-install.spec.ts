import { expect, test } from '@playwright/test';
import { expectBigTapTargets, expectNoSidewaysOverflow, setTextScale } from './checks';
import { fakeApi, fireInstallPrompt, INVITE } from './fake-api';

test.describe('W2: invite and install (WEB-001 steps 1–4)', () => {
  test('SMS link → shop sentence → install with one tap → open it from the home screen', async ({
    page,
  }) => {
    await fakeApi(page, { 'GET /v1/invites/:code': () => ({ body: INVITE }) });
    await page.goto('/i/K7M2P9QX');
    await expect(
      page.getByText('Abebe Shop wants to keep your dube book with you on Nota'),
    ).toBeVisible();
    await expectBigTapTargets(page);

    await page.getByRole('link', { name: 'Continue' }).click();
    await expect(page).toHaveURL(/\/install$/);
    await fireInstallPrompt(page, 'accepted');
    await page.getByRole('button', { name: 'Put Nota on my home screen' }).click();
    await expect(page.getByText('Open it from there.')).toBeVisible();
    expect(await page.evaluate(() => (window as any).__prompted)).toBe(true);
  });

  test('no prompt from Chrome: "Getting ready…", then the picture guide; never stuck', async ({
    page,
  }) => {
    await fakeApi(page, { 'GET /v1/invites/:code': () => ({ body: INVITE }) });
    await page.goto('/i/K7M2P9QX');
    await page.getByRole('link', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Put Nota on my home screen' }).click();
    await expect(page.getByRole('button', { name: 'Getting ready…' })).toBeVisible();
    await expect(page.getByText('Use the browser menu')).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('link', { name: 'Continue in the browser' })).toBeVisible();
    await expectBigTapTargets(page);
  });

  test('the invite and install screens work at 200% text', async ({ page }) => {
    await fakeApi(page, { 'GET /v1/invites/:code': () => ({ body: INVITE }) });
    await page.goto('/i/K7M2P9QX');
    await page.getByText('Abebe Shop wants').waitFor();
    await setTextScale(page, 200);
    await expectNoSidewaysOverflow(page);
    await page.getByRole('link', { name: 'Continue' }).click();
    await setTextScale(page, 200);
    await expectNoSidewaysOverflow(page);
    await expectBigTapTargets(page);
  });

  test('Telegram in-app browser gets "Open in Chrome"', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Linux; Android 12; TECNO KG5p; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 Telegram-Android/11.2.3',
      viewport: { width: 360, height: 740 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await fakeApi(page, { 'GET /v1/invites/:code': () => ({ body: INVITE }) });
    await page.goto('/install');
    await expect(page.getByRole('link', { name: 'Open in Chrome' })).toHaveAttribute(
      'href',
      /^intent:\/\/127\.0\.0\.1:4173\/install#Intent;scheme=http;package=com\.android\.chrome;/,
    );
    await context.close();
  });

  test('serves assetlinks.json for Android App Links', async ({ request }) => {
    const res = await request.get('/.well-known/assetlinks.json');
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });
});
