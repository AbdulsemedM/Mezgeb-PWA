// Copies the backend's shared TypeScript (`packages/shared/src`) into src/shared, like the
// Flutter app copies the test vectors (MOB-003). Never edit the copies; change the backend.
//
//   pnpm sync:shared [path/to/backend]      copy
//   pnpm sync:shared --check [path]         fail if the copy differs (skipped without a backend)
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const check = args.includes('--check');
const backend =
  args.find((a) => !a.startsWith('--')) ?? fileURLToPath(new URL('../../backend', import.meta.url));
const source = join(backend, 'packages/shared/src');
const target = fileURLToPath(new URL('../src/shared', import.meta.url));
const HEADER = '// Copied from backend packages/shared by scripts/sync-shared.mjs. Do not edit.\n';

if (!existsSync(source)) {
  if (check) {
    console.log(`No backend at ${backend}; skipping the shared-code check.`);
    process.exit(0);
  }
  console.error(`Not found: ${source}`);
  process.exit(1);
}

/** Source files only: no tests, and nothing that needs Node (test-vectors.ts). */
async function list(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await list(path)));
    else if (
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.test.ts') &&
      entry.name !== 'test-vectors.ts'
    ) {
      out.push(path);
    }
  }
  return out.sort();
}

const files = await list(source);
const wanted = new Map();
for (const file of files) {
  wanted.set(
    relative(source, file).replaceAll('\\', '/'),
    HEADER + (await readFile(file, 'utf8')).replaceAll('\r\n', '\n'),
  );
}

if (check) {
  const stale = [];
  for (const [rel, content] of wanted) {
    const path = join(target, rel);
    if (!existsSync(path) || (await readFile(path, 'utf8')) !== content) stale.push(rel);
  }
  const extra = existsSync(target)
    ? (await list(target))
        .map((f) => relative(target, f).replaceAll('\\', '/'))
        .filter((r) => !wanted.has(r))
    : [];
  if (stale.length || extra.length) {
    console.error(
      `src/shared is out of date (${[...stale, ...extra].join(', ')}). Run pnpm sync:shared.`,
    );
    process.exit(1);
  }
  console.log('src/shared matches the backend.');
  process.exit(0);
}

await rm(target, { recursive: true, force: true });
for (const [rel, content] of wanted) {
  const path = join(target, rel);
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, content);
}
console.log(`copied ${wanted.size} files into src/shared`);
