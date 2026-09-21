import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { applyGtmHtml } from './src/analytics/gtmNoscript.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const gtmId = String(env.VITE_GTM_ID || '').trim();

  return {
    plugins: [
      react(),
      {
        name: 'velvet-gtm-html',
        transformIndexHtml(html) {
          // Official head snippet + noscript only when VITE_GTM_ID is set.
          // Empty ID → unchanged HTML → zero GTM network requests.
          return applyGtmHtml(html, gtmId);
        },
      },
    ],
  };
});
