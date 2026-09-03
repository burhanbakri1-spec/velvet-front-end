import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getProductAttributeIds,
  normalizeAttributeIdsFromRaw,
  productMatchesAttributeFilter,
} from '../src/data/classificationFilter.js';
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
import { translations } from '../src/i18n/translations.js';

const API = 'https://api.test';

const LIVE_DEFS = {
  age: [
    { id: '3-6y', label: { en: '3–6 Years', ar: 'من 3 ل 6 سنوات' } },
  ],
  gender: [
    { id: 'boys', label: { en: 'Boys', ar: 'أولاد' } },
    { id: 'girls', label: { en: 'Girls', ar: 'بنات' } },
  ],
  skill: [
    { id: 'construction-creativity', label: { en: 'Construction & Creativity', ar: 'بناء وإبداع' } },
    { id: 'role-play-imagination', label: { en: 'Role Play', ar: 'لعب أدوار' } },
  ],
  occasion: [],
  material: [
    { id: 'wood', label: { en: 'Wood', ar: 'خشب' } },
    { id: 'plastic', label: { en: 'Plastic', ar: 'بلاستيك' } },
  ],
  productType: [
    { id: 'building-sets', label: { en: 'Building Sets', ar: 'أطقم بناء' } },
  ],
  theme: [
    { id: 'animals', label: { en: 'Animals', ar: 'حيوانات' } },
  ],
  collection: [
    { id: 'new-arrivals', label: { en: 'New Arrivals', ar: 'وصل حديثًا' } },
    { id: 'featured', label: { en: 'Featured', ar: 'مميز' } },
  ],
};

