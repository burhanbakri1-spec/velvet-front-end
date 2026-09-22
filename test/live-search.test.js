import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { filterProducts, getProductBySlug } from '../src/data/velvetCatalog.js';
import { translations } from '../src/i18n/translations.js';

const searchDropdown = fs.readFileSync(new URL('../src/components/SearchDropdown.jsx', import.meta.url), 'utf8');
const header = fs.readFileSync(new URL('../src/components/Header.jsx', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const megaMenu = fs.readFileSync(new URL('../src/components/CategoriesMegaMenu.jsx', import.meta.url), 'utf8');
const productDetailsPage = fs.readFileSync(new URL('../src/pages/ProductDetailsPage.jsx', import.meta.url), 'utf8');

test('filterProducts supports live search matching by query text', () => {
  const base = filterProducts({ age: [], gender: [], skill: [], occasion: [], shopping: [] });
  assert.ok(base.length > 0, 'catalog should return products for empty filters');

  const target = base[0];
  const token = target.name
    .split(/\s+/)
    .find((word) => word.length >= 3);
  assert.ok(token, 'expected a searchable token (length >= 3) from the first product name');

  const matched = filterProducts({ search: token.toLowerCase(), age: [], gender: [], skill: [], occasion: [], shopping: [] });
  assert.ok(matched.length > 0, `expected at least one match for token "${token}"`);
  assert.ok(matched.some((product) => product.slug === target.slug), 'matched results should include the source product');
  assert.ok(matched.length <= base.length);
  for (const product of matched) {
    const haystack = `${product.name} ${product.nameAr || ''}`.toLowerCase();
    assert.ok(haystack.includes(token.toLowerCase()) || (product.tags || []).some((t) => String(t).toLowerCase().includes(token.toLowerCase())));
  }

  const none = filterProducts({ search: 'zzzzz-no-such-product', age: [], gender: [], skill: [], occasion: [], shopping: [] });
  assert.equal(none.length, 0);
});

test('getProductBySlug guards navigation to unknown products', () => {
  const anyProduct = filterProducts({ age: [], gender: [], skill: [], occasion: [], shopping: [] })[0];
  assert.ok(anyProduct, 'expected at least one product');
  assert.ok(getProductBySlug(anyProduct.slug), 'known slug should resolve');
  assert.equal(getProductBySlug('__definitely-missing-slug__'), null);
  assert.equal(getProductBySlug(undefined), null);
});

test('SearchDropdown source renders results, empty state and view-all', () => {
  assert.match(searchDropdown, /filterProducts\(\{ search: trimmed\.toLowerCase\(\) \}\)/);
  assert.match(searchDropdown, /results\.slice\(0, MAX_RESULTS\)/);
  assert.match(searchDropdown, /const MAX_RESULTS = 8;/);
  assert.match(searchDropdown, /role="listbox"/);
  assert.match(searchDropdown, /className="search-dropdown"/);
  assert.match(searchDropdown, /search-dropdown__result/);
  assert.match(searchDropdown, /search-dropdown__result-image/);
  assert.match(searchDropdown, /search-dropdown__result-name/);
  assert.match(searchDropdown, /search-dropdown__result-price/);
  assert.match(searchDropdown, /search-dropdown__empty/);
  assert.match(searchDropdown, /search-dropdown__view-all/);
  assert.match(searchDropdown, /viewAllResults/);
  assert.match(searchDropdown, /noSearchResults/);
  assert.match(searchDropdown, /if \(!trimmed \|\| dismissed\) return null/);
  assert.match(searchDropdown, /if \(!getProductBySlug\(slug\)\) return/);
  assert.match(searchDropdown, /event\.key === 'Escape'/);
  assert.match(searchDropdown, /mousedown/);
  assert.match(searchDropdown, /touchstart/);
  assert.match(searchDropdown, /setDismissed\(true\)/);
  assert.match(searchDropdown, /setDismissed\(false\)/);
  assert.match(searchDropdown, /totalMatchCount > MAX_RESULTS/);
  assert.match(searchDropdown, /focusin/);
  assert.match(searchDropdown, /\.header-search/);
});

test('ProductDetailsPage renders path hero from getPathHeroMedia before navigation', () => {
  assert.match(productDetailsPage, /getPathHeroMedia/);
  assert.match(productDetailsPage, /getPathHeroMedia\(routeProduct\)/);
  assert.match(productDetailsPage, /product-path-hero/);
  assert.match(productDetailsPage, /product-path-hero__media/);
  assert.match(productDetailsPage, /product-path-hero__fallback/);
  assert.match(productDetailsPage, /product-path-hero__copy/);
  assert.match(productDetailsPage, /<PageNavigation/);
  const heroIndex = productDetailsPage.indexOf('product-path-hero');
  const navIndex = productDetailsPage.indexOf('<PageNavigation');
  assert.ok(heroIndex !== -1 && navIndex !== -1 && heroIndex < navIndex, 'path hero must render before PageNavigation');
});

test('product-path-hero matches category banner no-crop framing', () => {
  assert.match(styles, /\.product-path-hero\s*\{[\s\S]*?width:\s*100%/);
  assert.match(styles, /\.product-path-hero\s*\{[\s\S]*?height:\s*auto/);
  assert.match(styles, /\.product-path-hero\s*\{[\s\S]*?overflow:\s*visible/);
  assert.match(styles, /\.product-path-hero__media[\s\S]*?object-fit:\s*contain/);
  assert.doesNotMatch(styles, /\.product-path-hero__media[^}]*object-fit:\s*cover/);
  assert.doesNotMatch(styles, /\.product-path-hero\s*\{[^}]*aspect-ratio:/);
});

test('mobile storefront banners raise presence without cropping media', () => {
  assert.doesNotMatch(styles, /min-height:\s*min\(68svh/);
  assert.doesNotMatch(styles, /#showcases \.brand-showcase\.brand-showcase--full-banner[\s\S]{0,120}?padding-block-end:\s*22%/);
  assert.doesNotMatch(styles, /bottom:\s*calc\(22px \+ 5\.5vw\)/);
  // Homepage full-banner: wrapper matches image height (no presence pad / gray band).
  const fullBannerRules = styles.match(/\.brand-showcase\.brand-showcase--full-banner\s*\{[^}]+\}/g) || [];
  assert.ok(fullBannerRules.some((rule) => /padding-block-end:\s*0/.test(rule)), 'full-banner should zero out presence pad');
  assert.ok(fullBannerRules.every((rule) => !/padding-block-end:\s*5\.5%/.test(rule)), 'full-banner must not keep 5.5% presence pad');
  assert.match(styles, /#showcases\s*\{[^}]*gap:\s*0/);
  assert.match(styles, /#showcases\s*\{[^}]*margin-block:\s*0/);
  // Brand / category / PDP heroes keep soft presence padding.
  assert.match(styles, /\.category-hero,[\s\S]{0,80}?\.product-path-hero\s*\{[\s\S]{0,220}?padding-block-end:\s*5\.5%/);
  assert.match(styles, /\.product-path-hero\s*\{[\s\S]{0,160}?padding-block-end:\s*5\.5%/);
  assert.match(styles, /\.category-hero__media[\s\S]{0,160}?object-fit:\s*contain/);
  assert.match(styles, /\.brand-showcase__content\s*\{[\s\S]{0,160}?bottom:\s*22px\s*!important/);
  assert.match(styles, /\.showcase-more\s*\{[^}]*bottom:\s*22px/);
  assert.doesNotMatch(styles, /@media \(max-width:\s*768px\)[\s\S]*?\.product-path-hero\s*\{\s*height:\s*200px/);
  assert.doesNotMatch(styles, /@media \(max-width:\s*390px\)[\s\S]*?\.product-path-hero\s*\{\s*height:\s*180px/);
});

test('Header wraps search form + SearchDropdown in relative container', () => {
  assert.match(header, /className="header-search"/);
  assert.match(header, /className="header-search header-search--mobile"/);
  assert.match(header, /<SearchDropdown query=\{search\} setQuery=\{setSearch\} \/>/);
  const desktop = header.match(/<div className="header-search">[\s\S]*?<\/div>/);
  assert.ok(desktop, 'desktop search wrapper expected');
  assert.match(desktop[0], /search-pill/);
  assert.match(desktop[0], /SearchDropdown/);
});

test('search-dropdown styles provide absolute panel under search field', () => {
  assert.match(styles, /\.search-dropdown\s*\{/);
  assert.match(styles, /\.search-dropdown\s*\{[^}]*position:\s*absolute/);
  assert.match(styles, /\.search-dropdown\s*\{[^}]*z-index:\s*\d+/);
  assert.match(styles, /\.search-dropdown__results/);
  assert.match(styles, /\.search-dropdown__result\s*\{/);
  assert.match(styles, /\.search-dropdown__result[\s\S]*?display:\s*flex/);
  assert.match(styles, /\.search-dropdown__result-image\s*\{/);
  assert.match(styles, /\.search-dropdown__empty\s*\{/);
  assert.match(styles, /\.search-dropdown__view-all\s*\{/);
  assert.match(styles, /\.header-search\s*\{\s*position:\s*relative/);
});

test('mega menu logo scales the img, not the frame, and frame stays absolute corner', () => {
  assert.match(megaMenu, /style=\{\{ '--brand-logo-scale': logoScale \}\}/);
  assert.match(megaMenu, /className=\{`brand-logo mega-menu__preview-logo/);
  const frameSpan = megaMenu.match(/className=\{`brand-logo-frame mega-menu__preview-logo-frame[^`]*`\}[\s\S]{0,200}?style=/);
  assert.equal(frameSpan, null, 'scale style must not remain on the frame span');
  assert.match(styles, /\.brand-logo-frame\.mega-menu__preview-logo-frame\s*\{[\s\S]*?position:\s*absolute/);
  assert.match(styles, /\.brand-logo-frame\.mega-menu__preview-logo-frame\s*\{[\s\S]*?top:\s*24px/);
  assert.match(styles, /\.brand-logo-frame\.mega-menu__preview-logo-frame\s*\{[\s\S]*?transform:\s*none/);
  assert.match(styles, /\.brand-logo\.mega-menu__preview-logo\s*\{[\s\S]*?transform:\s*scale\(var\(--brand-logo-scale/);
  assert.match(styles, /\.brand-logo-frame::before\s*\{/);
  assert.match(styles, /backdrop-filter:\s*blur\(8px\)/);
  assert.match(styles, /html\[dir="rtl"\] \.brand-logo-frame\.mega-menu__preview-logo-frame/);
  assert.match(styles, /html\[dir="rtl"\] \.brand-logo\.mega-menu__preview-logo/);
});

test('live search i18n keys exist in en and ar', () => {
  assert.equal(translations.en.products.viewAllResults, 'View all results');
  assert.equal(translations.en.products.noSearchResults, 'No products found.');
  assert.equal(translations.ar.products.viewAllResults, 'عرض كل النتائج');
  assert.equal(translations.ar.products.noSearchResults, 'لم نعثر على منتجات.');
  assert.ok(translations.en.products.emptyTitle);
  assert.ok(translations.en.products.emptyBody);
  assert.ok(translations.en.products.showAll);
  assert.ok(translations.ar.products.emptyTitle);
  assert.ok(translations.ar.products.emptyBody);
  assert.ok(translations.ar.products.showAll);
  assert.ok(translations.en.header.searchLabel);
  assert.ok(translations.ar.header.searchLabel);
});
