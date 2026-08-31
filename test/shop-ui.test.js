import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  filterGroups,
  filterProducts,
  getActiveFilterTags,
  getBrandLogo,
  getBrandMedia,
  getShopHierarchyOptions,
  sortProducts,
  velvetBrands,
} from '../src/data/velvetCatalog.js';
import { translations } from '../src/i18n/translations.js';
import {
  EMPTY_SHOP_STATE,
  buildShopQuery,
  parseShopState,
  selectPathKey,
} from '../src/hooks/shopQuery.js';

const productsPage = fs.readFileSync(new URL('../src/pages/ProductsPage.jsx', import.meta.url), 'utf8');
const filterBar = fs.readFileSync(new URL('../src/components/ShopFilterBar.jsx', import.meta.url), 'utf8');
const megaMenu = fs.readFileSync(new URL('../src/components/CategoriesMegaMenu.jsx', import.meta.url), 'utf8');
const shopState = fs.readFileSync(new URL('../src/hooks/useShopState.js', import.meta.url), 'utf8');
const shopQuery = fs.readFileSync(new URL('../src/hooks/shopQuery.js', import.meta.url), 'utf8');

const baseState = {
  ...EMPTY_SHOP_STATE,
  age: [],
  gender: [],
  skill: [],
  occasion: [],
  shopping: [],
};

test('ProductsPage uses the horizontal filter bar and no longer renders a sidebar', () => {
  assert.match(productsPage, /ShopFilterBar/);
  assert.match(productsPage, /data-shop-filter-bar|resultCount=/);
  assert.doesNotMatch(productsPage, /shop-filters/);
  assert.doesNotMatch(productsPage, /shop-page__grid/);
  assert.doesNotMatch(productsPage, /ProductFilters/);
  assert.doesNotMatch(productsPage, /MobileFilterDrawer/);
  assert.match(productsPage, /setSort/);
});

test('expanded filter groups use existing VELVET attributes', () => {
  ['age', 'gender', 'skill', 'occasion', 'shopping'].forEach((key) => {
    assert.match(filterBar, new RegExp(`key: '${key}'`));
    assert.ok(filterGroups[key].length > 0);
  });
  assert.doesNotMatch(filterBar, /Shoe color|Material|Size/);
});

test('Brand, Main Category and Subcategory filter groups render in the shop filter bar', () => {
  assert.match(filterBar, /key: 'brand'/);
  assert.match(filterBar, /key: 'category'/);
  assert.match(filterBar, /key: 'subcategory'/);
  assert.match(filterBar, /labelKey: 'mainCategory'/);
  assert.match(filterBar, /getFacetHierarchyOptions/);
  assert.match(filterBar, /shop-filter-panel__groups--hierarchy/);
  assert.match(productsPage, /onSelect=\{select\}/);
});

test('selected filters become removable chips and removing a chip updates shop state', () => {
  const tags = getActiveFilterTags({ age: ['3-4y', '5-6y'], gender: ['girls'], skill: [], occasion: [], shopping: [] }, 'en');
  assert.deepEqual(tags.map((tag) => tag.label).sort(), ['3–4 Years', '5–6 Years', 'Girls']);
  const remaining = tags.filter((tag) => !(tag.groupKey === 'age' && tag.id === '3-4y'));
  assert.deepEqual(remaining.map((tag) => tag.id).sort(), ['5-6y', 'girls']);
  assert.match(filterBar, /onRemove\(tag\.groupKey, tag\.id\)/);
});

test('shop URL state preserves filters and sort', () => {
  assert.match(shopQuery, /params\.set\('sort', state\.sort\)/);
  assert.match(shopQuery, /params\.get\('sort'\)/);
  assert.match(shopQuery, /params\.set\('age', state\[key\]\.join\(','\)\)|MULTI_KEYS/);
  assert.match(shopState, /buildShopQuery/);
  assert.match(productsPage, /state\.sort/);
});

test('sortProducts orders by price without changing filter membership', () => {
  const sorted = sortProducts([{ price: 20, id: 'b' }, { price: 10, id: 'a' }], 'price-asc');
  assert.deepEqual(sorted.map((item) => item.id), ['a', 'b']);
});

