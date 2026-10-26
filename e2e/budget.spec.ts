import { expect, test } from '@playwright/test';

/**
 * WEB-001 budget: the first meaningful screen in under 5 s on Chrome's "Slow 3G" profile
 * (2 s latency, 400 kbps), with a 4× slower CPU for a low-end phone. Cold: nothing cached.
 */
test('first screen under 5 s on Slow 3G, cold', async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 2000,
    downloadThroughput: (400 * 1000) / 8,
    uploadThroughput: (400 * 1000) / 8,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  const started = Date.now();
  await page.goto('/i/K7M2P9QX', { waitUntil: 'commit' });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
  const ms = Date.now() - started;
  console.log(`first screen on Slow 3G: ${ms} ms`);
  expect(ms).toBeLessThan(5000);
});
