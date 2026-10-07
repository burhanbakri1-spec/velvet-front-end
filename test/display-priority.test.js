import assert from 'node:assert/strict';
import test from 'node:test';
import { selectBrandStripProducts } from '../src/data/brandProductStrip.js';
import {
  applyDisplayPriority,
  getHomePriority,
  getShopPriority,
  isExplicitCustomerSort,
  orderProductsByIds,
} from '../src/data/displayPriority.js';

const product = (id, brandId) => ({
  id,
  slug: id,
  velvetPath: { brandId },
});

test('missing display priority keeps automatic home strip order', () => {
  applyDisplayPriority({});
  assert.equal(getHomePriority('baby'), null);
  const products = [
    product('a', 'baby'),
    product('b', 'baby',),
    product('c', 'play'),
  ];
  products[1].featured = true;
  const strip = selectBrandStripProducts(products, 'baby');
  assert.deepEqual(strip.map((item) => item.id), ['b', 'a']);
});

test('home strips follow saved home ordered ids and ignore other brands', () => {
  applyDisplayPriority({
    displayPriority: {
      brands: {
        baby: { home: { orderedIds: ['a', 'play-1', 'b'] } },
      },
    },
  });
  const products = [product('b', 'baby'), product('a', 'baby'), product('play-1', 'play')];
  const strip = selectBrandStripProducts(products, 'baby', { priority: getHomePriority('baby') });
  assert.deepEqual(strip.map((item) => item.id), ['a', 'b']);
});

test('empty home orderedIds does not fall back to the featured strip', () => {
  applyDisplayPriority({
    displayPriority: { home: { orderedIds: [] } },
  });
  const products = [product('featured', 'baby'), product('plain', 'baby')];
  products[0].featured = true;
  const priority = getHomePriority('baby');
  assert.deepEqual(priority.orderedIds, []);
  assert.deepEqual(selectBrandStripProducts(products, 'baby', { priority }), []);
});

test('missing home scope keeps the automatic strip', () => {
  applyDisplayPriority({
    displayPriority: { shop: { orderedIds: ['kept-for-shop'] } },
  });
  assert.equal(getHomePriority('baby'), null);
  const products = [product('plain', 'baby'), product('featured', 'baby')];
  products[1].featured = true;
  assert.deepEqual(
    selectBrandStripProducts(products, 'baby', { priority: getHomePriority('baby') }).map((item) => item.id),
    ['featured', 'plain'],
  );
});

test('empty ordered ids render an empty product set', () => {
  applyDisplayPriority({
    displayPriority: {
      shop: { orderedIds: [] },
      brands: {
        baby: { home: { orderedIds: [] }, shop: { orderedIds: [] } },
      },
    },
  });
  const products = [product('a', 'baby'), product('b', 'baby')];
  assert.deepEqual(selectBrandStripProducts(products, 'baby', { priority: getHomePriority('baby') }), []);
  assert.deepEqual(orderProductsByIds(products, getShopPriority('').orderedIds), []);
  assert.deepEqual(orderProductsByIds(products, getShopPriority('baby').orderedIds), []);
});

test('general shop and brand shop priorities stay independent', () => {
  applyDisplayPriority({
    displayPriority: {
      shop: { orderedIds: ['general'] },
      brands: {
        baby: { shop: { orderedIds: ['baby-1'] } },
      },
    },
  });
  assert.deepEqual(getShopPriority('').orderedIds, ['general']);
  assert.deepEqual(getShopPriority('baby').orderedIds, ['baby-1']);
  assert.equal(getShopPriority('play'), null);
  assert.equal(getHomePriority('baby'), null);
});

test('explicit customer sort is separate from the default featured option', () => {
  assert.equal(isExplicitCustomerSort(''), false);
  assert.equal(isExplicitCustomerSort('featured'), false);
  assert.equal(isExplicitCustomerSort('price-asc'), true);
  assert.equal(isExplicitCustomerSort('name'), true);
});