test('Categories mega menu is brand-first and omits the category column', () => {
  assert.match(megaMenu, /data-mega-brand-list/);
  assert.match(megaMenu, /getBrandLogo/);
  assert.match(megaMenu, /getBrandMedia/);
  assert.match(megaMenu, /mega-menu__preview-brand/);
  assert.match(megaMenu, /mega-menu__preview-visual/);
  assert.match(megaMenu, /mega-menu__preview-logo/);
  assert.doesNotMatch(megaMenu, /mega-menu__preview-wordmark/);
  assert.match(megaMenu, /localizePath\(`\/brands\/\$\{slug\}`/);
  assert.doesNotMatch(megaMenu, /copy\.shop\.category/);
  assert.doesNotMatch(megaMenu, /copy\.shop\.subcategory/);
  assert.doesNotMatch(megaMenu, /goCategory/);
  assert.ok(velvetBrands.some((brand) => brand.slug === 'baby'));
});

test('Categories mega menu logo and poster resolve for each brand', () => {
  for (const slug of ['baby', 'kids', 'play']) {
    const logo = getBrandLogo(slug, 'en');
    const poster = getBrandMedia(slug).poster;
    assert.ok(logo, `expected logo for ${slug}`);
    assert.ok(poster, `expected poster for ${slug}`);
    assert.notEqual(logo, poster, `logo and poster must differ for ${slug}`);
  }
  assert.notEqual(getBrandLogo('baby', 'en'), getBrandLogo('play', 'en'));
});

test('selecting Brand updates URL and scopes Main Category options', () => {
  const next = selectPathKey(baseState, 'brand', 'collect');
  assert.equal(buildShopQuery(next), 'brand=collect');
  const options = getShopHierarchyOptions(next);
  assert.ok(options.brands.some((brand) => brand.id === 'collect'));
  assert.ok(options.categories.some((category) => category.id === 'blind-boxes'));
  assert.ok(options.categories.every((category) => category.id !== 'collectible-figures'));
  assert.equal(options.subcategories.length, 0);
});

test('selecting Main Category updates URL and scopes Subcategory options', () => {
  const next = selectPathKey({ ...baseState, brand: 'collect' }, 'category', 'blind-boxes');
  assert.equal(buildShopQuery(next), 'brand=collect&category=blind-boxes');
  const options = getShopHierarchyOptions(next);
  assert.ok(options.subcategories.some((sub) => sub.id === 'mini-figures'));
  assert.ok(options.subcategories.some((sub) => sub.id === 'mystery-boxes'));
});

test('selecting Subcategory updates URL', () => {
  const next = selectPathKey(
    { ...baseState, brand: 'baby', category: 'baby-development' },
    'subcategory',
    'sensory-toys',
  );
  assert.equal(buildShopQuery(next), 'brand=baby&category=baby-development&subcategory=sensory-toys');
});

test('existing query params initialize hierarchy filters', () => {
  const parsed = parseShopState('?brand=baby&category=baby-development&subcategory=sensory-toys&age=3-4y');
  assert.equal(parsed.brand, 'baby');
  assert.equal(parsed.category, 'baby-development');
  assert.equal(parsed.subcategory, 'sensory-toys');
  assert.deepEqual(parsed.age, ['3-4y']);
});

test('Brand, Main Category and Subcategory chips render localized labels and remove correctly', () => {
  const state = {
    ...baseState,
    brand: 'baby',
    category: 'baby-development',
    subcategory: 'sensory-toys',
    age: ['3-4y'],
  };
  const enTags = getActiveFilterTags(state, 'en');
  assert.deepEqual(
    enTags.map((tag) => `${tag.groupKey}:${tag.label}`),
    ['brand:VELVET BABY', 'category:Baby Development', 'subcategory:Sensory Toys', 'age:3–4 Years'],
  );
  const arTags = getActiveFilterTags(state, 'ar');
  assert.equal(arTags[0].label, 'VELVET BABY');
  assert.equal(arTags[1].label, 'تنمية الطفل');
  assert.equal(arTags[2].label, 'ألعاب حسية');
  assert.ok(!enTags.some((tag) => tag.label.includes('baby-development') || tag.label.includes('sensory-toys')));

  const withoutSub = selectPathKey(state, 'subcategory', '');
  assert.equal(withoutSub.subcategory, '');
  assert.equal(withoutSub.category, 'baby-development');
  assert.equal(withoutSub.brand, 'baby');
  assert.deepEqual(withoutSub.age, ['3-4y']);

  const withoutCategory = selectPathKey(state, 'category', '');
  assert.equal(withoutCategory.category, '');
  assert.equal(withoutCategory.subcategory, '');
  assert.equal(withoutCategory.brand, 'baby');
  assert.deepEqual(withoutCategory.age, ['3-4y']);

  const withoutBrand = selectPathKey(state, 'brand', '');
  assert.equal(withoutBrand.brand, '');
  assert.equal(withoutBrand.category, 'baby-development');
  assert.equal(withoutBrand.subcategory, 'sensory-toys');
  assert.deepEqual(withoutBrand.age, ['3-4y']);
});

test('changing Brand clears incompatible Category/Subcategory and keeps unrelated filters', () => {
  const next = selectPathKey({
    ...baseState,
    brand: 'baby',
    category: 'baby-development',
    subcategory: 'sensory-toys',
    age: ['3-4y'],
    gender: ['girls'],
    skill: ['creativity'],
    occasion: ['birthday'],
    shopping: ['new'],
  }, 'brand', 'kids');
  assert.equal(next.brand, 'kids');
  assert.equal(next.category, '');
  assert.equal(next.subcategory, '');
  assert.deepEqual(next.age, ['3-4y']);
  assert.deepEqual(next.gender, ['girls']);
  assert.deepEqual(next.skill, ['creativity']);
  assert.deepEqual(next.occasion, ['birthday']);
  assert.deepEqual(next.shopping, ['new']);
});

test('changing Category clears incompatible Subcategory and keeps unrelated filters', () => {
  const next = selectPathKey({
    ...baseState,
    brand: 'baby',
    category: 'baby-development',
    subcategory: 'sensory-toys',
    age: ['3-4y'],
    gender: ['unisex'],
  }, 'category', 'rattles-and-teethers');
  assert.equal(next.category, 'rattles-and-teethers');
  assert.equal(next.subcategory, '');
  assert.equal(next.brand, 'baby');
  assert.deepEqual(next.age, ['3-4y']);
  assert.deepEqual(next.gender, ['unisex']);
});

test('product count respects combined hierarchy and attribute filters', () => {
  const collect = filterProducts({ ...baseState, brand: 'collect' });
  const blindBoxes = filterProducts({ ...baseState, brand: 'collect', category: 'blind-boxes' });
  const miniFigures = filterProducts({
    ...baseState, brand: 'collect', category: 'blind-boxes', subcategory: 'mini-figures',
  });
  const miniAge = filterProducts({
    ...baseState, brand: 'collect', category: 'blind-boxes', subcategory: 'mini-figures', age: ['5-6y'],
  });
  assert.ok(collect.length > 0);
  assert.ok(blindBoxes.length > 0 && blindBoxes.length <= collect.length);
  assert.ok(miniFigures.length > 0 && miniFigures.length <= blindBoxes.length);
  assert.ok(miniAge.length <= miniFigures.length);
  assert.ok(miniFigures.every((product) => product.velvetPath.brandId === 'collect'));
  assert.ok(miniFigures.every((product) => product.velvetPath.categoryId === 'blind-boxes'));
  assert.ok(miniFigures.every((product) => product.velvetPath.subcategoryId === 'mini-figures'));

  // Empty taxonomy nodes remain available and simply return no products.
  assert.equal(filterProducts({
    ...baseState, brand: 'baby', category: 'baby-development', subcategory: 'sensory-toys',
  }).length, 0);
});

test('expanded filter option lists do not stretch sibling columns to full catalog height', () => {
  const styles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(styles, /shop-filter-panel__groups \{[\s\S]*?align-items:\s*start/);
  assert.match(styles, /\.shop-filter-column \.filter-group__opts \{[\s\S]*?max-height:\s*min\(260px, 40vh\)/);
  assert.match(styles, /\.shop-filter-column \.filter-group__opts \{[\s\S]*?overflow-y:\s*auto/);
});

test('active filter groups de-emphasize unselected siblings without disabling them', () => {
  assert.match(filterBar, /shop-filter-column--has-selection/);
  assert.match(filterBar, /data-has-selection=\{hasSelection \|\| undefined\}/);
  assert.match(filterBar, /is-inactive/);
  assert.match(filterBar, /hasSelection && !active/);
  const styles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(styles, /\.shop-filter-column--has-selection \.filter-option\.is-inactive/);
  assert.match(styles, /\.shop-filter-column--has-selection \.filter-chip\.is-inactive/);
  assert.match(styles, /\.filter-option\.is-inactive:hover/);
  assert.match(styles, /\.shop-filter-column--has-selection \.filter-option\.is-inactive[\s\S]*?cursor:\s*pointer/);
  assert.doesNotMatch(filterBar, /disabled=\{true\}|aria-disabled/);
});

test('hierarchy cascading and URL behavior remain unchanged after filter visual states', () => {
  const next = selectPathKey({
    ...baseState,
    brand: 'baby',
    category: 'baby-development',
    subcategory: 'sensory-toys',
    age: ['3-4y'],
  }, 'brand', 'kids');
  assert.equal(next.brand, 'kids');
  assert.equal(next.category, '');
  assert.equal(next.subcategory, '');
  assert.deepEqual(next.age, ['3-4y']);
  assert.equal(buildShopQuery(next), 'brand=kids&age=3-4y');
});

test('shop filter hierarchy labels are localized in EN and AR', () => {
  assert.equal(translations.en.shop.brand, 'Brand');
  assert.equal(translations.en.shop.mainCategory, 'Main Category');
  assert.equal(translations.en.shop.subcategory, 'Subcategory');
  assert.equal(translations.ar.shop.brand, 'البراند');
  assert.equal(translations.ar.shop.mainCategory, 'القسم الرئيسي');
  assert.equal(translations.ar.shop.subcategory, 'القسم الفرعي');
});
