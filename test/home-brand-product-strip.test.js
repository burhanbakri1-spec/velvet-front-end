import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { translations } from '../src/i18n/translations.js';
import {
  BRAND_STRIP_DEFAULT_LIMIT,
  isBestsellerProduct,
  isFeaturedProduct,
  selectBrandStripProducts,
} from '../src/data/brandProductStrip.js';

const read = (relative) => fs.readFileSync(new URL(`../src/${relative}`, import.meta.url), 'utf8');
const homePath = new URL('../src/pages/HomePage.jsx', import.meta.url);
const stripPath = new URL('../src/components/BrandProductStrip.jsx', import.meta.url);
const stylesPath = new URL('../src/styles.css', import.meta.url);
const helperPath = new URL('../src/data/brandProductStrip.js', import.meta.url);

const makeProduct = (id, brandId, extra = {}) => ({
  id,
  slug: id,
  name: id,
  price: 20,
  velvetPath: { brandId },
  ...extra,
});

test('each Home brand banner renders its own product strip directly after it', () => {
  const home = fs.readFileSync(homePath, 'utf8');

  assert.match(home, /import BrandProductStrip from '\.\.\/components\/BrandProductStrip'/);
  assert.match(home, /<Fragment key=\{brand\.slug\}>/);
  assert.match(home, /<BrandShowcase[\s\S]*?\/>\s*<BrandProductStrip brandSlug=\{brand\.slug\} \/>/);
  assert.match(home, /<\/Fragment>/);
  assert.doesNotMatch(home, /<BrandShowcase[\s\S]*?<BrandShowcase/, 'banners must not collapse into one another');
});

test('strip selection keeps only products of the same brand', () => {
  const products = [
    makeProduct('baby-1', 'baby'),
    makeProduct('baby-2', 'baby'),
    makeProduct('baby-3', 'baby'),
    makeProduct('play-1', 'play'),
    makeProduct('play-2', 'play'),
  ];

  const babyStrip = selectBrandStripProducts(products, 'baby');
  const playStrip = selectBrandStripProducts(products, 'play');

  assert.ok(babyStrip.length >= 2);
  assert.ok(babyStrip.every((product) => product.velvetPath.brandId === 'baby'));
  assert.ok(playStrip.every((product) => product.velvetPath.brandId === 'play'));
  assert.equal(selectBrandStripProducts(products, 'unknown-brand').length, 0);
  assert.equal(selectBrandStripProducts([], 'baby').length, 0);
});

test('featured products win the first positions', () => {
  const products = [
    makeProduct('a', 'baby', { salesCount: 500 }),
    makeProduct('b', 'baby', { featured: true }),
    makeProduct('c', 'baby', { shopping: ['bestsellers'] }),
    makeProduct('d', 'baby', { featured: true }),
    makeProduct('e', 'baby'),
  ];

  const strip = selectBrandStripProducts(products, 'baby');
  const featured = strip.filter(isFeaturedProduct);

  assert.deepEqual(strip.slice(0, 2).map((product) => product.id), ['b', 'd']);
  assert.equal(featured.length, 2);
});

test('bestseller, salesCount and fallback tiers apply in priority order', () => {
  const products = [
    makeProduct('plain-1', 'play'),
    makeProduct('seller-high', 'play', { shopping: ['bestsellers'], salesCount: 5 }),
    makeProduct('sales-1', 'play', { salesCount: 40 }),
    makeProduct('sales-2', 'play', { salesCount: 90 }),
    makeProduct('plain-2', 'play'),
    makeProduct('badge-seller', 'play', { badge: 'Best Seller' }),
    makeProduct('hidden', 'play', { visible: false }),
    makeProduct('archived', 'play', { status: 'archived' }),
  ];

  const strip = selectBrandStripProducts(products, 'play');
  const ids = strip.map((product) => product.id);

  assert.ok(!ids.includes('hidden'), 'invisible products must be excluded');
  assert.ok(!ids.includes('archived'), 'archived products must be excluded');
  assert.ok(isBestsellerProduct(products.find((product) => product.id === 'badge-seller')));
  assert.deepEqual(ids.slice(0, 2), ['seller-high', 'badge-seller']);
  assert.deepEqual(ids.slice(2, 4), ['sales-2', 'sales-1']);
  assert.deepEqual(ids.slice(4), ['plain-1', 'plain-2']);
});

test('strip keeps the 6-10 product range through its default limit', () => {
  const products = Array.from({ length: 24 }, (_, index) => makeProduct(`p-${index}`, 'collect'));

  assert.ok(BRAND_STRIP_DEFAULT_LIMIT >= 6 && BRAND_STRIP_DEFAULT_LIMIT <= 10);
  assert.equal(selectBrandStripProducts(products, 'collect').length, BRAND_STRIP_DEFAULT_LIMIT);
  assert.equal(selectBrandStripProducts(products, 'collect', { limit: 6 }).length, 6);
});

