/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import preact from '@preact/preset-vite';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** The API in development; production builds call VITE_API_URL (see src/app/config.ts). */
const devApi = process.env.MEZGEB_DEV_API ?? 'http://localhost:3000';

/**
 * WEB-001 "Opening later links": Android App Links let the Flutter app (et.mezgeb.app) open
 * invite links when it is installed. ANDROID_CERT_SHA256 lists its release signing
 * certificate fingerprints (comma separated, AA:BB:…); unset, the file links no app.
 */
function assetLinks(): Plugin {
  return {
    name: 'mezgeb:assetlinks',
    apply: 'build',
    generateBundle() {
      const fingerprints = (process.env.ANDROID_CERT_SHA256 ?? '')
        .split(',')
        .map((f) => f.trim().toUpperCase())
        .filter(Boolean);
      const statements = fingerprints.length
        ? [
            {
              relation: ['delegate_permission/common.handle_all_urls'],
              target: {
                namespace: 'android_app',
                package_name: 'et.mezgeb.app',
                sha256_cert_fingerprints: fingerprints,
              },
            },
          ]
        : [];
      this.emitFile({
        type: 'asset',
        fileName: '.well-known/assetlinks.json',
        source: `${JSON.stringify(statements, null, 2)}\n`,
      });
    },
  };
}

/**
 * Slow 3G spends 2 s per round trip, so the first visit is one request: the entry script and
 * stylesheet are inlined into index.html (WEB-001 budget). The service worker then keeps it.
 */
function inlineEntry(): Plugin {
  return {
    name: 'mezgeb:inline-entry',
    apply: 'build',
    enforce: 'post',
    // After Vite's own html step: chunk code is final here (preload markers resolved).
    generateBundle(_options, bundle) {
      const page = bundle['index.html'];
      if (!page || page.type !== 'asset') return;
      let html = String(page.source);
      for (const [name, item] of Object.entries(bundle)) {
        if (item.type === 'chunk' && item.isEntry && html.includes(`src="/${name}"`)) {
          // `</script` inside the code would end the inline script early.
          const code = item.code.replaceAll('</script', '<\\/script');
          html = html.replace(
            new RegExp(`<script type="module" crossorigin src="/${name}"></script>`),
            () => `<script type="module">${code}</script>`,
          );
          delete bundle[name];
          delete bundle[`${name}.map`];
        }
        if (item.type === 'asset' && name.endsWith('.css') && html.includes(`href="/${name}"`)) {
          html = html.replace(
            new RegExp(`<link rel="stylesheet" crossorigin href="/${name}">`),
            () => `<style>${String(item.source)}</style>`,
          );
          delete bundle[name];
        }
      }
      page.source = html;
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      // `@mezgeb/shared`, copied from the backend (scripts/sync-shared.mjs). Only type imports
      // may reach the zod schemas, so zod never enters the bundle (checked by pnpm size).
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      // Also set by @preact/preset-vite; repeated so Vitest's inlined deps get them too.
      'react-dom/client': 'preact/compat/client',
      'react-dom': 'preact/compat',
      'react/jsx-runtime': 'preact/jsx-runtime',
      'react/jsx-dev-runtime': 'preact/jsx-dev-runtime',
      react: 'preact/compat',
    },
  },
  plugins: [
    // Preact behind the React API (WEB-001 budget): `react` imports resolve to preact/compat.
    preact(),
    inlineEntry(),
    assetLinks(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      injectManifest: {
        // The app shell and the subset Ethiopic font; data lives in IndexedDB, not the cache.
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,webmanifest}'],
        globIgnores: ['**/guides/**'],
      },
      manifest: {
        id: '/',
        name: 'Nota',
        short_name: 'Nota',
        description: 'Your dube book with your shops',
        lang: 'am',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1E6A52',
        background_color: '#F4F7F2',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: { enabled: false, type: 'module' },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    // VS Code dev tunnels (https://<id>-<port>.<region>.devtunnels.ms) for testing on a phone.
    allowedHosts: ['.devtunnels.ms'],
    // Same origin in development: the refresh cookie (Path=/v1/auth) just works.
    proxy: { '/v1': { target: devApi, changeOrigin: false } },
  },
  preview: {
    port: 4173,
    allowedHosts: ['.devtunnels.ms'],
    proxy: { '/v1': { target: devApi, changeOrigin: false } },
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    manifest: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Screen tests tap through whole flows; 5 s is too tight on a busy CI machine.
    testTimeout: 15_000,
    // Node would pick react-router's CommonJS build, whose require('react') skips the
    // preact/compat alias: use its ES module build and run it through Vite.
    alias: {
      'react-router': fileURLToPath(
        new URL('./node_modules/react-router/dist/development/index.mjs', import.meta.url),
      ),
    },
    server: { deps: { inline: [/react-router/] } },
    css: false,
  },
});
