import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  filterProducts,
  getBrand,
  getFilterGroup,
  getShopHierarchyOptions,
  velvetBrands,
} from '../src/data/velvetCatalog.js';
import {
  filterProductsForFacet,
  getAttributeFacetOptions,
  getAvailableFacetValues,
  getFacetCount,
  getFacetHierarchyOptions,
  getFacetOptions,
} from '../src/data/shopFacets.js';
import { translations } from '../src/i18n/translations.js';
import { SHOP_GRID_DENSITY_KEY, SHOP_GRID_DEFAULT_COLS } from '../src/hooks/useShopGridDensity.js';
import { EMPTY_SHOP_STATE } from '../src/hooks/shopQuery.js';

const productsPage = fs.readFileSync(new URL('../src/pages/ProductsPage.jsx', import.meta.url), 'utf8');
const filterBar = fs.readFileSync(new URL('../src/components/ShopFilterBar.jsx', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

const baseState = {
  ...EMPTY_SHOP_STATE,
  age: [],
  gender: [],
  skill: [],
  occasion: [],
  shopping: [],
};

test('zero-product brands are hidden from facet hierarchy', () => {
  const options = getFacetHierarchyOptions(baseState);
  const brandsWithProducts = velvetBrands.filter((brand) =>
    filterProducts({ ...baseState, brand: brand.slug }).length > 0,
  );
  assert.equal(options.brands.length, brandsWithProducts.length);
  assert.ok(options.brands.every((brand) =>
    filterProducts({ ...baseState, brand: brand.id }).length > 0,
  ));
});

test('BABY brand shows only populated main categories', () => {
  const state = { ...baseState, brand: 'collect' };
  const options = getFacetHierarchyOptions(state);
  const configured = getBrand('collect').categories.length;
  assert.ok(options.categories.length <= configured);
  assert.ok(options.categories.length > 0);
  assert.ok(options.categories.every((category) =>
    filterProducts({ ...state, category: category.id }).length > 0,
  ));
  assert.ok(!options.categories.some((category) => category.id === 'collectible-figures'));
});

test('empty main categories without products are hidden', () => {
  const state = { ...baseState, brand: 'collect' };
  const options = getFacetHierarchyOptions(state);
  const emptyConfigured = getBrand('collect').categories.filter((category) =>
    filterProducts({ ...state, category: category.slug }).length === 0,
  );
  emptyConfigured.forEach((category) => {
    assert.ok(!options.categories.some((item) => item.id === category.slug));
  });
});

test('main category shows only populated subcategories', () => {
  const state = { ...baseState, brand: 'collect', category: 'blind-boxes' };
  const options = getFacetHierarchyOptions(state);
  assert.ok(options.subcategories.length > 0);
  assert.ok(options.subcategories.every((sub) =>
    filterProducts({ ...state, subcategory: sub.id }).length > 0,
  ));
  assert.ok(options.subcategories.some((sub) => sub.id === 'mini-figures'));
});

test('age facets recalculate under active filters', () => {
  const state = { ...baseState, brand: 'collect', age: ['5-6y'] };
  const options = getAttributeFacetOptions(state, 'age', 'en');
  const counts = getAvailableFacetValues(state, 'age', 'age');
  const pool = filterProductsForFacet(state, 'age');
  assert.ok(pool.length > 0);
  assert.ok(options.every((opt) => counts[opt.id] > 0 || state.age.includes(opt.id)));
  const withGender = { ...state, gender: ['unisex'] };
  const narrowed = getAttributeFacetOptions(withGender, 'age', 'en');
  assert.ok(narrowed.length <= options.length);
});

test('gender facets recalculate under active filters', () => {
  const state = { ...baseState, brand: 'baby', category: 'baby-development' };
  const boysOnly = getAvailableFacetValues({ ...state, gender: ['boys'] }, 'gender', 'gender');
  const allGender = getAvailableFacetValues(state, 'gender', 'gender');
  assert.ok(Object.keys(allGender).length >= Object.keys(boysOnly).length);
});

test('skill facets recalculate under active filters', () => {
  const state = { ...baseState, brand: 'collect' };
  const allSkills = getAttributeFacetOptions(state, 'skill', 'en');
  const narrowed = getAttributeFacetOptions({ ...state, age: ['5-6y'] }, 'skill', 'en');
  assert.ok(narrowed.length <= allSkills.length);
});

test('occasion facets recalculate under active filters', () => {
  const state = { ...baseState, brand: 'kids' };
  const allOccasions = getAttributeFacetOptions(state, 'occasion', 'en');
  const narrowed = getAttributeFacetOptions({ ...state, gender: ['girls'] }, 'occasion', 'en');
  assert.ok(narrowed.length <= allOccasions.length);
});

test('quick shop facets recalculate under active filters', () => {
  const state = { ...baseState, brand: 'play' };
  const allShopping = getAttributeFacetOptions(state, 'shopping', 'en');
  const narrowed = getAttributeFacetOptions({ ...state, skill: ['creativity'] }, 'shopping', 'en');
  assert.ok(narrowed.length <= allShopping.length);
});

test('selected zero-count facet option remains visible', () => {
  const state = {
    ...baseState,
    brand: 'baby',
    category: 'baby-development',
    subcategory: 'sensory-toys',
  };
  assert.equal(filterProducts(state).length, 0);
  const hierarchy = getFacetHierarchyOptions(state);
  assert.ok(hierarchy.subcategories.some((sub) => sub.id === 'sensory-toys'));
  const subOptions = getFacetOptions(state, 'subcategory', 'en');
  assert.ok(subOptions.some((opt) => opt.id === 'sensory-toys'));
});

test('unselected zero-count facet options are hidden', () => {
  const state = { ...baseState, brand: 'baby' };
  const options = getFacetHierarchyOptions(state);
  const emptySubs = getBrand('baby').categories.flatMap((category) =>
    category.subs.filter((sub) =>
      filterProducts({ ...state, category: category.slug, subcategory: sub.slug }).length === 0,
    ),
  );
  emptySubs.forEach((sub) => {
    assert.ok(!options.subcategories.some((item) => item.id === sub.slug));
  });
});

test('available unselected facet options remain in the option list', () => {
  const state = { ...baseState, brand: 'create', gender: ['girls'] };
  const options = getAttributeFacetOptions(state, 'gender', 'en');
  const counts = getAvailableFacetValues(state, 'gender', 'gender');
  const availableUnselected = options.filter((opt) => !state.gender.includes(opt.id) && counts[opt.id] > 0);
  assert.ok(availableUnselected.length > 0);
  assert.ok(availableUnselected.some((opt) => opt.id === 'unisex'));
});

test('facet calculation excludes the active group selection', () => {
  const state = { ...baseState, brand: 'collect', age: ['5-6y'], gender: ['unisex'] };
  const skillCounts = getAvailableFacetValues(state, 'skill', 'skill');
  const pool = filterProductsForFacet(state, 'skill');
  const manual = {};
  pool.forEach((product) => {
    if (product.skill) manual[product.skill] = (manual[product.skill] || 0) + 1;
  });
  assert.deepEqual(skillCounts, manual);
  assert.ok(Object.keys(skillCounts).length > 0);
});

test('sort does not affect facet availability', () => {
  const plain = { ...baseState, brand: 'baby' };
  const sorted = { ...plain, sort: 'price-asc' };
  assert.deepEqual(
    getFacetHierarchyOptions(plain).categories.map((item) => item.id),
    getFacetHierarchyOptions(sorted).categories.map((item) => item.id),
  );
  assert.deepEqual(
    getAttributeFacetOptions(plain, 'age', 'en').map((item) => item.id),
    getAttributeFacetOptions(sorted, 'age', 'en').map((item) => item.id),
  );
});

test('getShopHierarchyOptions delegates to facet hierarchy', () => {
  const state = { ...baseState, brand: 'baby' };
  const fromCatalog = getShopHierarchyOptions(state);
  const fromFacets = getFacetHierarchyOptions(state);
  assert.deepEqual(fromCatalog.brands.map((b) => b.id), fromFacets.brands.map((b) => b.id));
  assert.deepEqual(fromCatalog.categories.map((c) => c.id), fromFacets.categories.map((c) => c.id));
});

test('grid density control renders in filter bar and products page', () => {
  assert.match(filterBar, /shop-grid-density/);
  assert.match(filterBar, /data-shop-grid-density/);
  assert.match(filterBar, /gridCols/);
  assert.match(productsPage, /useShopGridDensity/);
  assert.match(productsPage, /shop-products--pref-/);
  assert.match(productsPage, /data-shop-grid-cols/);
});

test('grid density CSS maps 2, 3, and 4 column preferences', () => {
  assert.match(styles, /\.shop-products--pref-2 \{[\s\S]*?repeat\(2,/);
  assert.match(styles, /\.shop-products--pref-3 \{[\s\S]*?repeat\(3,/);
  assert.match(styles, /\.shop-products--pref-4 \{[\s\S]*?repeat\(4,/);
});

test('grid density localStorage key and default are defined', () => {
  assert.equal(SHOP_GRID_DENSITY_KEY, 'velvet-shop-grid-cols');
  assert.equal(SHOP_GRID_DEFAULT_COLS, 4);
  const hookSource = fs.readFileSync(new URL('../src/hooks/useShopGridDensity.js', import.meta.url), 'utf8');
  assert.match(hookSource, /localStorage/);
});

test('mobile grid clamps to two columns while preserving preference class', () => {
  assert.match(styles, /@media \(max-width: 560px\)[\s\S]*\.shop-products--pref-4[\s\S]*?repeat\(2,/);
  assert.match(styles, /\.shop-grid-density \{ display: none; \}/);
});

test('grid density never exceeds four columns', () => {
  assert.match(styles, /\.shop-products--pref-4 \{[\s\S]*?repeat\(4,/);
  assert.doesNotMatch(styles, /\.shop-products--pref-5/);
  const hookSource = fs.readFileSync(new URL('../src/hooks/useShopGridDensity.js', import.meta.url), 'utf8');
  assert.match(hookSource, /MAX_COLS = 4/);
});

test('main filter surfaces use pure white backgrounds', () => {
  assert.match(styles, /\.shop-filter-bar \{[\s\S]*?background:\s*#FFFFFF/);
  assert.match(styles, /\.shop-filter-bar__row \{[\s\S]*?background:\s*#FFFFFF/);
  assert.match(styles, /\.shop-filter-panel \{[\s\S]*?background:\s*#FFFFFF/);
  assert.match(styles, /\.shop-filter-column \{[\s\S]*?background:\s*#FFFFFF/);
});

test('filter inactive siblings no longer use gray chip surfaces', () => {
  assert.match(styles, /\.shop-filter-column--has-selection \.filter-chip\.is-inactive \{[\s\S]*?background:\s*#FFFFFF/);
  assert.match(styles, /\.shop-filter-column--has-selection \.filter-option\.is-inactive \.filter-option__box \{[\s\S]*?background:\s*#FFFFFF/);
  assert.doesNotMatch(styles, /\.shop-filter-column[\s\S]*?#fafafa/);
});

test('filter bar avoids gray cast from heavy shadow', () => {
  assert.match(styles, /\.shop-filter-bar \{[\s\S]*?box-shadow:\s*none/);
});

test('grid density translations exist in EN and AR', () => {
  assert.equal(translations.en.shop.gridView, 'View');
  assert.equal(translations.en.shop.gridCols2, '2 columns');
  assert.equal(translations.en.shop.gridCols3, '3 columns');
  assert.equal(translations.en.shop.gridCols4, '4 columns');
  assert.equal(translations.ar.shop.gridView, 'العرض');
  assert.equal(translations.ar.shop.gridCols2, 'عمودان');
  assert.equal(translations.ar.shop.gridCols3, '3 أعمدة');
  assert.equal(translations.ar.shop.gridCols4, '4 أعمدة');
});

test('ShopFilterBar uses facet helpers instead of static counts', () => {
  assert.match(filterBar, /getFacetHierarchyOptions/);
  assert.match(filterBar, /getAttributeFacetOptions/);
  assert.doesNotMatch(filterBar, /getFilterCounts/);
  assert.doesNotMatch(filterBar, /getShopHierarchyOptions/);
});

test('getFacetCount returns expected product counts', () => {
  const state = { ...baseState, brand: 'baby' };
  const count = getFacetCount(state, 'brand', 'brand', 'baby');
  assert.equal(count, filterProducts({ ...baseState, brand: 'baby' }).length);
});

test('attribute facet options only include configured filter group ids', () => {
  const options = getAttributeFacetOptions(baseState, 'age', 'en');
  const configuredIds = new Set(getFilterGroup('age').map((item) => item.id));
  assert.ok(options.every((opt) => configuredIds.has(opt.id)));
});
