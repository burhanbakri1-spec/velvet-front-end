import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { BRAND_STRIP_DEFAULT_LIMIT, selectBrandStripProducts } from '../src/data/brandProductStrip.js';
import {
  isExplicitShopSort,
  orderProductsByIds,
  orderedIdsForHome,
  orderedIdsForShop,
  setDisplayPriority,
} from '../src/data/displayPriority.js';
import { sortProducts } from '../src/data/velvetCatalog.js';

const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

const product = (id, extra = {}) => ({
  id,
  slug: id,
  name: id,
  price: 20,
  velvetPath: { brandId: 'baby' },
  ...extra,
});

test('orderProductsByIds keeps saved order and skips unknown or excluded ids', () => {
  const products = [product('p1'), product('p2'), product('p3'), product('other')];
  const ordered = orderProductsByIds(products, ['missing', 'p2', 'p2', 'p1']);
  assert.deepEqual(ordered.map((item) => item.id), ['p2', 'p1']);
});

test('a missing orderedIds list leaves the input unchanged', () => {
  const products = [product('p1'), product('p2')];
  assert.deepEqual(orderProductsByIds(products, null).map((item) => item.id), ['p1', 'p2']);
  assert.equal(isExplicitShopSort('featured'), false);
  assert.equal(isExplicitShopSort('price-asc'), true);
});

test('general shop order survives an age filter and an explicit price sort does not rewrite the fixture', () => {
  const products = [
    product('p1', { age: ['6-10y'], price: 30 }),
    product('p2', { age: ['3-6y'], price: 50 }),
    product('p3', { age: ['3-6y'], price: 10 }),
    product('outside', { age: ['3-6y'], price: 5 }),
  ];
  const fixture = ['p2', 'p1', 'p3'];
  const ageFiltered = products.filter((item) => item.age.includes('3-6y'));
  const ordered = orderProductsByIds(ageFiltered, fixture);
  assert.deepEqual(ordered.map((item) => item.id), ['p2', 'p3']);
  const sorted = sortProducts(ordered, 'price-asc', 'en');
  assert.deepEqual(sorted.map((item) => item.id), ['p3', 'p2']);
  assert.deepEqual(fixture, ['p2', 'p1', 'p3']);
});

test('brand shop ids stay separate from the global shop and from home', () => {
  setDisplayPriority({
    shop: { orderedIds: ['g2', 'g1'] },
    brands: {
      'brand-1': {
        home: { orderedIds: ['h1', 'h2'] },
        shop: { orderedIds: ['s3', 's1'] },
      },
    },
  }, [{ id: 'brand-1', slug: 'baby' }]);
  assert.deepEqual(orderedIdsForShop(''), ['g2', 'g1']);
  assert.deepEqual(orderedIdsForShop('baby'), ['s3', 's1']);
  assert.deepEqual(orderedIdsForHome('baby'), ['h1', 'h2']);
  assert.equal(orderedIdsForShop('missing-brand'), null);
  setDisplayPriority(null, []);
  assert.equal(orderedIdsForShop(''), null);
  assert.equal(orderedIdsForHome('baby'), null);
});

test('category narrowing keeps brand shop order', () => {
  const products = [
    product('s1', { category: 'toys' }),
    product('s2', { category: 'books' }),
    product('s3', { category: 'toys' }),
  ];
  const shopIds = ['s3', 's1', 's2'];
  const categoryProducts = products.filter((item) => item.category === 'toys');
  assert.deepEqual(orderProductsByIds(categoryProducts, shopIds).map((item) => item.id), ['s3', 's1']);
});

test('home strip follows home ids, stays on the brand, and stops at 8', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
  const products = [
    product('other-brand', { velvetPath: { brandId: 'kids' } }),
    ...ids.map((id, index) => product(id, { price: index })),
  ];
  const shown = selectBrandStripProducts(products, 'baby', { orderedIds: ids });
  assert.equal(shown.length, BRAND_STRIP_DEFAULT_LIMIT);
  assert.deepEqual(shown.map((item) => item.id), ids.slice(0, 8));
  assert.equal(shown.some((item) => item.velvetPath.brandId !== 'baby'), false);
});

test('home strip without orderedIds keeps the existing selector', () => {
  const products = [
    product('late', { featured: false }),
    product('first', { featured: true }),
  ];
  const shown = selectBrandStripProducts(products, 'baby');
  assert.equal(shown[0].id, 'first');
});

test('content loading keeps catalog sort and stores displayPriority only for dynamic brands', () => {
  const source = read('src/data/platformContent.js');
  assert.match(source, /sort\(\(a, b\) => a\.sortOrder - b\.sortOrder\)/);
  assert.match(source, /if \(dynamic\?\.brands\?\.length\) setDisplayPriority\(payload\.displayPriority, dynamic\.brands\);/);
  assert.match(source, /else setDisplayPriority\(null, \[\]\);/);
  assert.match(read('src/pages/ProductsPage.jsx'), /orderedIdsForShop\(state\.brand\)/);
  assert.match(read('src/pages/BrandCategoryPage.jsx'), /orderedIdsForShop\(slug\)/);
  assert.match(read('src/components/BrandProductStrip.jsx'), /orderedIdsForHome\(brandSlug\)/);
  assert.doesNotMatch(read('src/pages/CategoryPage.jsx'), /displayPriority/);
});
