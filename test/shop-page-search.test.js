import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { buildShopQuery, parseShopState } from '../src/hooks/shopQuery.js';

const read = (relative) => fs.readFileSync(new URL(`../src/${relative}`, import.meta.url), 'utf8');

const filterBar = read('components/ShopFilterBar.jsx');
const productsPage = read('pages/ProductsPage.jsx');
const styles = read('styles.css');
const header = read('components/Header.jsx');
const useShopState = read('hooks/useShopState.js');
const shopQuery = read('hooks/shopQuery.js');

test('mobile Shop page has a product search field next to the Filter control', () => {
  assert.match(filterBar, /className="shop-filter-bar__row shop-filter-bar__row--filter"/);
  const row = filterBar.match(/<div className="shop-filter-bar__row shop-filter-bar__row--filter">[\s\S]*?\n\s*<\/div>/)?.[0];
  assert.ok(row, 'filter row missing');

  assert.match(row, /shop-filter-bar__toggle/);
  assert.match(row, /type="search"/);
  assert.match(row, /className="shop-filter-bar__search"/);
  assert.ok(
    row.indexOf('shop-filter-bar__toggle') < row.indexOf('shop-filter-bar__search'),
    'Filter precedes Search so RTL renders Filter on the right, Search on the left'
  );

  assert.match(
    styles,
    /@media \(max-width: 760px\) \{\s*\.shop-filter-bar__row\.shop-filter-bar__row--filter \{[^}]*flex-wrap: nowrap;[^}]*\}/,
    'same row must not wrap on mobile'
  );
  assert.match(
    styles,
    /@media \(max-width: 760px\)[\s\S]{0,500}?\.shop-filter-bar__search \{[^}]*display: flex;[^}]*flex: 1 1 auto;[^}]*min-width: 0;/,
    'search takes the remaining width on mobile'
  );
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]{0,900}?\.shop-filter-bar__search-input \{[^}]*min-height: 44px;/);
  assert.match(styles, /\.shop-filter-bar__toggle \{[^}]*min-height: 44px;/, 'search and Filter share balanced height');
});

test('drawer/menu search remains unchanged', () => {
  assert.match(header, /className="header-search header-search--mobile"/);
  assert.match(header, /id="mobile-header-search"/);
  assert.match(header, /className="mobile-drawer__search"/);
  assert.equal((header.match(/<SearchDropdown /g) || []).length, 2, 'header + drawer SearchDropdowns stay in place');
  assert.doesNotMatch(filterBar, /mobile-drawer|mobile-header-search|SearchDropdown/);
  assert.doesNotMatch(productsPage, /SearchDropdown|mobile-header-search/);
});

test('Shop-page search reuses the existing product query/filter state', () => {
  assert.match(productsPage, /setSearch, setSort, clearGroup/);
  assert.match(productsPage, /onSearchChange=\{setSearch\}/);
  assert.match(filterBar, /value=\{state\.search \|\| ''\}/);
  assert.match(filterBar, /onChange=\{\(event\) => onSearchChange\?\.\(event\.target\.value\)\}/);
  assert.match(useShopState, /const setSearch = useCallback/);
  assert.match(useShopState, /search: value/);
  assert.match(shopQuery, /params\.get\('search'\)/, 'search is parsed from the same URL shop state');

  const state = parseShopState(buildShopQuery({ brand: 'collect', search: 'pocket' }));
  assert.equal(state.brand, 'collect');
  assert.equal(state.search, 'pocket');
});

test('Filter control keeps its existing behavior', () => {
  assert.match(filterBar, /aria-expanded=\{open\}/);
  assert.match(filterBar, /onClick=\{\(\) => setOpen\(\(value\) => !value\)\}/);
  assert.match(filterBar, /\{open && \(\s*<div className="shop-filter-panel"/);
  assert.match(filterBar, /onChange=\{\(event\) => onSortChange\(event\.target\.value\)\}/);
  assert.match(filterBar, /GridDensityControl/);
  assert.match(filterBar, /shop-filter-bar__quick-chip/);
});

test('exactly one Shop-page search control, no duplicates', () => {
  assert.equal((filterBar.match(/type="search"/g) || []).length, 1);
  assert.equal((productsPage.match(/type="search"|shop-filter-bar__search/g) || []).length, 0);
  assert.doesNotMatch(productsPage, /<input/);
});

test('desktop Shop layout unchanged: search hidden outside mobile', () => {
  assert.match(styles, /\.shop-filter-bar__search \{ display: none; \}/, 'search is hidden by default (desktop)');
  assert.doesNotMatch(
    styles,
    /@media \(min-width: [^)]+\)[\s\S]{0,400}?\.shop-filter-bar__search \{[^}]*display: flex/,
    'search must never appear on desktop'
  );
  assert.match(styles, /\.shop-filter-bar__row \{[\s\S]{0,200}?flex-wrap: wrap;/, 'desktop row keeps its wrap behavior');
  assert.doesNotMatch(productsPage, /@media|matchMedia/, 'page does not branch on viewport');
});
