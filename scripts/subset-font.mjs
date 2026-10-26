// Subsets Noto Sans Ethiopic to the Ethiopic block as woff2 (WEB-001 budget: a small,
// preloaded, self-hosted font). Source: the Flutter app's bundled TTFs.
// Usage: pnpm font:subset [path/to/mobile/assets/fonts]
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import subsetFont from 'subset-font';

const src =
  process.argv[2] ??
  new URL('../../mobile/assets/fonts', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const out = new URL('../public/fonts/', import.meta.url);

// The Ethiopic characters of the app's own Amharic text (src/i18n/am.ts) and the Ethiopian
// month names. Names people type use any syllable: those fall back to the phone's system
// Ethiopic font (Android ships Noto Sans Ethiopic). Re-run after changing am.ts.
const am = await readFile(new URL('../src/i18n/am.ts', import.meta.url), 'utf8');
const months = await readFile(
  new URL('../src/shared/calendar/ethiopian.ts', import.meta.url),
  'utf8',
);
const chars = new Set(' 0123456789.,:;!?()-');
for (const ch of am + months) {
  const cp = ch.codePointAt(0);
  if (cp >= 0x1200 && cp <= 0x139f) chars.add(ch);
}
const text = [...chars].join('');
console.log(`${chars.size} characters`);
// src/i18n/font-subset.test.ts checks am.ts against this list.
await writeFile(new URL('font-subset.txt', import.meta.url), [...chars].sort().join(''));

for (const [weight, file] of [
  [400, 'NotoSansEthiopic-Regular.ttf'],
  [700, 'NotoSansEthiopic-Bold.ttf'],
]) {
  const ttf = await readFile(join(src, file));
  const woff2 = await subsetFont(ttf, text, { targetFormat: 'woff2' });
  await writeFile(new URL(`noto-sans-ethiopic-${weight}.woff2`, out), woff2);
  console.log(`noto-sans-ethiopic-${weight}.woff2: ${(woff2.length / 1024).toFixed(1)} KB`);
}
