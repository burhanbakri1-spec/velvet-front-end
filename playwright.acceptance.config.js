import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './acceptance',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:4190',
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4190 --strictPort',
    env: {
      VITE_IGROUP_CONTENT_ENABLED: 'true',
      VITE_IGROUP_API_URL: 'https://api-staging.igroup.website',
      VITE_IGROUP_COMPANY_ID: 'kids-velvet',
      VITE_IGROUP_SITE_ID: 'kids-velvet-storefront',
    },
    url: 'http://127.0.0.1:4190',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
