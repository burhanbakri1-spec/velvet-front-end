import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  getStorefrontAttribution,
  getStorefrontSessionKey,
  trackPlatformEvent,
  _resetPlatformAnalyticsForTests,
} from '../src/analytics/platformAnalytics.js';
import { buildOrderPayload } from '../src/data/orders.js';

const ENV = {
  VITE_IGROUP_API_URL: 'https://api-staging.igroup.website',
  VITE_IGROUP_COMPANY_ID: 'kids-velvet',
  VITE_IGROUP_SITE_ID: 'kids-velvet-storefront',
};
const ENDPOINT = 'https://api-staging.igroup.website/api/storefront/analytics/visitor';

const read = (relative) => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const platformAnalyticsModule = read('../src/analytics/platformAnalytics.js');
const pageViewHook = read('../src/analytics/usePlatformPageViews.js');
const gtmModule = read('../src/analytics/gtm.js');
const gtmHook = read('../src/analytics/useGtmPageViews.js');
const appSource = read('../src/App.jsx');
const cartContext = read('../src/context/CartContext.jsx');
const productDetailsPage = read('../src/pages/ProductDetailsPage.jsx');
const checkoutPage = read('../src/pages/CheckoutPage.jsx');
const ordersModule = read('../src/data/orders.js');

/* ------------------------------------------------------------------ */
/*  Browser stubs (no jsdom): window / document / localStorage / fetch */
/* ------------------------------------------------------------------ */

const originalFetch = globalThis.fetch;
const hadFetch = 'fetch' in globalThis;
const originalLocalStorage = globalThis.localStorage;
const hadLocalStorage = 'localStorage' in globalThis;

function installGlobals({ pathname = '/en', search = '', referrer = '' } = {}) {
  const requests = [];
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => { storage.set(key, String(value)); },
    removeItem: (key) => { storage.delete(key); },
  };
  globalThis.window = { location: { pathname, search, href: `https://velvet.example${pathname}${search}` } };
  globalThis.document = { referrer };
  globalThis.fetch = (url, options = {}) => {
    requests.push({
      url: String(url),
      method: options.method,
      headers: options.headers || {},
      keepalive: options.keepalive === true,
      body: JSON.parse(options.body),
    });
    return Promise.resolve({ ok: true, status: 201, json: async () => ({ ok: true }) });
  };
  _resetPlatformAnalyticsForTests();
  return { requests, storage };
}

function removeGlobals() {
  _resetPlatformAnalyticsForTests();
  if (hadFetch) globalThis.fetch = originalFetch; else delete globalThis.fetch;
  if (hadLocalStorage) globalThis.localStorage = originalLocalStorage; else delete globalThis.localStorage;
  delete globalThis.window;
  delete globalThis.document;
}

/** Source text spans of every `needle(...)` call, parentheses-balanced. */
function callSpans(source, needle) {
  const spans = [];
  let from = 0;
  for (;;) {
    const start = source.indexOf(needle, from);
    if (start === -1) break;
    let depth = 0;
    let end = -1;
    for (let i = start + needle.length - 1; i < source.length; i += 1) {
      if (source[i] === '(') depth += 1;
      else if (source[i] === ')') {
        depth -= 1;
        if (depth === 0) { end = i + 1; break; }
      }
    }
    if (end === -1) break;
    spans.push(source.slice(start, end));
    from = end;
  }
  return spans;
}

