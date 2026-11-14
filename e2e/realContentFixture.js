import fs from 'node:fs';
import path from 'node:path';
import { buildDynamicCatalog } from '../src/data/dynamicCatalog.js';
import { applyDisplayPriority, getHomePriority } from '../src/data/displayPriority.js';
import { selectBrandStripProducts } from '../src/data/brandProductStrip.js';
import { collectProductImages } from '../src/data/products.js';

const API_ORIGIN = 'https://api-staging.igroup.website';
const COMPANY_ID = 'kids-velvet';
const SITE_ID = 'kids-velvet-storefront';
const MEDIA_PREFIX = `${API_ORIGIN}/uploads/${COMPANY_ID}/`;
const mediaResponses = new Map();
let activeMediaFetches = 0;
const mediaFetchWaiters = [];

async function acquireMediaFetch() {
  if (activeMediaFetches < 4) {
    activeMediaFetches += 1;
    return;
  }
  await new Promise((resolve) => mediaFetchWaiters.push(resolve));
}

function releaseMediaFetch() {
  const next = mediaFetchWaiters.shift();
  if (next) next();
  else activeMediaFetches -= 1;
}

function readStagingMedia(url) {
  if (!url.startsWith(MEDIA_PREFIX)) throw new Error(`Unexpected Velvet media URL: ${url}`);
  if (!mediaResponses.has(url)) {
    const responsePromise = (async () => {
      let lastError;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await acquireMediaFetch();
        try {
          const response = await fetch(url);
          if (response.status !== 200) throw new Error(`Staging media GET ${response.status}: ${url}`);
          const contentType = response.headers.get('content-type') || 'application/octet-stream';
          if (!contentType.startsWith('image/')) throw new Error(`Staging media is not an image (${contentType}): ${url}`);
          const body = Buffer.from(await response.arrayBuffer());
          if (!body.length) throw new Error(`Staging returned an empty image: ${url}`);
          return { body, contentType, status: response.status };
        } catch (error) {
          lastError = error;
          const transient = /fetch failed|timeout|ECONN|ENOTFOUND/i.test(`${error?.message} ${error?.cause?.name} ${error?.cause?.message}`);
          if (!transient || attempt === 2) throw error;
        } finally {
          releaseMediaFetch();
        }
        await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
      }
      throw lastError;
    })();
    mediaResponses.set(url, responsePromise);
    responsePromise.catch(() => mediaResponses.delete(url));
  }
  return mediaResponses.get(url);
}

/**
 * Use verbatim read-only Staging responses for local visual tests. The browser
 * receives exact content JSON and image bytes through local routes, avoiding
 * changes to shared Staging CORS settings.
 */
export async function installRealContentFixture(page, locale, { brandLimit, includeBabyProductMedia = false } = {}) {
  if (process.env.REAL_CONTENT_FIXTURE !== '1') return;

  const fixtureLocale = locale === 'ar' ? 'ar' : 'en';
  const file = path.resolve('brand-motion-evidence', 'real-content', `content.${fixtureLocale}.json`);
  const body = fs.readFileSync(file, 'utf8');
  const payload = JSON.parse(body);
  if (payload.site?.companyId !== COMPANY_ID || payload.site?.id !== SITE_ID) {
    throw new Error(`Real-content fixture is not for ${COMPANY_ID}/${SITE_ID}`);
  }

  // Preload only the canonical banner posters and uploaded logos from the
  // read-only Staging snapshot. Full-home Chromium runs otherwise issue dozens
  // of product-carousel image requests at once; this staging host was sending
  // HTTP 200 headers while several bodies remained open. Playwright replays
  // these exact verified bytes locally so screenshots show the catalog media.
  const brands = (payload.brands || []).slice(0, Number.isInteger(brandLimit) ? brandLimit : undefined);
  const bannerMedia = brands.flatMap((brand) => [brand.heroPoster, brand.logoUrl]).filter(Boolean);
  // The boundary acceptance checks Baby's real product lane too. Seed the six
  // canonical lead images the storefront selector renders; other carousel
  // media remains on-demand through the same read-only route below.
  applyDisplayPriority(payload);
  const catalog = buildDynamicCatalog(payload, API_ORIGIN);
  const babyProducts = selectBrandStripProducts(catalog?.products || [], 'baby', {
    priority: getHomePriority('baby'),
  });
  const babyProductMedia = includeBabyProductMedia
    ? babyProducts.map((product) => collectProductImages(product)[0]).filter(Boolean)
    : [];
  await Promise.all([...new Set([...bannerMedia, ...babyProductMedia])].map((url) => readStagingMedia(url)));

  // Keep unrelated customer endpoints out of this visual run. Reviews are not
  // part of banner acceptance; analytics is a write endpoint and must never
  // reach shared Staging from the test browser.
  await page.route(/^https:\/\/api-staging\.igroup\.website\/api\/reviews(?:\?.*)?$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: '[]' });
      return;
    }
    await route.fulfill({ status: 405, contentType: 'application/json; charset=utf-8', body: '{"message":"Not part of visual fixture"}' });
  });
  await page.route(/^https:\/\/api-staging\.igroup\.website\/api\/storefront\/analytics\/visitor(?:\?.*)?$/, async (route) => {
    await route.fulfill({ status: 204, body: '' });
  });

  await page.route(/^https:\/\/api-staging\.igroup\.website\/api\/storefront\/content(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const requestHeaders = request.headers();
    const origin = requestHeaders.origin || '*';
    const cors = {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'X-Company-Id, X-Site-Id',
      'access-control-max-age': '0',
      vary: 'Origin',
    };

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    if (request.method() !== 'GET') {
      await route.fulfill({ status: 405, headers: cors, body: 'Method not allowed' });
      return;
    }
    if (requestHeaders['x-company-id'] !== COMPANY_ID || requestHeaders['x-site-id'] !== SITE_ID) {
      await route.fulfill({ status: 403, headers: cors, body: 'Tenant/site mismatch' });
      return;
    }

    const requestedLocale = new URL(request.url()).searchParams.get('locale');
    if (requestedLocale !== fixtureLocale) {
      await route.fulfill({ status: 400, headers: cors, body: 'Fixture locale mismatch' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      headers: cors,
      body,
    });
  });

  await page.route(/^https:\/\/api-staging\.igroup\.website\/uploads\/kids-velvet\//, async (route) => {
    const request = route.request();
    if (request.method() !== 'GET' || request.resourceType() !== 'image') {
      await route.continue();
      return;
    }
    const media = await readStagingMedia(request.url());
    await route.fulfill({
      status: media.status,
      contentType: media.contentType,
      headers: { 'cache-control': 'public, max-age=3600' },
      body: media.body,
    });
  });
}
