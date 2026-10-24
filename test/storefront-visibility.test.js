import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  getBrand,
  getCategory,
  getSubcategory,
  velvetBrands,
  velvetTaxonomyStats,
} from '../src/data/velvetCatalog.js';
import { getFacetHierarchyOptions } from '../src/data/shopFacets.js';
import { EMPTY_SHOP_STATE } from '../src/hooks/shopQuery.js';
import {
  TEMPORARILY_HIDDEN_STOREFRONT_CATEGORY_SLUGS,
  getStorefrontCategories,
  isStorefrontCategoryHidden,
} from '../src/data/storefrontVisibility.js';

const baseState = {
  ...EMPTY_SHOP_STATE,
  age: [],
  gender: [],
  skill: [],
  occasion: [],
  shopping: [],
};

// The exact empty Main Categories requested for temporary hiding, with the live
// AR/EN names from velvetTaxonomy.js so the slugs are proven to be real entities.
const HIDDEN_ENTITIES = [
  { brand: 'collect', category: 'anime-and-manga', en: 'Anime & Manga', ar: 'أنمي ومانجا' },
  { brand: 'move', category: 'climbing', en: 'Climbing', ar: 'التسلق' },
  { brand: 'move', category: 'bikes', en: 'Bikes', ar: 'الدراجات' },
  { brand: 'move', category: 'beach-toys', en: 'Beach Toys', ar: 'ألعاب الشاطئ' },
  { brand: 'move', category: 'swimming', en: 'Swimming', ar: 'السباحة' },
  { brand: 'muslim', category: 'islamic-stories', en: 'Islamic Stories', ar: 'قصص إسلامية' },
  { brand: 'muslim', category: 'muslim-dolls', en: 'Muslim Dolls', ar: 'دمى إسلامية' },
  { brand: 'books', category: 'islamic-books', en: 'Islamic Books', ar: 'كتب إسلامية' },
];

const pairKeys = (pairs) => pairs.map((pair) => `${pair.brand}/${pair.category}`).sort();

const overridePairs = Object.entries(TEMPORARILY_HIDDEN_STOREFRONT_CATEGORY_SLUGS)
  .flatMap(([brand, categories]) => categories.map((category) => ({ brand, category })));

test('temporary override contains exactly the eight requested Main Categories', () => {
  assert.deepEqual(pairKeys(overridePairs), pairKeys(HIDDEN_ENTITIES));
  assert.deepEqual(
    Object.keys(TEMPORARILY_HIDDEN_STOREFRONT_CATEGORY_SLUGS).sort(),
    ['books', 'collect', 'move', 'muslim'],
  );
});

test('every override targets a real Main Category with its live AR/EN name', () => {
  for (const entity of HIDDEN_ENTITIES) {
    const category = getCategory(entity.brand, entity.category);
    assert.ok(category, `expected ${entity.brand}/${entity.category} to exist in the catalog`);
    assert.equal(category.slug, entity.category);
    assert.equal(category.name.en, entity.en);
    assert.equal(category.name.ar, entity.ar);
    assert.ok(isStorefrontCategoryHidden(entity.brand, entity.category));
  }
});

test('hiding is scoped by brand + category pair, never by bare slug', () => {
  // `action-figures` exists under both kids and collect; neither is hidden.
  assert.equal(isStorefrontCategoryHidden('collect', 'action-figures'), false);
  assert.equal(isStorefrontCategoryHidden('kids', 'action-figures'), false);
  assert.ok(getStorefrontCategories(getBrand('collect')).some((c) => c.slug === 'action-figures'));

  // A hidden slug only hides inside its owning brand.
  assert.equal(isStorefrontCategoryHidden('kids', 'swimming'), false);
  assert.equal(isStorefrontCategoryHidden('move', 'anime-and-manga'), false);
  assert.equal(isStorefrontCategoryHidden('muslim', 'climbing'), false);
});