function sourceFiles(directory) {
  const out = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/* ================================================================== */
/*  Session key persistence                                           */
/* ================================================================== */

test('session key is generated once and persisted in localStorage', () => {
  const { storage } = installGlobals();
  try {
    const first = getStorefrontSessionKey();
    assert.ok(first.length > 0);
    assert.equal(getStorefrontSessionKey(), first);
    assert.equal(storage.get('epStorefrontAnalyticsSessionKey'), first);
  } finally {
    removeGlobals();
  }
});

test('session key falls back to memory when storage is unavailable', () => {
  installGlobals();
  try {
    globalThis.localStorage = undefined;
    const first = getStorefrontSessionKey();
    assert.ok(first.length > 0);
    assert.equal(getStorefrontSessionKey(), first);
  } finally {
    removeGlobals();
  }
});

/* ================================================================== */
/*  First-touch UTM attribution                                       */
/* ================================================================== */

test('first-touch UTM attribution and referrer hostname are captured once', () => {
  const { storage } = installGlobals({
    search: '?utm_source=ig&utm_medium=social&utm_campaign=spring&utm_content=post_01',
    referrer: 'https://www.Example.com/landing',
  });
  try {
    const first = getStorefrontAttribution();
    assert.equal(first.utm_source, 'ig');
    assert.equal(first.utm_medium, 'social');
    assert.equal(first.utm_campaign, 'spring');
    assert.equal(first.utm_content, 'post_01');
    assert.equal(first.referrer, 'www.example.com');
    assert.ok(storage.get('epStorefrontAttribution'));

    globalThis.window.location.search = '?utm_source=newsletter&utm_medium=email&utm_term=shoes';
    const second = getStorefrontAttribution();
    assert.equal(second.utm_source, 'ig', 'first touch wins over a later campaign');
    assert.equal(second.utm_medium, 'social');
    assert.equal(second.utm_campaign, 'spring');
    assert.equal(second.utm_term, 'shoes', 'later parameters only fill empty fields');
  } finally {
    removeGlobals();
  }
});

test('analytics never send an unrelated customer/admin token', () => {
  assert.doesNotMatch(platformAnalyticsModule, /Authorization/);
  assert.doesNotMatch(platformAnalyticsModule, /buildTenantHeaders|getStoredToken/);
  assert.match(platformAnalyticsModule, /'X-Company-Id': config\.companyId/);
  assert.match(platformAnalyticsModule, /'X-Site-Id': config\.siteId/);
});

/* ================================================================== */
/*  Endpoint + tenant headers                                         */
/* ================================================================== */

test('pageview posts to the platform visitor endpoint with tenant headers', async () => {
  const { requests } = installGlobals({ pathname: '/en/products', search: '?utm_source=ig' });
  try {
    await trackPlatformEvent('pageview', {}, ENV);
    assert.equal(requests.length, 1);
    const [request] = requests;
    assert.equal(request.url, ENDPOINT);
    assert.equal(request.method, 'POST');
    assert.equal(request.headers['X-Company-Id'], 'kids-velvet');
    assert.equal(request.headers['X-Site-Id'], 'kids-velvet-storefront');
    assert.equal(request.headers.Authorization, undefined);
    assert.equal(request.keepalive, true);
    assert.equal(request.body.eventType, 'pageview');
    assert.equal(request.body.path, '/en/products');
    assert.equal(request.body.attribution.utm_source, 'ig');
    assert.ok(request.body.sessionKey.length > 0);
  } finally {
    removeGlobals();
  }
});

test('missing tenant configuration sends nothing (no fake analytics)', async () => {
  const { requests } = installGlobals();
  try {
    assert.equal(await trackPlatformEvent('pageview', { path: '/en' }, {}), null);
    assert.equal(await trackPlatformEvent('pageview', { path: '/en' }, { VITE_IGROUP_API_URL: 'https://x.test' }), null);
    assert.equal(requests.length, 0);
  } finally {
    removeGlobals();
  }
});

/* ================================================================== */
/*  pageview dedupe                                                   */
/* ================================================================== */

test('consecutive identical pageviews are deduped, new routes are not', async () => {
  const { requests } = installGlobals({ pathname: '/en' });
  try {
    await trackPlatformEvent('pageview', {}, ENV);
    await trackPlatformEvent('pageview', {}, ENV); // StrictMode remount
    await trackPlatformEvent('pageview', { path: '/en' }, ENV);
    assert.equal(requests.length, 1);

    globalThis.window.location.pathname = '/en/products';
    await trackPlatformEvent('pageview', {}, ENV);
    assert.equal(requests.length, 2);
    assert.equal(requests[1].body.path, '/en/products');
  } finally {
    removeGlobals();
  }
});

test('pageview hook tracks SPA route and query changes and never replaces GTM', () => {
  assert.match(pageViewHook, /trackPlatformEvent\('pageview', \{ path: fullPath \}, env\)/);
  assert.match(pageViewHook, /\(location\.pathname \|\| '\/'\) \+ \(location\.search \|\| ''\)/);
  assert.match(pageViewHook, /\[location\.pathname, location\.search, env\]/);
  assert.doesNotMatch(pageViewHook, /from '\.\/gtm'|pushDataLayer|trackPageView/);
  assert.match(gtmHook, /trackPageView\(\{ page_path: fullPath \}, env\)/);
});

/* ================================================================== */
/*  product_view                                                      */
/* ================================================================== */

test('product_view fires once per product with the productId', async () => {
  const { requests } = installGlobals({ pathname: '/en/products/velvet-src-104' });
  try {
    await trackPlatformEvent('product_view', { productId: 'p1' }, ENV);
    await trackPlatformEvent('product_view', { productId: 'p1' }, ENV); // remount replay
    assert.equal(requests.length, 1);
    assert.equal(requests[0].body.eventType, 'product_view');
    assert.equal(requests[0].body.productId, 'p1');

    await trackPlatformEvent('product_view', { productId: 'p2' }, ENV);
    assert.equal(requests.length, 2);
    assert.equal(requests[1].body.productId, 'p2');
  } finally {
    removeGlobals();
  }
});

test('product details page fires product_view from an effect guarded by the product', () => {
  const effects = callSpans(productDetailsPage, 'useEffect(');
  const viewEffect = effects.find((span) => span.includes("'product_view'"));
  assert.ok(viewEffect, 'a useEffect must own the product_view call');
  assert.match(viewEffect, /if \(!routeProduct\?\.id\) return undefined;/);
  assert.match(viewEffect, /trackPlatformEvent\('product_view', \{ productId: routeProduct\.id \}\)/);
  assert.match(productDetailsPage, /\}, \[routeProduct\?\.id\]\);/);
  assert.match(productDetailsPage, /import \{ trackPlatformEvent \} from '\.\.\/analytics\/platformAnalytics';/);
});

