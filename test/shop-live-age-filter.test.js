import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getProductAgeIds,
  normalizeAgeIdsFromRaw,
  productMatchesAgeFilter,
} from '../src/data/ageFilter.js';
import { applyPlatformContent } from '../src/data/platformContent.js';
import {
  filterProducts,
  getFilterGroup,
  resetFilterDefinitionsForTests,
} from '../src/data/velvetCatalog.js';
import {
  getAttributeFacetOptions,
  getAvailableFacetValues,
} from '../src/data/shopFacets.js';
import { buildShopQuery, EMPTY_SHOP_STATE, parseShopState } from '../src/hooks/shopQuery.js';

const API = 'https://api.test';

const LIVE_AGE_DEFINITIONS = [
  { id: '0-3y', label: { en: '0–3 Years', ar: 'من 0 ل 3 سنوات' } },
  { id: '3-6y', label: { en: '3–6 Years', ar: 'من 3 ل 6 سنوات' } },
  { id: '6-10y', label: { en: '6–10 Years', ar: 'من 6 ل 10 سنوات' } },
];

function liveAgePayload() {
  return {
    site: { id: 'kids-velvet-storefront', companyId: 'kids-velvet' },
    brands: [{
      id: 'b-live',
      slug: 'velvet-live-age',
      name: { en: 'VELVET LIVE AGE', ar: 'VELVET LIVE AGE' },
      sortOrder: 1,
    }],
    categories: [
      {
        id: 'c-live',
        slug: 'live-main',
        name: { en: 'Live Main', ar: 'Live Main' },
        parentId: null,
        brandId: 'b-live',
        sortOrder: 1,
      },
      {
        id: 's-live',
        slug: 'live-sub',
        name: { en: 'Live Sub', ar: 'Live Sub' },
        parentId: 'c-live',
        brandId: 'b-live',
        sortOrder: 1,
      },
    ],
    filterDefinitions: { age: LIVE_AGE_DEFINITIONS },
    products: [
      {
        id: 'live-age-single',
        slug: 'single-age-toy',
        name: { en: 'Single Age', ar: 'عمر واحد' },
        price: 10,
        brandId: 'b-live',
        mainCategoryId: 'c-live',
        subcategoryId: 's-live',
        filterAttributes: {
          age: [{ id: '3-6y', label: { en: '3–6 Years', ar: 'من 3 ل 6 سنوات' } }],
        },
      },
      {
        id: 'live-age-multi',
        slug: 'multi-age-toy',
        name: { en: 'Multi Age', ar: 'أعمار متعددة' },
        price: 20,
        brandId: 'b-live',
        mainCategoryId: 'c-live',
        subcategoryId: 's-live',
        filterAttributes: {
          age: [
            { id: '3-6y', label: { en: '3–6 Years', ar: 'من 3 ل 6 سنوات' } },
            { id: '6-10y', label: { en: '6–10 Years', ar: 'من 6 ل 10 سنوات' } },
          ],
        },
      },
      {
        id: 'live-age-none',
        slug: 'no-age-toy',
        name: { en: 'No Age', ar: 'بدون عمر' },
        price: 30,
        brandId: 'b-live',
        mainCategoryId: 'c-live',
        subcategoryId: 's-live',
        filterAttributes: { age: [] },
      },
      {
        id: 'live-age-legacy',
        slug: 'legacy-age-toy',
        name: { en: 'Legacy Age', ar: 'عمر قديم' },
        price: 40,
        brandId: 'b-live',
        mainCategoryId: 'c-live',
        subcategoryId: 's-live',
        age: '0-3y',
      },
    ],
    texts: [],
    media: [],
  };
}

function loadLiveCatalog() {
  applyPlatformContent(liveAgePayload(), API);
}

test.beforeEach(() => {
  resetFilterDefinitionsForTests();
});

test('normalizeAgeIdsFromRaw reads filterAttributes.age ids', () => {
  const ids = normalizeAgeIdsFromRaw({
    filterAttributes: {
      age: [
        { id: '3-6y', label: { en: '3–6 Years', ar: 'من 3 ل 6 سنوات' } },
        { id: '6-10y', label: { en: '6–10 Years', ar: 'من 6 ل 10 سنوات' } },
      ],
    },
  });
  assert.deepEqual(ids, ['3-6y', '6-10y']);
});

test('normalizeAgeIdsFromRaw falls back to flat product.age', () => {
  assert.deepEqual(normalizeAgeIdsFromRaw({ age: '0-3y' }), ['0-3y']);
  assert.deepEqual(normalizeAgeIdsFromRaw({}), []);
});

test('applyFilterDefinitions uses API filterDefinitions.age', () => {
  loadLiveCatalog();
  const options = getFilterGroup('age');
  assert.equal(options.length, 3);
  assert.equal(options[0].id, '0-3y');
  assert.equal(options[1].name.en, '3–6 Years');
});

