import { deflateSync } from 'node:zlib';
import { expect, test } from '@playwright/test';
import { expectBigTapTargets, expectNoSidewaysOverflow, setTextScale } from './checks';
import { fakeApi } from './fake-api';
import { seedSession, shopRoutes } from './session';

/** A big, noisy photo like a phone camera makes: 3000×2000 PNG, well over the 600 KB limit. */
function bigPhoto(): Buffer {
  const w = 3000;
  const h = 2000;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  let x = 12345;
  for (let i = 0; i < raw.length; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    raw[i] = i % (w * 3 + 1) === 0 ? 0 : (x >> 16) & 0xff;
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 1 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

test('W6: "I paid" with a receipt photo shrunk on the phone, sent after the report', async ({
  page,
}) => {
  const order: string[] = [];
  await fakeApi(page, {
    ...shopRoutes(),
    'POST /v1/accounts/:id/payment-reports': (body) => {
      order.push(`report ${body.id}`);
      return { status: 201, body: { ...body, status: 'reported', has_receipt: false } };
    },
  });
  await seedSession(page);
  let receipt: { type: string | null; bytes: number; path: string } | null = null;
  await page.route('**/v1/payment-reports/*/receipt', async (route) => {
    const req = route.request();
    receipt = {
      type: await req.headerValue('content-type'),
      bytes: req.postDataBuffer()?.length ?? 0,
      path: new URL(req.url()).pathname,
    };
    order.push(`receipt ${receipt.path}`);
    await route.fulfill({ status: 200, json: { has_receipt: true } });
  });

  await page.goto('/shops/acc-1/pay');
  await page.getByRole('radio', { name: 'telebirr' }).click();
  await expectBigTapTargets(page);

  const photo = bigPhoto();
  expect(photo.length).toBeGreaterThan(1_000_000);
  await page
    .getByTestId('receipt-input')
    .setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: photo });
  await expect(page.getByRole('img', { name: 'Your receipt photo' })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('button', { name: 'Tell the shop I paid' }).click();
  await expect(page.getByText('Sent. Abebe Shop will check and confirm.')).toBeVisible();

  await expect.poll(() => receipt, { timeout: 10_000 }).not.toBeNull();
  expect(receipt!.type).toBe('image/jpeg');
  expect(receipt!.bytes).toBeGreaterThan(1_000);
  expect(receipt!.bytes).toBeLessThanOrEqual(600 * 1024);
  const reportId = order[0]!.split(' ')[1];
  expect(order).toEqual([`report ${reportId}`, `receipt /v1/payment-reports/${reportId}/receipt`]);
});

test('W6: the pay screen at 200% text', async ({ page }) => {
  await fakeApi(page, shopRoutes());
  await seedSession(page);
  await page.goto('/shops/acc-1/pay');
  await page.getByRole('radio', { name: 'telebirr' }).waitFor();
  await setTextScale(page, 200);
  await expectNoSidewaysOverflow(page);
});
