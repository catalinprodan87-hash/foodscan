/**
 * Starts a Vite dev server on the repository (so benchmark harness pages can
 * import the app's modules directly) after copying the self-hosted engines.
 */
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export async function startServer() {
  execFileSync(process.execPath, [join(root, 'scripts', 'copy-ocr-assets.mjs')], { stdio: 'ignore' });
  const server = await createServer({
    root,
    logLevel: 'error',
    // Pre-bundle up front: otherwise Vite discovers these on the first import
    // and reloads the page in the middle of a run.
    optimizeDeps: { entries: ['bench/**/harness.html'], include: ['onnxruntime-web/wasm', 'zxing-wasm/reader'] },
    server: { port: 0, host: '127.0.0.1', hmr: false },
  });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  return { url, close: () => server.close() };
}
