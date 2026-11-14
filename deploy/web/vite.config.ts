// Copyright (c) 2026 Luca Martinetti (MIT License)
// Modifications and additions (c) 2026 SCTG Development - Ronan Le Meillat (MIT License)
// See the LICENSE file in the project root.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The Rust server serves the build at /static/ (index.html at /). wasm/ is
// produced separately (make wasm / Containerfile) and is not part of public/.
export default defineConfig({
  base: '/static/',
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false, target: 'es2022' },
  server: {
    // dev: run the Rust server on :8080 and let Vite proxy the dynamic endpoints
    proxy: {
      '/config.json': 'http://127.0.0.1:8080',
      '/transit': { target: 'ws://127.0.0.1:8080', ws: true },
      '/v1': { target: 'ws://127.0.0.1:8080', ws: true },
    },
  },
});
