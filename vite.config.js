import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { applyGtmNoscript } from './src/analytics/gtmNoscript.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const gtmId = String(env.VITE_GTM_ID || '').trim();

  return {
    plugins: [
      react(),
      {
        name: 'velvet-gtm-noscript',
        transformIndexHtml(html) {
          // Real static noscript only when VITE_GTM_ID is set.
          // Empty ID → unchanged HTML → zero GTM noscript requests.
          return applyGtmNoscript(html, gtmId);
        },
      },
    ],
  };
});
