import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative base so the build works from any sub-path (GitHub Pages: /<repo>/).
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
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
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
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
