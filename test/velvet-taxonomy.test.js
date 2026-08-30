import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPlatformContent } from '../src/data/platformContent.js';
import {
  EMPTY_SHOP_STATE,
  buildShopQuery,
  parseShopState,
  sanitizeShopState,
  selectPathKey,
} from '../src/hooks/shopQuery.js';
import {
  applyTaxonomyToProduct,
  filterProducts,
  getBrand,
  getCategory,
  getPathProducts,
  getProductTaxonomy,
  getShopHierarchyOptions,
  getSubcategory,
  outsideTaxonomyProductIds,
  productTaxonomyById,
  velvetBrands,
  velvetTaxonomyStats,
} from '../src/data/velvetCatalog.js';

const baseState = {
  ...EMPTY_SHOP_STATE,
  age: [],
  gender: [],
  skill: [],
  occasion: [],
  shopping: [],
};

test('workbook taxonomy exposes all 12 brands and expected totals', () => {
  assert.equal(velvetTaxonomyStats.brands, 12);
  assert.equal(velvetTaxonomyStats.mainCategories, 127);
  assert.equal(velvetTaxonomyStats.subcategories, 412);
  assert.equal(velvetTaxonomyStats.productsMapped, 434);
  assert.equal(velvetBrands.length, 12);
  assert.deepEqual(
    velvetBrands.map((brand) => brand.slug),
    ['baby', 'kids', 'play', 'build', 'learn', 'create', 'games', 'move', 'collect', 'plush', 'books', 'muslim'],
  );
  assert.equal(
    velvetBrands.reduce((sum, brand) => sum + brand.categories.length, 0),
    127,
  );
  assert.equal(
    velvetBrands.reduce((sum, brand) => sum + brand.categories.reduce((inner, category) => inner + category.subs.length, 0), 0),
    412,
  );
});

test('product taxonomy is keyed by product_id and preserves outside-tree products', () => {
  assert.equal(Object.keys(productTaxonomyById).length, 434);
  assert.deepEqual(outsideTaxonomyProductIds.sort(), ['75', '76', '781', '810', '811', '815'].sort());
  for (const id of outsideTaxonomyProductIds) {
    const taxonomy = getProductTaxonomy(id);
    assert.ok(taxonomy?.brandSlug, `outside product ${id} keeps a Velvet brand`);
    assert.equal(taxonomy.mainSlug, '');
    assert.equal(taxonomy.subcategorySlug, '');
  }
  const classified = getProductTaxonomy('564');
  assert.deepEqual(classified, {
    brandSlug: 'baby',
    mainSlug: 'baby-development',
    subcategorySlug: 'sensory-toys',
    classificationStatus: 'مصنّف',
  });
});

test('duplicate leaf slugs resolve only through the full hierarchy path', () => {
  const paths = [];
  for (const brand of velvetBrands) {
    for (const category of brand.categories) {
      for (const sub of category.subs) {
        if (sub.slug === 'cars') paths.push(`${brand.slug}/${category.slug}/${sub.slug}`);
      }
    }
  }
  assert.ok(paths.length >= 2, 'cars leaf slug is reused across hierarchy paths');
  assert.equal(new Set(paths).size, paths.length);
  assert.ok(getSubcategory('kids', 'vehicles', 'cars'));
  assert.notEqual(
    getSubcategory(paths[0].split('/')[0], paths[0].split('/')[1], 'cars'),
    getSubcategory(paths[1].split('/')[0], paths[1].split('/')[1], 'cars'),
  );
});

test('Brand → Main → Sub cascade and URL sanitization remain path-aware', () => {
  const brandOptions = getShopHierarchyOptions({});
  assert.equal(brandOptions.brands.length, 12);
  const baby = selectPathKey(baseState, 'brand', 'baby');
  assert.equal(buildShopQuery(baby), 'brand=baby');
  const babyOptions = getShopHierarchyOptions(baby);
  assert.ok(babyOptions.categories.every((category) => getCategory('baby', category.id)));
  assert.equal(babyOptions.subcategories.length, 0);

  const withMain = selectPathKey(baby, 'category', 'baby-development');
  assert.equal(buildShopQuery(withMain), 'brand=baby&category=baby-development');
  const mainOptions = getShopHierarchyOptions(withMain);
  assert.ok(mainOptions.subcategories.some((sub) => sub.id === 'sensory-toys'));

  const withSub = selectPathKey(withMain, 'subcategory', 'sensory-toys');
  assert.equal(buildShopQuery(withSub), 'brand=baby&category=baby-development&subcategory=sensory-toys');

  const invalid = sanitizeShopState({
    ...baseState,
    brand: 'baby',
    category: 'not-a-real-main',
    subcategory: 'sensory-toys',
  });
  assert.equal(invalid.category, '');
  assert.equal(invalid.subcategory, '');

  const parsed = parseShopState('?brand=kids&category=vehicles&subcategory=cars');
  assert.equal(parsed.brand, 'kids');
  assert.equal(parsed.category, 'vehicles');
  assert.equal(parsed.subcategory, 'cars');
});

