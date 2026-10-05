import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { translations } from '../src/i18n/translations.js';
import { buildShopQuery } from '../src/hooks/shopQuery.js';

const header = fs.readFileSync(new URL('../src/components/Header.jsx', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const router = fs.readFileSync(new URL('../src/routing/Router.jsx', import.meta.url), 'utf8');
const useShopState = fs.readFileSync(new URL('../src/hooks/useShopState.js', import.meta.url), 'utf8');
const strip = fs.readFileSync(new URL('../src/components/BrandProductStrip.jsx', import.meta.url), 'utf8');

const utilityRow = header.match(/<div className="mobile-utility-row">[\s\S]*?<\/div>/)?.[0] || '';

const SHORTCUT_SOURCE =
  /const shopShortcut = contextBrand\s*\?\s*`\/products\?\$\{buildShopQuery\(\{ brand: contextBrand\.slug \}\)\}`\s*:\s*'\/products';/;

// Mirrors the Header expression; the shared pure query builder runs for real.
const shortcutFor = (brandSlug) => (brandSlug ? `/products?${buildShopQuery({ brand: brandSlug })}` : '/products');

test('top mobile header no longer contains the language selector', () => {
  assert.ok(utilityRow, 'mobile utility row missing from Header.jsx');
  assert.doesNotMatch(utilityRow, /LanguageControl|language-control/);
  assert.doesNotMatch(styles, /\.mobile-utility-row \.language-control/);
});

test('top mobile header shows a Shop shortcut control', () => {
  assert.match(utilityRow, /className="header-icon-button mobile-shop-link"/);
  assert.match(utilityRow, /<svg[\s\S]*?<path[\s\S]*?<\/svg>/);
  assert.match(utilityRow, /aria-label=\{copy\.header\.shop\}/);
  assert.equal(translations.en.header.shop, 'Shop');
  assert.equal(translations.ar.header.shop, 'المتجر');
  assert.match(styles, /a\.header-icon-button \{ text-decoration: none; \}/);
});

test('no current brand -> general Shop shortcut', () => {
  assert.match(header, SHORTCUT_SOURCE);
  assert.match(header, /const contextBrand = useMemo/);
  assert.match(header, /new URLSearchParams\(location\.search\)\.get\('brand'\)/, 'shop ?brand= feeds the brand context');
  assert.equal(shortcutFor(''), '/products');
});

test('Collect context -> Velvet Collect Shop', () => {
  assert.equal(shortcutFor('collect'), '/products?brand=collect');
  assert.match(header, /getBrand\(decodeURIComponent\(brandRoute\[1\]\)\)/, 'brand routes feed the context');
});

test('Kids context -> Velvet Kids Shop', () => {
  assert.equal(shortcutFor('kids'), '/products?brand=kids');
});

test('Baby context -> Velvet Baby Shop', () => {
  assert.equal(shortcutFor('baby'), '/products?brand=baby');
});

test('Plush context -> Velvet Plush Shop', () => {
  assert.equal(shortcutFor('plush'), '/products?brand=plush');
});

test('Shop shortcut preserves the AR/EN locale', () => {
  assert.match(utilityRow, /to=\{localizePath\(shopShortcut, locale\)\}/);
  assert.match(router, /export function localizePath\(to, locale\)/);
  assert.match(router, /const href = localizePath\(to, locale\)/);
});

test('existing /products?brand=<slug> route convention reused', () => {
  assert.match(header, SHORTCUT_SOURCE);
  assert.match(
    useShopState,
    /`\/products\$\{query \? `\?\$\{query\}` : ''\}`/,
    'shopHref builds the same /products?<query> shape'
  );
  assert.match(strip, /`\/products\?brand=\$\{encodeURIComponent\(brandSlug\)\}`/);
  assert.equal(buildShopQuery({ brand: 'collect' }), 'brand=collect');
});

test('language selector stays available inside the mobile drawer', () => {
  assert.match(header, /mobile-drawer__top[\s\S]{0,260}?<LanguageControl className="language-control--drawer"/);
});

test('desktop header keeps its language control, shop link and account untouched', () => {
  const actionsStart = header.indexOf('<div className="header-actions">');
  const actionsEnd = header.indexOf('className={`menu-toggle');
  assert.ok(actionsStart > -1 && actionsEnd > actionsStart, 'desktop header actions block missing');
  const desktopActions = header.slice(actionsStart, actionsEnd);

  assert.match(desktopActions, /<LanguageControl className="language-control--header" \/>/);
  assert.match(desktopActions, /header-icon-button--account/);
  assert.match(header, /className="nav-link nav-link--shop"/);
  assert.match(styles, /\.language-control--header \{/);
});
