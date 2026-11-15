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
    // Identifies one build (version + build time): tells whether an update really switched builds.
    __BUILD_ID__: JSON.stringify(`${pkg.version}+${Date.now().toString(36)}`),
  },
  plugins: [
    react(),
    VitePWA({
      // 'prompt': a new version waits until the user taps "Reîncarcă" (no reload mid-scan).
      registerType: 'prompt',
      // Own service worker (src/sw.js) for the Web Share Target; same caching as before.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        // Includes the 0.9 MB barcode decoder (scan/zxing_reader.wasm) so scanning works offline.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,wasm,woff2}'],
        // The OCR engine (~9 MB) is not precached: it downloads on first use (runtime cache in sw.js).
        globIgnores: ['ocr/**'],
      },
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
        // Android: "Share → IngrediScan" for a photo of the ingredients (or text).
        share_target: {
          action: './share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: { title: 'title', text: 'text', files: [{ name: 'photo', accept: ['image/*'] }] },
        },
        background_color: '#f0fdfa',
        theme_color: '#0f766e',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
