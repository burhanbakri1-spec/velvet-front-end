import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const i18n = fs.readFileSync(new URL('../src/i18n/I18nContext.jsx', import.meta.url), 'utf8');
const header = fs.readFileSync(new URL('../src/components/Header.jsx', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const carousel = fs.readFileSync(new URL('../src/components/ProductDetailInfoCarousel.jsx', import.meta.url), 'utf8');
const filterBar = fs.readFileSync(new URL('../src/components/ShopFilterBar.jsx', import.meta.url), 'utf8');
const router = fs.readFileSync(new URL('../src/routing/Router.jsx', import.meta.url), 'utf8');

test('language switch preserves path, search, and hash without scrolling home', () => {
  assert.match(i18n, /stripLocalePrefix\(location\.pathname\)/);
  assert.match(i18n, /localizePath\(basePath, nextLocale\)/);
  assert.match(i18n, /location\.search/);
  assert.match(i18n, /location\.hash/);
  assert.match(i18n, /scroll:\s*false/);
  assert.doesNotMatch(i18n, /navigate\(\s*['"`]\/['"`]/);
});

test('router helpers strip and re-prefix locales for the same route', () => {
  assert.match(router, /export function stripLocalePrefix/);
  assert.match(router, /export function localizePath/);
  assert.match(router, /`\/\$\{locale\}\$\{url\.pathname\}`/);
  assert.match(router, /pathname === '\/' \? `\/\$\{locale\}`/);
});

test('mobile header uses logo | controls | hamburger edges for LTR/RTL', () => {
  assert.match(styles, /@media \(max-width:\s*900px\)[\s\S]{0,500}?grid-template-columns:\s*auto 1fr auto/);
  assert.match(header, /menu-toggle/);
  assert.match(header, /language-control--header/);
  assert.match(header, /nav-link--shop/);
  assert.match(header, /copy\.header\.shop/);
});

test('main logo is +9% larger without CSS plate clipping', () => {
  assert.match(styles, /max-width:\s*161px/);
  assert.match(styles, /max-height:\s*61px/);
  assert.doesNotMatch(styles, /\.logo--velvet-badge::before/);
  assert.doesNotMatch(styles, /\.logo--velvet-badge::after/);
  assert.doesNotMatch(styles, /\.logo--velvet-badge[\s\S]{0,80}?overflow:\s*clip/);
});

test('PDP carousel supports click-to-center and swipe', () => {
  assert.match(carousel, /onCardActivate/);
  assert.match(carousel, /goTo\(cardIndex\)/);
  assert.match(carousel, /onPointerDown/);
  assert.match(carousel, /onPointerMove/);
  assert.match(carousel, /product-detail-carousel__dot/);
});

test('density icons use 2x2 / 3x2 / 4x2 SVG squares', () => {
  assert.match(filterBar, /function DensityIcon/);
  assert.match(filterBar, /cols \* rows/);
  assert.match(filterBar, /fill="currentColor"/);
  assert.doesNotMatch(filterBar, /shop-grid-density__btn-label/);
  assert.doesNotMatch(filterBar, /shop-grid-density__text/);
});
