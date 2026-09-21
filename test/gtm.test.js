import assert from 'node:assert/strict';
import test from 'node:test';
import {
  readGtmId,
  isGtmEnabled,
  ensureDataLayer,
  pushDataLayer,
  trackPageView,
  initGtm,
  _resetPageViewDedupe,
  _resetInitGuard,
} from '../src/analytics/gtm.js';
import {
  sanitizeGtmIdForHtml,
  buildGtmHeadSnippet,
  buildGtmNoscriptSnippet,
  applyGtmHeadSnippet,
  applyGtmNoscript,
  applyGtmHtml,
} from '../src/analytics/gtmNoscript.js';

/* ------------------------------------------------------------------ */
/*  Minimal window / document stubs (no jsdom)                         */
/* ------------------------------------------------------------------ */

function createStubDocument() {
  const elements = {};
  let _title = '';
  const headChildren = [];
  const bodyChildren = [];
  return {
    get title() { return _title; },
    set title(v) { _title = v; },
    getElementById(id) { return elements[id] || null; },
    querySelector(sel) {
      const source = String(sel || '');
      if (source.startsWith('#')) return elements[source.slice(1)] || null;
      if (source.includes('googletagmanager.com/gtm.js')) {
        return [...headChildren, ...bodyChildren].find((el) => String(el.src || '').includes('googletagmanager.com/gtm.js')) || null;
      }
      return null;
    },
    createElement(tag) {
      return {
        tagName: tag.toUpperCase(),
        id: '',
        async: false,
        src: '',
        style: {},
        childNodes: [],
        appendChild(child) { this.childNodes.push(child); },
      };
    },
    head: {
      appendChild(el) {
        headChildren.push(el);
        if (el.id) elements[el.id] = el;
      },
      _children: headChildren,
    },
    body: {
      appendChild(el) { bodyChildren.push(el); },
      _children: bodyChildren,
    },
    _register(el) { elements[el.id] = el; },
    _headChildren: headChildren,
    _bodyChildren: bodyChildren,
    _elements: elements,
  };
}

function installGlobals() {
  const dataLayer = [];
  const doc = createStubDocument();
  globalThis.window = {
    dataLayer,
    location: { pathname: '/en/products', search: '', href: 'https://example.com/en/products' },
    addEventListener() {},
    history: { pushState() {}, replaceState() {} },
    requestAnimationFrame(cb) { cb(); },
    scrollTo() {},
  };
  globalThis.document = doc;
  return { dataLayer, doc };
}

function removeGlobals() {
  delete globalThis.window;
  delete globalThis.document;
}

/* ================================================================== */
/*  readGtmId / isGtmEnabled                                          */
/* ================================================================== */

test('readGtmId returns trimmed VITE_GTM_ID or empty string', () => {
  assert.equal(readGtmId({ VITE_GTM_ID: '  GTM-123  ' }), 'GTM-123');
  assert.equal(readGtmId({}), '');
  assert.equal(readGtmId({ VITE_GTM_ID: undefined }), '');
  assert.equal(readGtmId({ VITE_GTM_ID: '   ' }), '');
});

test('isGtmEnabled is true only when VITE_GTM_ID is non-empty after trim', () => {
  assert.equal(isGtmEnabled({ VITE_GTM_ID: 'GTM-XXX' }), true);
  assert.equal(isGtmEnabled({ VITE_GTM_ID: '' }), false);
  assert.equal(isGtmEnabled({}), false);
});

test('readGtmId/isGtmEnabled treat omitted or undefined env as import.meta.env', () => {
  assert.equal(typeof readGtmId(undefined), 'string');
  assert.equal(typeof isGtmEnabled(undefined), 'boolean');
  assert.equal(readGtmId(undefined), readGtmId());
  assert.equal(isGtmEnabled(undefined), isGtmEnabled());
});

/* ================================================================== */
/*  ensureDataLayer                                                   */
/* ================================================================== */

test('ensureDataLayer creates window.dataLayer if absent', () => {
  installGlobals();
  assert.ok(Array.isArray(window.dataLayer));
  window.dataLayer = undefined;
  ensureDataLayer();
  assert.ok(Array.isArray(window.dataLayer));
  removeGlobals();
});

/* ================================================================== */
/*  pushDataLayer                                                     */
/* ================================================================== */

test('pushDataLayer returns false and no-ops when GTM is disabled', () => {
  installGlobals();
  const before = window.dataLayer.length;
  const result = pushDataLayer('click', { x: 1 }, {});
  assert.equal(result, false);
  assert.equal(window.dataLayer.length, before);
  removeGlobals();
});

