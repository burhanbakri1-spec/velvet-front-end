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
import { clampStripScrollPosition, STRIP_GROUPS } from '../src/hooks/stripScroll.js';

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

test('strip selection contains products of the same brand only', () => {
  const products = [
    makeProduct('baby-1', 'baby'),
    makeProduct('baby-2', 'baby'),
    makeProduct('baby-3', 'baby'),
    makeProduct('play-1', 'play'),
    makeProduct('play-2', 'play'),
  ];

  const babyStrip = selectBrandStripProducts(products, 'baby');
  const playStrip = selectBrandStripProducts(products, 'play');

  assert.deepEqual(babyStrip.map((product) => product.id), ['baby-1', 'baby-2', 'baby-3']);
  assert.deepEqual(playStrip.map((product) => product.id), ['play-1', 'play-2']);
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

test('strip never pulls products from other brands', () => {
  const products = [
    makeProduct('baby-1', 'baby'),
    makeProduct('baby-2', 'baby', { featured: true }),
    makeProduct('baby-3', 'baby'),
    makeProduct('play-star', 'play', { featured: true, salesCount: 999 }),
    makeProduct('collect-star', 'collect', { featured: true }),
  ];

  const strip = selectBrandStripProducts(products, 'baby');

  assert.deepEqual(strip.map((product) => product.id), ['baby-2', 'baby-1', 'baby-3']);
  assert.equal(strip.length, 3, 'a 3-product brand returns exactly 3 products');
  assert.ok(
    strip.every((product) => product.velvetPath.brandId === 'baby'),
    'rich cross-brand products must never enter the strip'
  );
});

test('base selection contains unique product ids and slugs', () => {
  const products = [
    makeProduct('dup', 'build'),
    makeProduct('dup', 'build'),
    makeProduct('solo', 'build'),
    makeProduct('play-1', 'play'),
    makeProduct('play-2', 'play'),
  ];

  const strip = selectBrandStripProducts(products, 'build');
  const keys = strip.map((product) => String(product.id ?? product.slug));

  assert.deepEqual(keys, ['dup', 'solo']);
  assert.equal(new Set(keys).size, keys.length, 'every selected product must be unique');
});

test('selector never pads or repeats products to reach a target size', () => {
  const lone = [
    makeProduct('only', 'build'),
    ...Array.from({ length: 10 }, (_, index) => makeProduct(`other-${index}`, 'play')),
  ];

  for (const limit of [undefined, 3, BRAND_STRIP_DEFAULT_LIMIT]) {
    const strip = selectBrandStripProducts(lone, 'build', limit ? { limit } : {});
    assert.deepEqual(strip.map((product) => product.id), ['only'], `limit=${limit}: 1-product brand returns exactly 1`);
  }

  const eight = Array.from({ length: 8 }, (_, index) => makeProduct(`p-${index}`, 'move'));
  const eightStrip = selectBrandStripProducts(eight, 'move');
  assert.equal(eightStrip.length, 8, '8-product brand shows up to 8 unique products');
  assert.equal(new Set(eightStrip.map((product) => product.id)).size, 8);

  const five = Array.from({ length: 5 }, (_, index) => makeProduct(`f-${index}`, 'plush'));
  assert.equal(selectBrandStripProducts(five, 'plush').length, 5, '5-product brand shows exactly 5');
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

test('auto-scroll marquee exists with duplicated groups, interaction pause and RTL direction', () => {
  const strip = fs.readFileSync(stripPath, 'utf8');
  const styles = fs.readFileSync(stylesPath, 'utf8');

  assert.match(strip, /Array\.from\(\{ length: STRIP_GROUPS \}/, 'track must be duplicated for a seamless loop');
  assert.match(strip, /aria-hidden=\{index === 0 \? undefined : 'true'\}/);
  assert.match(strip, /is-paused/);
  assert.match(strip, /onPointerDown=\{pauseForInteraction\}/);
  assert.match(strip, /onScroll=\{normalizeStripScroll\}/);
  assert.match(strip, /'--strip-groups': STRIP_GROUPS/);

  assert.match(styles, /@keyframes brand-strip-marquee \{/);
  assert.match(styles, /\.brand-strip__track \{[^}]*animation: brand-strip-marquee/);
  assert.match(styles, /\.brand-strip__viewport:focus-within \.brand-strip__track/);
  assert.match(styles, /\.brand-strip__track\.is-paused \{ animation-play-state: paused; \}/);
  assert.match(styles, /html\[dir="rtl"\] \.brand-strip__track \{ animation-name: brand-strip-marquee-rtl; \}/);
  assert.match(styles, /\.brand-strip__viewport \{[^}]*overflow-x: auto/);
  assert.doesNotMatch(styles, /from 'swiper|gsap|animejs/);
});

test('marquee travels exactly one group per cycle with no -50% jump or direction reversal', () => {
  const strip = fs.readFileSync(stripPath, 'utf8');
  const styles = fs.readFileSync(stylesPath, 'utf8');

  assert.doesNotMatch(styles, /animation-direction/, 'RTL must use mirrored keyframes so the cycle never starts shifted off-screen');
  const marqueeBlocks = styles.match(/@keyframes brand-strip-marquee(?:-rtl)? \{(?:[^{}]|\{[^{}]*\})*\}/g) || [];
  assert.equal(marqueeBlocks.length, 2, 'LTR and RTL marquee keyframes must both exist');
  for (const block of marqueeBlocks) {
    assert.doesNotMatch(block, /-50%/, 'loop distance must follow the group width, not half the track');
  }
  assert.match(
    styles,
    /@keyframes brand-strip-marquee \{\s*from \{ transform: translate3d\(0%, 0, 0\); \}\s*to \{ transform: translate3d\(calc\(-100% \/ var\(--strip-groups, 8\)\), 0, 0\); \}\s*\}/,
  );
  assert.match(
    styles,
    /@keyframes brand-strip-marquee-rtl \{\s*from \{ transform: translate3d\(0%, 0, 0\); \}\s*to \{ transform: translate3d\(calc\(100% \/ var\(--strip-groups, 8\)\), 0, 0\); \}\s*\}/,
  );
  assert.match(strip, /import \{ normalizeStripScroll, STRIP_GROUPS \} from '\.\.\/hooks\/stripScroll'/);
  assert.equal(STRIP_GROUPS, 8);
});

test('strip scroll stays inside the covered band so the viewport never empties', () => {
  const viewports = [320, 375, 390, 430, 760, 761, 900, 1100, 1101, 1440, 1920, 2560, 3840];

  for (const vw of viewports) {
    const cols = vw <= 760 ? 2.5 : vw <= 1100 ? 3.5 : 5;
    const pad = Math.min(56, Math.max(18, 0.04 * vw));
    const gap = 14;
    const step = (vw - pad * 2 - gap * 4) / cols + gap;
    const track = step * STRIP_GROUPS;
    const band = track - vw - step;

    assert.ok(band >= 0, `vw=${vw}: track (${track.toFixed(1)}) must cover viewport plus one travel step`);
    assert.ok(band >= step / 2, `vw=${vw}: safe band must absorb at least half a step`);

    for (const position of [0, 1, -1, band, -band, band + step * 3, -band - step * 5, track, -track]) {
      const clamped = clampStripScrollPosition(position, track, vw, step);
      assert.ok(clamped >= -band - 1e-6 && clamped <= band + 1e-6, `vw=${vw} pos=${position}: clamped ${clamped} outside band ±${band}`);
      const delta = position - clamped;
      assert.ok(Math.abs(delta / step - Math.round(delta / step)) < 1e-9, `vw=${vw} pos=${position}: snap must move by exact group multiples`);
      assert.ok(Math.abs(clamped) + step + vw <= track + 1e-6, `vw=${vw} pos=${position}: covered window plus travel must fit the track`);
      assert.equal(clampStripScrollPosition(clamped, track, vw, step), clamped, 'clamp must be idempotent');
    }
  }

  assert.equal(clampStripScrollPosition(50, 100, 200, 10), 0, 'no safe band means no manual offset');
  assert.equal(clampStripScrollPosition(0, 100, 200, 10), 0);
  assert.equal(clampStripScrollPosition(7, 100, 200, 0), 7, 'unmeasurable step keeps the position untouched');
});

test('autoplay keeps running while hovered and has no mouse pause handlers', () => {
  const strip = fs.readFileSync(stripPath, 'utf8');
  const styles = fs.readFileSync(stylesPath, 'utf8');

  assert.match(styles, /\.brand-strip__track \{[^}]*animation: brand-strip-marquee var\(--strip-duration\) linear infinite/);

  assert.doesNotMatch(styles, /\.brand-strip__viewport:hover/);
  assert.doesNotMatch(styles, /brand-strip[^{}]*hover[^{}]*\{[^}]*animation-play-state/);
  assert.doesNotMatch(styles, /\.brand-strip__track[^{}]*:hover/);

  const pausedRules = styles.match(/[^{}]*\{[^}]*animation-play-state: paused[^}]*\}/g) || [];
  const stripPausedRules = pausedRules.filter((rule) => rule.includes('brand-strip'));
  assert.equal(stripPausedRules.length, 1, 'only the manual interaction class may pause the rail');
  assert.match(stripPausedRules[0], /\.brand-strip__track\.is-paused/);
  assert.ok(!stripPausedRules[0].includes(':hover'));

  assert.doesNotMatch(strip, /pauseOnHover/);
  assert.doesNotMatch(strip, /onMouseEnter|onMouseLeave|onMouseOver|onMouseOut/);
  assert.doesNotMatch(strip, /onPointerEnter|onPointerLeave|onPointerOver/);
  assert.doesNotMatch(strip, /onWheel/);
  assert.doesNotMatch(strip, /mouseenter|mouseleave|mouseover|pointerenter/i);
});

test('featured strip spacing stays compact with no fixed blank-space sizing', () => {
  const strip = fs.readFileSync(stripPath, 'utf8');
  const styles = fs.readFileSync(stylesPath, 'utf8');

  const base = styles.match(/\.brand-strip \{[^}]*\}/)?.[0] || '';
  assert.ok(base, 'base strip rule missing');
  assert.doesNotMatch(base, /min-height|max-height|height:/);
  assert.match(base, /padding: 18px 0 22px/);

  assert.match(styles, /\.brand-strip__head \{[^}]*margin-bottom: 14px/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]{0,400}?\.brand-strip \{[^}]*padding: 14px 0 18px/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]{0,400}?\.brand-strip__head \{ margin-bottom: 10px; \}/);

  assert.match(styles, /\.brand-strip-card__media \{[^}]*aspect-ratio: 1 \/ 1/);
  assert.match(styles, /\.brand-strip-card__name \{[^}]*margin-top: 10px/);
  assert.match(styles, /\.brand-strip-card__price \{[^}]*margin-top: 4px/);
  assert.match(strip, /<Link\s+className="brand-strip-card"/);
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
