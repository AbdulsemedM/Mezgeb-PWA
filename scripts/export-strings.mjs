// Writes docs/i18n-review.csv for the native-speaker review (W9): every string in English,
// Amharic and Afaan Oromoo, marked "app" when the Flutter app's ARB files use the same key (its
// text was drafted and reviewed there) and "pwa" when it is new here.
// Usage: pnpm strings:export [path/to/mobile]
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const mobile =
  process.argv[2] ?? new URL('../../mobile', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const dir = await mkdtemp(join(tmpdir(), 'nota-strings-'));

async function load(lang) {
  const src = await readFile(new URL(`../src/i18n/${lang}.ts`, import.meta.url), 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext },
  }).outputText;
  const file = join(dir, `${lang}.mjs`);
  await writeFile(file, js);
  return (await import(pathToFileURL(file).href))[lang];
}

const [en, am, om] = await Promise.all(['en', 'am', 'om'].map(load));
await rm(dir, { recursive: true, force: true });

const arb = join(mobile, 'lib/l10n/app_en.arb');
const appKeys = existsSync(arb)
  ? new Set(Object.keys(JSON.parse(await readFile(arb, 'utf8'))).filter((k) => !k.startsWith('@')))
  : new Set();

const cell = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
const rows = [['key', 'source', 'en', 'am', 'om', 'am OK?', 'om OK?', 'notes'].map(cell).join(',')];
for (const key of Object.keys(en)) {
  rows.push(
    [key, appKeys.has(key) ? 'app' : 'pwa', en[key], am[key], om[key], '', '', '']
      .map(cell)
      .join(','),
  );
}
const out = new URL('../docs/i18n-review.csv', import.meta.url);
// A byte-order mark so spreadsheet apps open the Ethiopic text as UTF-8.
await writeFile(out, `${String.fromCharCode(0xfeff)}${rows.join('\r\n')}\r\n`);
console.log(
  `${rows.length - 1} strings → docs/i18n-review.csv (${[...Object.keys(en)].filter((k) => appKeys.has(k)).length} shared with the app)`,
);