/* ================================================================== */
/*  add_to_cart / remove_from_cart                                    */
/* ================================================================== */

test('add_to_cart fires with the productId', async () => {
  const { requests } = installGlobals({ pathname: '/en/products/velvet-src-104' });
  try {
    await trackPlatformEvent('add_to_cart', { productId: 'p1' }, ENV);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].body.eventType, 'add_to_cart');
    assert.equal(requests[0].body.productId, 'p1');
    assert.equal(requests[0].body.path, '/en/products/velvet-src-104');
  } finally {
    removeGlobals();
  }
});

test('remove_from_cart fires once even when the action is replayed', async () => {
  const { requests } = installGlobals({ pathname: '/en/cart' });
  try {
    await trackPlatformEvent('remove_from_cart', { productId: 'p1' }, ENV);
    await trackPlatformEvent('remove_from_cart', { productId: 'p1' }, ENV); // updater replay
    assert.equal(requests.length, 1);
    assert.equal(requests[0].body.eventType, 'remove_from_cart');
    assert.equal(requests[0].body.productId, 'p1');

    await trackPlatformEvent('remove_from_cart', { productId: 'p2' }, ENV);
    assert.equal(requests.length, 2);
  } finally {
    removeGlobals();
  }
});

test('cart events fire outside the React state updaters', () => {
  const updaters = callSpans(cartContext, 'setItems(');
  assert.ok(updaters.length >= 4, 'cart still mutates state through setItems');
  for (const updater of updaters) {
    assert.doesNotMatch(updater, /trackPlatformEvent/, 'tracking must never run inside an updater');
  }
  assert.equal(callSpans(cartContext, 'trackPlatformEvent(').length, 3);
  assert.match(cartContext, /trackPlatformEvent\('add_to_cart', \{ productId: product\.id \}\)/);
  assert.equal(
    (cartContext.match(/trackPlatformEvent\('remove_from_cart', \{ productId: removed\.productId \}\)/g) || []).length,
    2,
    'explicit remove and quantity-0 remove both report the productId',
  );
  assert.match(cartContext, /if \(maxStock === 0\) return;/);
});

/* ================================================================== */
/*  initiate_checkout                                                 */
/* ================================================================== */

test('initiate_checkout fires when the checkout is entered', async () => {
  const { requests } = installGlobals({ pathname: '/en/checkout' });
  try {
    await trackPlatformEvent('initiate_checkout', {}, ENV);
    await trackPlatformEvent('initiate_checkout', {}, ENV); // effect re-run
    assert.equal(requests.length, 1);
    assert.equal(requests[0].body.eventType, 'initiate_checkout');
    assert.equal(requests[0].body.path, '/en/checkout');
  } finally {
    removeGlobals();
  }
});