test('English age labels come from API definitions', () => {
  loadLiveCatalog();
  const options = getAttributeFacetOptions({ ...EMPTY_SHOP_STATE }, 'age', 'en');
  const match = options.find((opt) => opt.id === '3-6y');
  assert.ok(match);
  assert.equal(match.label, '3–6 Years');
});

test('Arabic age labels come from API definitions', () => {
  loadLiveCatalog();
  const options = getAttributeFacetOptions({ ...EMPTY_SHOP_STATE }, 'age', 'ar');
  const match = options.find((opt) => opt.id === '6-10y');
  assert.ok(match);
  assert.equal(match.label, 'من 6 ل 10 سنوات');
});

test('single-age product matches selected age filter', () => {
  loadLiveCatalog();
  const matched = filterProducts({ ...EMPTY_SHOP_STATE, age: ['3-6y'] });
  assert.ok(matched.some((product) => product.slug === 'single-age-toy'));
  assert.ok(!matched.some((product) => product.slug === 'legacy-age-toy'));
});

test('multi-age product matches any selected age id', () => {
  loadLiveCatalog();
  const byYoung = filterProducts({ ...EMPTY_SHOP_STATE, age: ['3-6y'] });
  const byOlder = filterProducts({ ...EMPTY_SHOP_STATE, age: ['6-10y'] });
  assert.ok(byYoung.some((product) => product.slug === 'multi-age-toy'));
  assert.ok(byOlder.some((product) => product.slug === 'multi-age-toy'));
});

test('products without age stay visible until an age filter is selected', () => {
  loadLiveCatalog();
  const all = filterProducts({ ...EMPTY_SHOP_STATE });
  const filtered = filterProducts({ ...EMPTY_SHOP_STATE, age: ['3-6y'] });
  assert.ok(all.some((product) => product.slug === 'no-age-toy'));
  assert.ok(!filtered.some((product) => product.slug === 'no-age-toy'));
});

test('legacy flat product.age remains filter-compatible', () => {
  loadLiveCatalog();
  const matched = filterProducts({ ...EMPTY_SHOP_STATE, age: ['0-3y'] });
  assert.ok(matched.some((product) => product.slug === 'legacy-age-toy'));
  assert.deepEqual(getProductAgeIds(matched.find((product) => product.slug === 'legacy-age-toy')), ['0-3y']);
});

test('age facet counts include multi-age products once per age id', () => {
  loadLiveCatalog();
  const counts = getAvailableFacetValues({ ...EMPTY_SHOP_STATE }, 'age', 'age');
  assert.equal(counts['3-6y'], 2);
  assert.equal(counts['6-10y'], 1);
  assert.equal(counts['0-3y'], 1);
  assert.equal(counts['unknown-age'], undefined);
});

test('URL age query supports comma-separated multi-select', () => {
  const parsed = parseShopState('?age=3-6y,6-10y');
  assert.deepEqual(parsed.age, ['3-6y', '6-10y']);
  const rebuilt = buildShopQuery({ ...EMPTY_SHOP_STATE, age: ['3-6y', '6-10y'] });
  assert.equal(rebuilt, 'age=3-6y%2C6-10y');
});

test('URL age filtering survives parse and filter round-trip', () => {
  loadLiveCatalog();
  const state = parseShopState('?age=6-10y');
  const matched = filterProducts(state);
  assert.ok(matched.some((product) => product.slug === 'multi-age-toy'));
  assert.ok(!matched.some((product) => product.slug === 'single-age-toy'));
});

test('unknown age ids fail safely without invented labels', () => {
  loadLiveCatalog();
  const matched = filterProducts({ ...EMPTY_SHOP_STATE, age: ['does-not-exist'] });
  assert.equal(matched.length, 0);
  const options = getAttributeFacetOptions({ ...EMPTY_SHOP_STATE, age: ['does-not-exist'] }, 'age', 'en');
  assert.ok(!options.some((opt) => opt.id === 'does-not-exist'));
});

test('filterDefinitions.age fallback keeps hardcoded age options', () => {
  const fallbackIds = getFilterGroup('age').map((item) => item.id);
  assert.ok(fallbackIds.includes('5-6y'));
  assert.ok(fallbackIds.includes('0-12m'));
});

test('productMatchesAgeFilter uses any-of semantics', () => {
  const product = { ageIds: ['3-6y', '6-10y'] };
  assert.equal(productMatchesAgeFilter(product, []), true);
  assert.equal(productMatchesAgeFilter(product, ['3-6y']), true);
  assert.equal(productMatchesAgeFilter(product, ['6-10y']), true);
  assert.equal(productMatchesAgeFilter(product, ['0-3y']), false);
});
