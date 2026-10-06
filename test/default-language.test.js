import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { translations } from '../src/i18n/translations.js';

const read = (relative) => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

const router = read('../src/routing/Router.jsx');
const i18n = read('../src/i18n/I18nContext.jsx');
const indexHtml = read('../index.html');

// Router.jsx ships JSX, so the pure helpers are lifted out of the source and
// executed for real instead of only pattern-matched.
function loadRouterHelpers() {
  const start = router.indexOf('export function getPathLocale');
  const end = router.indexOf('export function RouterProvider');
  assert.ok(start >= 0 && end > start, 'router helper block not found');
  const body = router.slice(start, end).replace(/export function/g, 'function');
  const factory = new Function('window', `${body}\nreturn { getPathLocale, stripLocalePrefix, localizePath };`);
  return factory({ location: { origin: 'https://velvet.test' } });
}

// The locale resolution expression is evaluated with both inputs supplied.
function resolveLocale(explicitLocale, rememberedLocale) {
  const match = router.match(/const locale = (explicitLocale \|\| [^;]+);/);
  assert.ok(match, 'locale resolution expression missing from RouterProvider');
  const factory = new Function('explicitLocale', 'rememberedLocale', `return ${match[1]};`);
  return factory(explicitLocale, rememberedLocale);
}

function sourceFiles(dir) {
  return fs.readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:js|jsx|ts|tsx|html)$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name));
}

test('fresh visit to "/" resolves to Arabic without a browser-language override', () => {
  assert.equal(resolveLocale(null, null), 'ar', 'first-time visitors get Arabic');
  assert.equal(resolveLocale(null, 'ar'), 'ar');
  assert.equal(resolveLocale('ar', null), 'ar');

  const srcFiles = sourceFiles(new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  const sniffing = srcFiles.filter((file) => /navigator\s*\.\s*languages?/.test(fs.readFileSync(file, 'utf8')));
  assert.deepEqual(sniffing, [], 'browser language must never override the Arabic default');
  assert.doesNotMatch(router, /navigator\s*\.\s*languages?/);
  assert.doesNotMatch(i18n, /navigator\s*\.\s*languages?/);

  // The static shell already paints Arabic before React mounts.
  assert.match(indexHtml, /<html lang="ar" dir="rtl">/);
});

test('"/" is canonicalized to the Arabic route instead of staying unprefixed', () => {
  assert.doesNotMatch(router, /pathname === '\/' && locale === 'ar'/, 'the old root early-return is gone');
  assert.match(
    router,
    /navigate\(`\$\{localizePath\(location\.pathname, locale\)\}\$\{location\.search\}\$\{location\.hash\}`, \{ replace: true \}\)/,
    'unprefixed paths (including "/") are replaced onto the active locale',
  );

  const { localizePath } = loadRouterHelpers();
  assert.equal(localizePath('/', 'ar'), '/ar');
  assert.equal(localizePath('/products', 'ar'), '/ar/products');
});

test('an explicitly selected English preference is preserved', () => {
  assert.equal(resolveLocale(null, 'en'), 'en', 'remembered English wins over the Arabic default');
  assert.match(router, /rememberedLocale === 'en' \? 'en' : 'ar'/);
  assert.match(i18n, /localStorage\.setItem\('play-language', nextLocale\)/, 'the switcher persists the choice');

  const { localizePath } = loadRouterHelpers();
  assert.equal(localizePath('/', 'en'), '/en');
  assert.equal(localizePath('/products?search=teddy', 'en'), '/en/products?search=teddy');
});

test('direct /en/... and /ar/... links keep their own language', () => {
  const { getPathLocale, stripLocalePrefix, localizePath } = loadRouterHelpers();
  assert.equal(getPathLocale('/en/products'), 'en');
  assert.equal(getPathLocale('/ar/products'), 'ar');
  assert.equal(getPathLocale('/products'), null);
  assert.equal(getPathLocale('/enough'), null);

  // A prefix in the URL beats any remembered value and is persisted.
  assert.equal(resolveLocale('en', null), 'en');
  assert.equal(resolveLocale('ar', 'en'), 'ar');
  assert.match(router, /window\.localStorage\.setItem\('play-language', explicitLocale\)/);

  // Never double-prefix an already localized URL.
  assert.equal(localizePath('/en/products', 'en'), '/en/products');
  assert.equal(localizePath('/ar/products', 'ar'), '/ar/products');
  assert.equal(stripLocalePrefix('/en/products'), '/products');
  assert.equal(stripLocalePrefix('/ar'), '/');
});

test('brand paths, query strings, and hashes survive locale prefixing', () => {
  const { localizePath, stripLocalePrefix } = loadRouterHelpers();
  assert.equal(
    localizePath('/products?search=teddy&sort=price-asc', 'ar'),
    '/ar/products?search=teddy&sort=price-asc',
  );
  assert.equal(localizePath('/brands/collect?age=5-6y', 'en'), '/en/brands/collect?age=5-6y');
  assert.equal(localizePath('/products#reviews', 'ar'), '/ar/products#reviews');
  assert.equal(stripLocalePrefix('/ar/brands/collect'), '/brands/collect');

  // The root canonicalization carries the query string and hash along.
  assert.match(router, /\$\{localizePath\(location\.pathname, locale\)\}\$\{location\.search\}\$\{location\.hash\}/);

  // Outbound links are never rewritten.
  assert.equal(localizePath('https://example.com/x', 'ar'), 'https://example.com/x');
  assert.equal(localizePath('#reviews', 'ar'), '#reviews');
});

test('RTL/LTR direction still follows the active locale and English stays supported', () => {
  assert.match(i18n, /document\.documentElement\.lang = locale/);
  assert.match(i18n, /document\.documentElement\.dir = locale === 'ar' \? 'rtl' : 'ltr'/);
  assert.match(i18n, /locale, dir: locale === 'ar' \? 'rtl' : 'ltr'/);
  assert.match(router, /export function localizePath\(to, locale\)/);

  assert.ok(translations.ar, 'Arabic copy exists');
  assert.ok(translations.en, 'English copy exists');
  assert.ok(Object.keys(translations.en).length > 0, 'English support is untouched');
  assert.notEqual(translations.en.meta.site, translations.ar.meta.site);
});
