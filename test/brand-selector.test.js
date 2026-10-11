import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (relative) => fs.readFileSync(new URL(`../src/${relative}`, import.meta.url), 'utf8');

const productsPage = read('pages/ProductsPage.jsx');
const selector = read('components/BrandSelector.jsx');
const filterBar = read('components/ShopFilterBar.jsx');
const styles = read('styles.css');

test('brand selector sits between Home and the Filter card', () => {
  const homeAt = productsPage.indexOf('<PageNavigation');
  const selectorAt = productsPage.indexOf('<BrandSelector');
  const filterAt = productsPage.indexOf('<ShopFilterBar');
  assert.ok(homeAt >= 0 && selectorAt > homeAt && filterAt > selectorAt);
  assert.match(productsPage, /<BrandSelector activeSlug=\{state\.brand\} \/>/);
});

test('brand chips use existing brand routes and mark the active brand', () => {
  assert.match(selector, /velvetBrands/);
  assert.match(selector, /to=\{`\/products\?brand=\$\{encodeURIComponent\(brand\.slug\)\}`\}/);
  assert.match(selector, /brand-selector__chip\$\{active \? ' is-active' : ''\}/);
  assert.match(selector, /aria-current=\{active \? 'page' : undefined\}/);
  assert.match(styles, /\.brand-selector__row \{[^}]*flex-wrap:\s*nowrap[^}]*overflow-x:\s*auto/);
  assert.match(styles, /\.brand-selector__chip\.is-active \{[^}]*background:\s*var\(--red\)/);
});

test('category chip row is gone from the filter bar while subcategory filtering stays', () => {
  assert.doesNotMatch(filterBar, /shop-filter-quick-row|shop-filter-bar__quick-chip/);
  assert.match(filterBar, /key: 'subcategory'/);
  assert.match(filterBar, /shop-filter-panel/);
});
