import { type Page, expect, test } from '@playwright/test';
import { expectBigTapTargets, expectNoSidewaysOverflow, setTextScale } from './checks';
import { fakeApi } from './fake-api';
import { seedSession, shopRoutes } from './session';

/** A signed-in phone with one shop: the faked API, then the saved session. */
async function signedInBook(page: Page) {
  await fakeApi(page, shopRoutes());
  await seedSession(page);
}

test.describe('W4: the dube book', () => {
  test('home → book → entry, readable at 200% with big tap targets', async ({ page }) => {
    await signedInBook(page);
    await page.goto('/');
    const card = page.getByRole('link', { name: /Abebe Shop/ });
    await expect(card).toContainText('ETB 850.00');
    await expect(card.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      '85% of the limit used',
    );
    await expect(card).toContainText('Pay by 15 Nov 2026');
    await expectBigTapTargets(page);
    await setTextScale(page, 200);
    await expectNoSidewaysOverflow(page);

    await card.click();
    await expect(page.getByRole('heading', { level: 1, name: 'Abebe Shop' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Purchase/ })).toContainText('Taken by you');
    await expectBigTapTargets(page);
    await setTextScale(page, 200);
    await expectNoSidewaysOverflow(page);

    await page.getByRole('link', { name: /Purchase/ }).click();
    await expect(page.getByText('Teff')).toBeVisible();
  });

  test('offline after a visit: the saved book with "Last updated"', async ({ page, context }) => {
    await signedInBook(page);
    await page.goto('/shops/acc-1');
    await expect(page.getByRole('link', { name: /Purchase/ })).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready);
    // The faked API would still answer: make every call fail like a dropped connection.
    await page.unrouteAll();
    await page.route('**/v1/**', (route) => route.abort('internetdisconnected'));
    await context.setOffline(true);
    await page.reload();
    await expect(
      page.getByText('No internet. Showing what was saved on this phone.'),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Purchase/ })).toBeVisible();
    await context.setOffline(false);
  });

  test('W5–W7: action screens at 200% with big tap targets', async ({ page }) => {
    await signedInBook(page);
    for (const [path, ready] of [
      ['/shops/acc-1/limits', 'Save my limit'],
      ['/shops/acc-1/people', 'Add a person'],
      ['/shops/acc-1/people/new', 'Add this person'],
      ['/shops/acc-1/orders', 'New order'],
      ['/shops/acc-1/orders/new', 'Send the list to the shop'],
      ['/shops/acc-1/entries/e-1/dispute', 'Send to the shop'],
    ] as const) {
      await page.goto(path);
      await expect(
        page.getByRole('button', { name: ready }).or(page.getByRole('link', { name: ready })),
      ).toBeVisible();
      await expectBigTapTargets(page);
      await setTextScale(page, 200);
      await expectNoSidewaysOverflow(page);
    }
  });
});
