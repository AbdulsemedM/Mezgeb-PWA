// WEB-001 budget: initial JavaScript ≤ 170 KB gzip. The entry script and stylesheet are
// inlined into index.html (vite.config.ts), so the initial download is index.html plus any
// chunk the entry still imports. Lazy chunks are listed but not counted.
// Usage: pnpm build && pnpm size
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 170;
const dist = new URL('../dist/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('.vite/manifest.json', dist), 'utf8'));
const gz = async (file) => gzipSync(await readFile(new URL(file, dist)), { level: 9 }).length;

const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry);
const initial = new Set();
const visit = (key) => {
  const chunk = manifest[key];
  if (!chunk || initial.has(chunk.file)) return;
  initial.add(chunk.file);
  for (const imp of chunk.imports ?? []) visit(imp);
};
visit(entryKey);

const html = await readFile(new URL('index.html', dist), 'utf8');
if (!html.includes('<script type="module">')) {
  console.error('index.html has no inline entry script: is the mezgeb:inline-entry plugin on?');
  process.exit(1);
}

let total = await gz('index.html');
console.log(`initial  ${(total / 1024).toFixed(1).padStart(7)} KB  index.html (inline app)`);
for (const file of initial) {
  // The entry itself lives inside index.html now.
  if (!file.endsWith('.js') || !existsSync(new URL(file, dist))) continue;
  const size = await gz(file);
  total += size;
  console.log(`initial  ${(size / 1024).toFixed(1).padStart(7)} KB  ${file}`);
}
const files = Object.values(manifest)
  .map((c) => c.file)
  .filter((f) => f.endsWith('.js') && existsSync(new URL(f, dist)));
for (const file of files) {
  if (!initial.has(file))
    console.log(`lazy     ${((await gz(file)) / 1024).toFixed(1).padStart(7)} KB  ${file}`);
}

// Only type imports may reach the shared zod schemas (vite.config.ts), in any chunk.
for (const file of ['index.html', ...files]) {
  if ((await readFile(new URL(file, dist), 'utf8')).includes('ZodError')) {
    console.error(`${file} contains zod: import shared schemas with \`import type\` only.`);
    process.exit(1);
  }
}

const kb = total / 1024;
console.log(`\nInitial download: ${kb.toFixed(1)} KB gzip (JavaScript budget ${BUDGET_KB} KB)`);
if (kb > BUDGET_KB) {
  console.error('Over budget (WEB-001). Drop a dependency or make a screen lighter.');
  process.exit(1);
}