test('checkout page starts the funnel only with a non-empty cart', () => {
  const effects = callSpans(checkoutPage, 'useEffect(');
  const checkoutEffect = effects.find((span) => span.includes("'initiate_checkout'"));
  assert.ok(checkoutEffect, 'a useEffect must own the initiate_checkout call');
  assert.match(checkoutEffect, /if \(!checkoutStarted\) return undefined;/);
  assert.match(checkoutPage, /const checkoutStarted = items\.length > 0;/);
  assert.doesNotMatch(checkoutPage, /trackPlatformEvent\('purchase'/);
});

/* ================================================================== */
/*  purchase stays backend-confirmed                                  */
/* ================================================================== */

test('purchase is never sent by client analytics', async () => {
  const { requests } = installGlobals();
  try {
    assert.equal(trackPlatformEvent('purchase', { productId: 'p1' }, ENV), null);
    assert.equal(requests.length, 0);
    assert.doesNotMatch(platformAnalyticsModule, /'purchase'/);
    assert.match(platformAnalyticsModule, /SUPPORTED_EVENT_TYPES = \['pageview', 'product_view', 'add_to_cart', 'remove_from_cart', 'initiate_checkout'\]/);
  } finally {
    removeGlobals();
  }
});

test('no storefront source pushes or tracks a purchase event', () => {
  for (const file of sourceFiles(path.join(process.cwd(), 'src'))) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /trackPlatformEvent\(\s*['"`]purchase/, file);
    assert.doesNotMatch(source, /event:\s*['"`]purchase['"`]/, file);
    assert.doesNotMatch(source, /gtag\(\s*['"`]event['"`]\s*,\s*['"`]purchase/, file);
  }
});

/* ================================================================== */
/*  Order attribution payload                                         */
/* ================================================================== */

test('order payload carries the analytics session key and first-touch attribution', async () => {
  const { requests, storage } = installGlobals({
    pathname: '/en/checkout',
    search: '?utm_source=ig&utm_medium=social',
    referrer: 'https://news.example/story',
  });
  try {
    await trackPlatformEvent('pageview', { path: '/en/checkout' }, ENV);
    const funnelSessionKey = requests[0].body.sessionKey;
    assert.equal(storage.get('epStorefrontAnalyticsSessionKey'), funnelSessionKey);

    const payload = buildOrderPayload({
      customer: { name: 'Sara', phone: '0598123456', city: 'Ramallah', address: 'Main St' },
      items: [{ productId: 'p1', variantId: 'v1', quantity: 2 }],
      deliveryZone: { id: 'zone-a', cityKey: 'ramallah', deliveryPrice: 20 },
    });

    assert.equal(payload.analyticsSessionKey, funnelSessionKey);
    assert.equal(payload.attribution.utm_source, 'ig');
    assert.equal(payload.attribution.utm_medium, 'social');
    assert.equal(payload.attribution.referrer, 'news.example');
    assert.equal(payload.deliveryZoneId, 'zone-a');
    assert.equal('delivery_price' in payload, false);
    assert.equal(getStorefrontSessionKey(), funnelSessionKey);
  } finally {
    removeGlobals();
  }
});

test('orders module documents and submits the attribution fields', () => {
  assert.match(ordersModule, /analyticsSessionKey, attribution/);
  assert.match(ordersModule, /payload\.analyticsSessionKey = getStorefrontSessionKey\(\);/);
  assert.match(ordersModule, /payload\.attribution = getStorefrontAttribution\(\);/);
});

/* ================================================================== */
/*  GTM stays intact                                                  */
/* ================================================================== */

test('GTM tracking remains wired alongside the first-party analytics', () => {
  assert.match(appSource, /useGtmPageViews\(\);/);
  assert.match(appSource, /usePlatformPageViews\(\);/);
  assert.match(gtmModule, /export function trackPageView/);
  assert.match(gtmModule, /export function pushDataLayer/);
  assert.match(gtmModule, /export function initGtm/);
  assert.match(gtmModule, /dataLayer/);
  assert.match(gtmModule, /page_view/);
  assert.match(gtmModule, /googletagmanager\.com/);
  assert.match(appSource, /import \{ useGtmPageViews \} from '\.\/analytics\/useGtmPageViews';/);
  assert.match(appSource, /import \{ usePlatformPageViews \} from '\.\/analytics\/usePlatformPageViews';/);
});