test('pushDataLayer pushes { event, ...payload } when enabled', () => {
  installGlobals();
  const result = pushDataLayer('add_to_cart', { id: '42' }, { VITE_GTM_ID: 'GTM-TEST' });
  assert.equal(result, true);
  assert.equal(window.dataLayer.length, 1);
  assert.deepEqual(window.dataLayer[0], { event: 'add_to_cart', id: '42' });
  removeGlobals();
});

/* ================================================================== */
/*  trackPageView                                                     */
/* ================================================================== */

test('trackPageView returns false when disabled', () => {
  installGlobals();
  const result = trackPageView({}, {});
  assert.equal(result, false);
  removeGlobals();
});

test('trackPageView pushes correct page_view payload when enabled', () => {
  installGlobals();
  window.location.pathname = '/en/about';
  window.location.search = '?tab=team';
  window.location.href = 'https://example.com/en/about?tab=team';
  document.title = 'About | VELVET';

  const result = trackPageView({}, { VITE_GTM_ID: 'GTM-TEST' });
  assert.equal(result, true);
  assert.equal(window.dataLayer.length, 1);
  const push = window.dataLayer[0];
  assert.equal(push.event, 'page_view');
  assert.equal(push.page_path, '/en/about?tab=team');
  assert.equal(push.page_location, 'https://example.com/en/about?tab=team');
  assert.equal(push.page_title, 'About | VELVET');
  removeGlobals();
});

test('trackPageView uses overrides when supplied', () => {
  installGlobals();
  const result = trackPageView(
    { page_path: '/custom', page_title: 'Custom' },
    { VITE_GTM_ID: 'GTM-TEST' },
  );
  assert.equal(result, true);
  assert.equal(window.dataLayer[0].page_path, '/custom');
  assert.equal(window.dataLayer[0].page_title, 'Custom');
  removeGlobals();
});

/* ================================================================== */
/*  Deduplication                                                     */
/* ================================================================== */

test('trackPageView dedupes consecutive identical page_path', () => {
  installGlobals();
  const env = { VITE_GTM_ID: 'GTM-DEDUP' };
  const first = trackPageView({ page_path: '/same' }, env);
  assert.equal(first, true);
  assert.equal(window.dataLayer.length, 1);

  const second = trackPageView({ page_path: '/same' }, env);
  assert.equal(second, false);
  assert.equal(window.dataLayer.length, 1);
  removeGlobals();
});

test('trackPageView re-fires after page_path changes then returns to original', () => {
  installGlobals();
  _resetPageViewDedupe();
  const env = { VITE_GTM_ID: 'GTM-DEDUP' };

  trackPageView({ page_path: '/a' }, env);
  assert.equal(window.dataLayer.length, 1);

  trackPageView({ page_path: '/b' }, env);
  assert.equal(window.dataLayer.length, 2);

  trackPageView({ page_path: '/a' }, env);
  assert.equal(window.dataLayer.length, 3);
  removeGlobals();
});

/* ================================================================== */
/*  initGtm                                                           */
/* ================================================================== */

test('initGtm returns false and does nothing when disabled', () => {
  installGlobals();
  _resetInitGuard();
  const result = initGtm({});
  assert.equal(result, false);
  assert.equal(window.dataLayer.length, 0);
  assert.equal(document._headChildren.length, 0);
  removeGlobals();
});

test('initGtm bootstraps dataLayer, pushes gtm.start, and injects script once', () => {
  installGlobals();
  _resetInitGuard();
  const result = initGtm({ VITE_GTM_ID: 'GTM-ABC' });
  assert.equal(result, true);
  assert.ok(window.dataLayer.length >= 1);
  const bootstrap = window.dataLayer[0];
  assert.equal(typeof bootstrap['gtm.start'], 'number');
  assert.equal(bootstrap.event, 'gtm.js');
  assert.equal(document._headChildren.length, 1);
  assert.equal(document._headChildren[0].id, 'gtm-script');
  assert.equal(document._headChildren[0].src, 'https://www.googletagmanager.com/gtm.js?id=GTM-ABC');
  removeGlobals();
});

test('initGtm does not inject a runtime noscript iframe', () => {
  installGlobals();
  _resetInitGuard();
  initGtm({ VITE_GTM_ID: 'GTM-ABC' });
  const noscriptTags = [...document._headChildren, ...document._bodyChildren]
    .filter((el) => el.tagName === 'NOSCRIPT');
  assert.equal(noscriptTags.length, 0);
  assert.equal(document.getElementById('gtm-noscript'), null);
  removeGlobals();
});