test('changing brand or main clears only invalid dependents', () => {
  const nextBrand = selectPathKey({
    ...baseState,
    brand: 'baby',
    category: 'baby-development',
    subcategory: 'sensory-toys',
    age: ['3-4y'],
  }, 'brand', 'kids');
  assert.equal(nextBrand.brand, 'kids');
  assert.equal(nextBrand.category, '');
  assert.equal(nextBrand.subcategory, '');
  assert.deepEqual(nextBrand.age, ['3-4y']);

  const nextMain = selectPathKey({
    ...baseState,
    brand: 'baby',
    category: 'baby-development',
    subcategory: 'sensory-toys',
    gender: ['unisex'],
  }, 'category', 'rattles-and-teethers');
  assert.equal(nextMain.category, 'rattles-and-teethers');
  assert.equal(nextMain.subcategory, '');
  assert.deepEqual(nextMain.gender, ['unisex']);
});

test('outside-taxonomy products are not falsely categorized', () => {
  const product = applyTaxonomyToProduct({
    id: '815',
    slug: 'standing-fun-shower',
    name: 'Standing Fun Shower',
    brandId: 'ignored',
    categoryId: 'fake-main',
    subcategoryId: 'fake-leaf',
    velvetPath: { brandId: 'ignored', categoryId: 'fake-main', subcategoryId: 'fake-leaf' },
  });
  assert.equal(product.velvetPath.brandId, 'baby');
  assert.equal(product.velvetPath.categoryId, '');
  assert.equal(product.velvetPath.subcategoryId, '');
  assert.equal(filterProducts({
    ...baseState,
    brand: 'baby',
    category: 'baby-development',
  }).some((item) => item.id === '815'), false);
});

test('taxonomy-mapped platform products keep live commerce fields', () => {
  applyPlatformContent({
    site: { id: 'kids-velvet-storefront', companyId: 'kids-velvet' },
    brands: [{ id: 'b1', slug: 'velvet-baby', name: { en: 'VELVET BABY', ar: 'VELVET BABY' }, sortOrder: 1 }],
    categories: [
      { id: 'c1', slug: 'baby-development', name: { en: 'Baby Development', ar: 'تنمية الطفل' }, parentId: null, brandId: 'b1', sortOrder: 1 },
      { id: 's1', slug: 'sensory-toys', name: { en: 'Sensory Toys', ar: 'ألعاب حسية' }, parentId: 'c1', brandId: 'b1', sortOrder: 1 },
    ],
    products: [{
      id: '564',
      slug: 'visual-cards',
      name: { en: 'Visual Cards', ar: 'بطاقات' },
      shortDescription: { en: 'Cards', ar: 'بطاقات' },
      description: { en: 'Cards', ar: 'بطاقات' },
      price: 25,
      brandId: 'b1',
      mainCategoryId: 'c1',
      subcategoryId: 's1',
      image: '/uploads/564.jpg',
      stock: 9,
      variants: [{ id: 'v1', stock: 4 }, { id: 'v2', stock: 5 }],
    }],
    texts: [],
    media: [],
  }, 'https://api.test');

  const mapped = getPathProducts({ brand: 'baby', category: 'baby-development', subcategory: 'sensory-toys' });
  assert.equal(mapped.length, 1);
  assert.equal(mapped[0].id, '564');
  assert.equal(mapped[0].price, 25);
  assert.equal(mapped[0].image, 'https://api.test/uploads/564.jpg');
  assert.equal(mapped[0].stock, 9);
  assert.equal(mapped[0].variants.length, 2);
  assert.deepEqual(mapped[0].velvetPath, {
    brandId: 'baby',
    categoryId: 'baby-development',
    subcategoryId: 'sensory-toys',
  });
  assert.ok(getBrand('baby').categories.some((category) => category.slug === 'rattles-and-teethers'));
});