test('parent brands and sibling Main Categories still render', () => {
  const expectedSiblings = {
    collect: 'blind-boxes',
    move: 'outdoor-play',
    muslim: 'quran-learning',
    books: 'story-books',
  };

  for (const [brandSlug, siblingSlug] of Object.entries(expectedSiblings)) {
    const brand = getBrand(brandSlug);
    assert.ok(brand, `parent brand ${brandSlug} must stay available`);

    const hiddenForBrand = TEMPORARILY_HIDDEN_STOREFRONT_CATEGORY_SLUGS[brandSlug];
    const visible = getStorefrontCategories(brand);

    assert.equal(visible.length, brand.categories.length - hiddenForBrand.length);
    assert.ok(visible.some((category) => category.slug === siblingSlug));
    visible.forEach((category) => {
      assert.equal(hiddenForBrand.includes(category.slug), false);
    });
  }

  HIDDEN_ENTITIES.forEach(({ brand, category }) => {
    assert.equal(
      getStorefrontCategories(getBrand(brand)).some((entry) => entry.slug === category),
      false,
      `${brand}/${category} must be absent from storefront discovery`,
    );
  });

  // Brands without overrides return their original list untouched.
  const baby = getBrand('baby');
  assert.equal(getStorefrontCategories(baby), baby.categories);
});

test('catalog, taxonomy counts and direct URLs remain intact', () => {
  assert.equal(velvetBrands.length, 12);
  assert.equal(velvetTaxonomyStats.mainCategories, 127);
  assert.equal(velvetTaxonomyStats.subcategories, 412);

  // The hidden Main Categories (and their subs) are still resolvable on purpose:
  // direct URLs keep their current safe behavior.
  for (const entity of HIDDEN_ENTITIES) {
    assert.ok(getBrand(entity.brand)?.categories.some((category) => category.slug === entity.category));
    assert.ok(getCategory(entity.brand, entity.category));
  }
  assert.ok(getSubcategory('move', 'swimming', 'floats'));
  assert.ok(getSubcategory('muslim', 'islamic-stories', 'prophets'));
});

test('shop facet hierarchy hides overrides per brand and across all brands', () => {
  const move = getFacetHierarchyOptions({ ...baseState, brand: 'move' });
  const moveIds = move.categories.map((item) => item.id);
  ['climbing', 'bikes', 'beach-toys', 'swimming'].forEach((slug) => {
    assert.equal(moveIds.includes(slug), false, `${slug} must be hidden under move`);
  });
  assert.ok(moveIds.includes('outdoor-play'));

  const collect = getFacetHierarchyOptions({ ...baseState, brand: 'collect' });
  const collectIds = collect.categories.map((item) => item.id);
  assert.equal(collectIds.includes('anime-and-manga'), false);
  assert.ok(collectIds.includes('action-figures'));

  const allBrands = getFacetHierarchyOptions(baseState);
  const allIds = allBrands.categories.map((item) => item.id);
  HIDDEN_ENTITIES.forEach((entity) => {
    assert.equal(allIds.includes(entity.category), false, `${entity.category} leaked into all-brand facets`);
  });
  assert.ok(allIds.includes('blind-boxes'));

  // Subcategories of a still-visible Main Category are unaffected.
  const outdoor = getFacetHierarchyOptions({ ...baseState, brand: 'move', category: 'outdoor-play' });
  assert.deepEqual(
    outdoor.subcategories.map((item) => item.id),
    getCategory('move', 'outdoor-play').subs.map((sub) => sub.slug),
  );
});

test('presentation surfaces consume the shared helper instead of raw brand.categories', () => {
  const brandPage = fs.readFileSync(new URL('../src/pages/BrandPage.jsx', import.meta.url), 'utf8');
  const cascade = fs.readFileSync(new URL('../src/components/CategoryCascade.jsx', import.meta.url), 'utf8');
  const facets = fs.readFileSync(new URL('../src/data/shopFacets.js', import.meta.url), 'utf8');

  assert.match(brandPage, /getStorefrontCategories/);
  assert.match(cascade, /getStorefrontCategories/);
  assert.match(facets, /getStorefrontCategories/);
  assert.doesNotMatch(brandPage, /brand\.categories/);
  assert.doesNotMatch(cascade, /brand\.categories/);
  assert.doesNotMatch(facets, /brand\.categories/);
});
