import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/*
 * ONNX Runtime references its 14 MB .wasm with `new URL(…, import.meta.url)`,
 * so Vite would emit a copy. The OCR worker loads the self-hosted one from
 * ./ocr/ort/ (env.wasm.wasmPaths), so drop the duplicate from the build.
 */
const dropBundledOrtWasm = () => ({
  name: 'drop-bundled-ort-wasm',
  generateBundle(_options, bundle) {
    for (const file of Object.keys(bundle)) {
      if (/ort-wasm[^/]*\.wasm$/.test(file)) delete bundle[file];
    }
  },
});

export default defineConfig({
  // Relative base so the build works from any sub-path (GitHub Pages: /<repo>/).
  base: './',
  worker: { format: 'es', plugins: () => [dropBundledOrtWasm()] }, // the OCR worker uses ES modules (ONNX Runtime)
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [
    react(),
    VitePWA({
      // 'prompt': a new version waits until the user taps "Reîncarcă" (no reload mid-scan).
      registerType: 'prompt',
      injectRegister: false, // registered in src/lib/pwa.js
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'IngrediScan',
        short_name: 'IngrediScan',
        description: 'Flags risky additives and ingredients in supermarket products (RO/EN).',
        lang: 'ro',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f0fdfa',
        theme_color: '#0f766e',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Includes the 0.9 MB barcode decoder (scan/zxing_reader.wasm) so scanning works offline.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,wasm,woff2}'],
        clientsClaim: true, // the first install controls the page at once (OCR caching)
        // The OCR engine (~9 MB) is not precached: it downloads on first use.
        globIgnores: ['ocr/**'],
        runtimeCaching: [
          {
            // Self-hosted OCR engine + language data: download once, then offline.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.includes('/ocr/') && !url.pathname.endsWith('manifest.json'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'ocr-engine',
              expiration: { maxEntries: 20, maxAgeSeconds: 90 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Product lookups from Open Food / Beauty / Products Facts:
            // fresh data when online, last known answer when offline.
            urlPattern: /^https:\/\/world\.open(food|beauty|products)facts\.org\/api\/v2\/product\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'openfacts-api',
              expiration: { maxEntries: 300, maxAgeSeconds: 14 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
});