test('View all keeps the stable brand route and stays locale-aware', () => {
  const strip = fs.readFileSync(stripPath, 'utf8');
  const router = read('routing/Router.jsx');
  const { en, ar } = translations;

  assert.equal(en.home.featuredPicks, 'Featured picks');
  assert.equal(ar.home.featuredPicks, 'مختارات مميزة');
  assert.equal(en.home.viewAll, 'View all');
  assert.equal(ar.home.viewAll, 'عرض الكل');

  assert.match(strip, /import \{ Link \} from '\.\.\/routing\/Router'/);
  assert.match(strip, /`\/products\?brand=\$\{encodeURIComponent\(brandSlug\)\}`/);
  assert.match(strip, /copy\.home\.featuredPicks/);
  assert.match(strip, /copy\.home\.viewAll/);
  assert.ok(!/https?:\/\//.test(strip), 'no hardcoded absolute URLs');

  assert.match(router, /export function localizePath\(to, locale\)/);
  assert.match(router, /url\.search/);
});

test('auto-scroll marquee exists with duplicate track, pause and RTL direction', () => {
  const strip = fs.readFileSync(stripPath, 'utf8');
  const styles = fs.readFileSync(stylesPath, 'utf8');

  assert.ok((strip.match(/brand-strip__group/g) || []).length >= 2, 'track must be duplicated for a seamless loop');
  assert.match(strip, /aria-hidden="true"/);
  assert.match(strip, /is-paused/);
  assert.match(strip, /onPointerDown=\{pauseForInteraction\}/);

  assert.match(styles, /@keyframes brand-strip-marquee \{/);
  assert.match(styles, /transform: translate3d\(-50%, 0, 0\)/);
  assert.match(styles, /\.brand-strip__track \{[^}]*animation: brand-strip-marquee/);
  assert.match(styles, /\.brand-strip__viewport:hover \.brand-strip__track/);
  assert.match(styles, /\.brand-strip__viewport:focus-within \.brand-strip__track/);
  assert.match(styles, /\.brand-strip__track\.is-paused \{ animation-play-state: paused; \}/);
  assert.match(styles, /html\[dir="rtl"\] \.brand-strip__track \{ animation-direction: reverse; \}/);
  assert.match(styles, /\.brand-strip__viewport \{[^}]*overflow-x: auto/);
  assert.doesNotMatch(styles, /from 'swiper|gsap|animejs/);
});

test('reduced-motion disables automatic strip movement', () => {
  const styles = fs.readFileSync(stylesPath, 'utf8');

  const reduced = styles.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/g) || [];
  assert.ok(reduced.length > 0, 'prefers-reduced-motion block missing');
  const stripReduced = reduced.find((block) => block.includes('.brand-strip__track'));
  assert.ok(stripReduced, 'strip must honour prefers-reduced-motion');
  assert.match(stripReduced, /animation: none/);
});

test('strip stays Home-only and does not touch BrandPage or the Shop grid', () => {
  const brandPage = read('pages/BrandPage.jsx');
  const styles = fs.readFileSync(stylesPath, 'utf8');

  assert.doesNotMatch(brandPage, /BrandProductStrip/);
  const categoryScope = styles.match(/\.category-showcases > \.brand-showcase\.brand-showcase--full-banner \{[^}]*\}/);
  assert.ok(categoryScope, 'BrandPage sticky scope missing');
  assert.ok(!categoryScope[0].includes('brand-strip'));
  assert.doesNotMatch(styles, /\.category-showcases[^{}]*brand-strip/);
  assert.doesNotMatch(styles, /brand-strip-card[^{]*grid/);
});

test('sticky Home banner selector is unchanged and the strip paints above it', () => {
  const styles = fs.readFileSync(stylesPath, 'utf8');

  assert.match(styles, /#showcases > \.brand-showcase\.brand-showcase--full-banner \{[^}]*position: sticky;[^}]*top: 0;[^}]*\}/);
  assert.match(styles, /\.category-showcases > \.brand-showcase\.brand-showcase--full-banner \{[^}]*position: sticky;[^}]*top: 0;[^}]*\}/);
  assert.match(styles, /\.brand-strip \{[^}]*position: relative/);
  assert.match(styles, /#showcases \{[^}]*gap:\s*0/);
});

test('product selection stays isolated from velvetCatalog.js', () => {
  const helper = fs.readFileSync(helperPath, 'utf8');
  const catalog = read('data/velvetCatalog.js');

  assert.doesNotMatch(helper, /velvetCatalog/);
  assert.doesNotMatch(catalog, /brandProductStrip|brand-strip/);
  assert.match(helper, /export function selectBrandStripProducts/);
  assert.match(helper, /BRAND_STRIP_DEFAULT_LIMIT/);
});