function livePayload() {
  return {
    site: { id: 'kids-velvet-storefront', companyId: 'kids-velvet' },
    brands: [{
      id: 'b-live',
      slug: 'velvet-live-class',
      name: { en: 'VELVET LIVE CLASS', ar: 'VELVET LIVE CLASS' },
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
    filterDefinitions: LIVE_DEFS,
    products: [
      {
        id: 'p-boys-girls',
        slug: 'boys-girls-toy',
        name: { en: 'Shared Gender', ar: 'مشترك' },
        price: 10,
        brandId: 'b-live',
        mainCategoryId: 'c-live',
        subcategoryId: 's-live',
        filterAttributes: {
          age: [{ id: '3-6y', label: LIVE_DEFS.age[0].label }],
          gender: [
            { id: 'boys', label: LIVE_DEFS.gender[0].label },
            { id: 'girls', label: LIVE_DEFS.gender[1].label },
          ],
          skill: [{ id: 'construction-creativity', label: LIVE_DEFS.skill[0].label }],
          material: [{ id: 'wood', label: LIVE_DEFS.material[0].label }],
          productType: [{ id: 'building-sets', label: LIVE_DEFS.productType[0].label }],
          theme: [{ id: 'animals', label: LIVE_DEFS.theme[0].label }],
          collection: [{ id: 'new-arrivals', label: LIVE_DEFS.collection[0].label }],
        },
      },
      {
        id: 'p-multi-skill',
        slug: 'multi-skill-toy',
        name: { en: 'Multi Skill', ar: 'مهارات متعددة' },
        price: 20,
        brandId: 'b-live',
        mainCategoryId: 'c-live',
        subcategoryId: 's-live',
        filterAttributes: {
          age: [{ id: '3-6y', label: LIVE_DEFS.age[0].label }],
          gender: [{ id: 'boys', label: LIVE_DEFS.gender[0].label }],
          skill: [
            { id: 'construction-creativity', label: LIVE_DEFS.skill[0].label },
            { id: 'role-play-imagination', label: LIVE_DEFS.skill[1].label },
          ],
          material: [{ id: 'plastic', label: LIVE_DEFS.material[1].label }],
          collection: [{ id: 'featured', label: LIVE_DEFS.collection[1].label }],
        },
      },
      {
        id: 'p-no-skill',
        slug: 'no-skill-toy',
        name: { en: 'No Skill', ar: 'بدون مهارة' },
        price: 30,
        brandId: 'b-live',
        mainCategoryId: 'c-live',
        subcategoryId: 's-live',
        filterAttributes: {
          age: [{ id: '3-6y', label: LIVE_DEFS.age[0].label }],
          gender: [{ id: 'girls', label: LIVE_DEFS.gender[1].label }],
          skill: [],
        },
      },
    ],
    texts: [],
    media: [],
  };
}

function load() {
  applyPlatformContent(livePayload(), API);
}

test.beforeEach(() => {
  resetFilterDefinitionsForTests();
});

test('live gender definitions are used', () => {
  load();
  const options = getFilterGroup('gender');
  assert.deepEqual(options.map((item) => item.id), ['boys', 'girls']);
  assert.equal(options[0].name.en, 'Boys');
  assert.equal(options[0].name.ar, 'أولاد');
});

test('live skill definitions are used', () => {
  load();
  assert.ok(getFilterGroup('skill').some((item) => item.id === 'construction-creativity'));
});

test('live material definitions are used', () => {
  load();
  assert.equal(getFilterGroup('material')[0].name.en, 'Wood');
});

test('live productType definitions are used', () => {
  load();
  assert.equal(getFilterGroup('productType')[0].id, 'building-sets');
});

test('live theme definitions are used', () => {
  load();
  assert.equal(getFilterGroup('theme')[0].name.ar, 'حيوانات');
});

test('live collection definitions are used', () => {
  load();
  assert.ok(getFilterGroup('collection').some((item) => item.id === 'new-arrivals'));
});

test('empty occasion definitions hide the group', () => {
  load();
  assert.deepEqual(getFilterGroup('occasion'), []);
  assert.deepEqual(getAttributeFacetOptions({ ...EMPTY_SHOP_STATE }, 'occasion', 'en'), []);
});

test('multi-value gender product matches boys and girls', () => {
  load();
  const boys = filterProducts({ ...EMPTY_SHOP_STATE, gender: ['boys'] });
  const girls = filterProducts({ ...EMPTY_SHOP_STATE, gender: ['girls'] });
  assert.ok(boys.some((product) => product.slug === 'boys-girls-toy'));
  assert.ok(girls.some((product) => product.slug === 'boys-girls-toy'));
  assert.deepEqual(
    getProductAttributeIds(boys.find((product) => product.slug === 'boys-girls-toy'), 'gender'),
    ['boys', 'girls'],
  );
});

test('OR within skill group matches either selected skill', () => {
  load();
  const matched = filterProducts({
    ...EMPTY_SHOP_STATE,
    skill: ['construction-creativity', 'role-play-imagination'],
  });
  assert.ok(matched.some((product) => product.slug === 'boys-girls-toy'));
  assert.ok(matched.some((product) => product.slug === 'multi-skill-toy'));
  assert.ok(!matched.some((product) => product.slug === 'no-skill-toy'));
});

test('AND across age + skill', () => {
  load();
  const matched = filterProducts({
    ...EMPTY_SHOP_STATE,
    age: ['3-6y'],
    skill: ['role-play-imagination'],
  });
  assert.deepEqual(matched.map((product) => product.slug), ['multi-skill-toy']);
});

test('AND across age + skill + material', () => {
  load();
  const matched = filterProducts({
    ...EMPTY_SHOP_STATE,
    age: ['3-6y'],
    skill: ['construction-creativity'],
    material: ['wood'],
  });
  assert.deepEqual(matched.map((product) => product.slug), ['boys-girls-toy']);
});

test('facet counts use multi-value product arrays once per id', () => {
  load();
  const genderCounts = getAvailableFacetValues({ ...EMPTY_SHOP_STATE }, 'gender', 'gender');
  assert.equal(genderCounts.boys, 2);
  assert.equal(genderCounts.girls, 2);
  const skillCounts = getAvailableFacetValues({ ...EMPTY_SHOP_STATE }, 'skill', 'skill');
  assert.equal(skillCounts['construction-creativity'], 2);
  assert.equal(skillCounts['role-play-imagination'], 1);
});

test('URL parse/build supports new classification params', () => {
  const parsed = parseShopState('?skill=construction-creativity,role-play-imagination&material=wood&productType=building-sets&theme=animals&collection=featured');
  assert.deepEqual(parsed.skill, ['construction-creativity', 'role-play-imagination']);
  assert.deepEqual(parsed.material, ['wood']);
  assert.deepEqual(parsed.productType, ['building-sets']);
  assert.deepEqual(parsed.theme, ['animals']);
  assert.deepEqual(parsed.collection, ['featured']);
  const query = buildShopQuery({
    ...EMPTY_SHOP_STATE,
    skill: ['construction-creativity', 'role-play-imagination'],
    material: ['wood'],
  });
  assert.match(query, /skill=construction-creativity%2Crole-play-imagination/);
  assert.match(query, /material=wood/);
});

test('URL filtering survives parse round-trip', () => {
  load();
  const state = parseShopState('?age=3-6y&skill=construction-creativity&material=plastic');
  const matched = filterProducts(state);
  assert.deepEqual(matched.map((product) => product.slug), ['multi-skill-toy']);
});

test('English and Arabic option labels come from API', () => {
  load();
  const en = getAttributeFacetOptions({ ...EMPTY_SHOP_STATE }, 'skill', 'en');
  const ar = getAttributeFacetOptions({ ...EMPTY_SHOP_STATE }, 'skill', 'ar');
  assert.equal(en.find((item) => item.id === 'construction-creativity')?.label, 'Construction & Creativity');
  assert.equal(ar.find((item) => item.id === 'construction-creativity')?.label, 'بناء وإبداع');
});

test('group labels use project localization', () => {
  assert.equal(translations.en.shop.gender, 'Gender');
  assert.equal(translations.ar.shop.gender, 'الجنس');
  assert.equal(translations.en.shop.skill, 'Skills');
  assert.equal(translations.ar.shop.skill, 'المهارات');
  assert.equal(translations.en.shop.material, 'Material');
  assert.equal(translations.ar.shop.material, 'الخامة');
  assert.equal(translations.en.shop.productType, 'Product Type');
  assert.equal(translations.ar.shop.productType, 'نوع المنتج');
  assert.equal(translations.en.shop.theme, 'Theme');
  assert.equal(translations.ar.shop.theme, 'النمط');
  assert.equal(translations.en.shop.collectionFilter, 'Collection');
  assert.equal(translations.ar.shop.collectionFilter, 'المجموعة');
});

test('unknown classification ids fail safely', () => {
  load();
  assert.equal(filterProducts({ ...EMPTY_SHOP_STATE, material: ['does-not-exist'] }).length, 0);
  const options = getAttributeFacetOptions({ ...EMPTY_SHOP_STATE, material: ['does-not-exist'] }, 'material', 'en');
  assert.ok(!options.some((item) => item.id === 'does-not-exist'));
});

test('product with no value in active group is excluded', () => {
  load();
  const matched = filterProducts({ ...EMPTY_SHOP_STATE, skill: ['construction-creativity'] });
  assert.ok(!matched.some((product) => product.slug === 'no-skill-toy'));
  const all = filterProducts({ ...EMPTY_SHOP_STATE });
  assert.ok(all.some((product) => product.slug === 'no-skill-toy'));
});

test('normalizeAttributeIdsFromRaw preserves multi-value source truth', () => {
  assert.deepEqual(
    normalizeAttributeIdsFromRaw({
      filterAttributes: {
        gender: [{ id: 'boys' }, { id: 'girls' }],
      },
    }, 'gender'),
    ['boys', 'girls'],
  );
  assert.equal(productMatchesAttributeFilter({ genderIds: ['boys', 'girls'] }, 'gender', ['girls']), true);
  assert.equal(productMatchesAttributeFilter({ genderIds: ['boys', 'girls'] }, 'gender', ['unisex']), false);
});
