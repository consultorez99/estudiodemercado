import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  // The Gemini API key is intentionally NOT exposed to the client bundle.
  // It lives only in the Express server (see server/index.ts), which the
  // browser reaches through the /api proxy below in dev (same-origin in prod).
  const backendPort = process.env.BACKEND_PORT || '3001';
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Honor PORT when set (e.g. by the preview harness); the dev:client
      // script overrides it with --port=3000 for normal local dev.
      port: process.env.PORT ? Number(process.env.PORT) : undefined,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': `http://localhost:${backendPort}`,
      },
    },
  };
});