test('initGtm is idempotent — second call is a no-op', () => {
  installGlobals();
  _resetInitGuard();
  initGtm({ VITE_GTM_ID: 'GTM-ABC' });
  const len = window.dataLayer.length;
  const scripts = document._headChildren.length;
  const result = initGtm({ VITE_GTM_ID: 'GTM-ABC' });
  assert.equal(result, false);
  assert.equal(window.dataLayer.length, len);
  assert.equal(document._headChildren.length, scripts);
  removeGlobals();
});

test('initGtm skips script inject when official head snippet already loaded gtm.js', () => {
  installGlobals();
  _resetInitGuard();
  const existing = { id: '', src: 'https://www.googletagmanager.com/gtm.js?id=GTM-ABC' };
  document._headChildren.push(existing);
  const result = initGtm({ VITE_GTM_ID: 'GTM-ABC' });
  assert.equal(result, true);
  assert.equal(document._headChildren.length, 1, 'must not inject a second gtm.js');
  assert.equal(window.dataLayer.length, 0, 'must not re-push gtm.start');
  removeGlobals();
});

/* ================================================================== */
/*  Build-time noscript (real no-JS fallback)                         */
/* ================================================================== */

test('sanitizeGtmIdForHtml accepts only GTM-* container ids', () => {
  assert.equal(sanitizeGtmIdForHtml(' GTM-ABC123 '), 'GTM-ABC123');
  assert.equal(sanitizeGtmIdForHtml(''), '');
  assert.equal(sanitizeGtmIdForHtml('GTM-ABC"><script>'), '');
  assert.equal(sanitizeGtmIdForHtml('UA-123'), '');
});

test('applyGtmNoscript leaves HTML unchanged when ID is missing', () => {
  const html = '<html><body>\n    <div id="root"></div>\n</body></html>';
  assert.equal(applyGtmNoscript(html, ''), html);
  assert.equal(applyGtmNoscript(html, '   '), html);
  assert.equal(applyGtmNoscript(html, undefined), html);
  assert.equal(html.includes('googletagmanager.com'), false);
});

test('applyGtmNoscript injects static noscript iframe when ID is valid', () => {
  const html = '<html><body>\n    <div id="root"></div>\n</body></html>';
  const next = applyGtmNoscript(html, 'GTM-TEST1');
  assert.match(next, /<body>\s*<noscript><iframe src="https:\/\/www\.googletagmanager\.com\/ns\.html\?id=GTM-TEST1"/);
  assert.match(next, /<\/noscript>\s*<div id="root"><\/div>/);
  assert.equal(buildGtmNoscriptSnippet(''), '');
});

test('applyGtmNoscript is idempotent and rejects unsafe ids', () => {
  const html = '<html><body><div id="root"></div></body></html>';
  const once = applyGtmNoscript(html, 'GTM-OK');
  const twice = applyGtmNoscript(once, 'GTM-OK');
  assert.equal(once, twice);
  assert.equal(applyGtmNoscript(html, 'not-a-gtm-id'), html);
});

test('applyGtmHeadSnippet injects official head bootstrap when ID is valid', () => {
  const html = '<html><head><title>t</title></head><body><div id="root"></div></body></html>';
  const next = applyGtmHeadSnippet(html, 'GTM-NZBJHJ8D');
  assert.match(next, /googletagmanager\.com\/gtm\.js\?id='\+i/);
  assert.match(next, /GTM-NZBJHJ8D/);
  assert.match(next, /<!-- End Google Tag Manager -->\s*<\/head>/);
  assert.equal(buildGtmHeadSnippet(''), '');
  assert.equal(applyGtmHeadSnippet(html, ''), html);
});

test('applyGtmHtml injects head + noscript once for VELVET container', () => {
  const html = '<html><head></head><body><div id="root"></div></body></html>';
  const next = applyGtmHtml(html, 'GTM-NZBJHJ8D');
  assert.match(next, /GTM-NZBJHJ8D/);
  assert.match(next, /googletagmanager\.com\/gtm\.js/);
  assert.match(next, /googletagmanager\.com\/ns\.html\?id=GTM-NZBJHJ8D/);
  const again = applyGtmHtml(next, 'GTM-NZBJHJ8D');
  assert.equal(next, again);
});
