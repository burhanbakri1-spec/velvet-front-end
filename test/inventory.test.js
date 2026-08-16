import assert from 'node:assert/strict';
import test from 'node:test';
import { availableStock, optionValueUnavailable, productStock, selectedVariant } from '../src/data/inventory.js';
import { buildDynamicCatalog } from '../src/data/dynamicCatalog.js';

const dynamicProduct = {
  inventoryManaged: true,
  stock: 2,
  variants: [
    { id: 'red-small', colorName: 'Red', size: 'Small', stock: 0 },
    { id: 'blue-large', colorName: 'Blue', size: 'Large', stock: 2 },
  ],
};

test('dynamic product and selected variant stock are canonical', () => {
  assert.equal(productStock(dynamicProduct), 2);
  assert.equal(selectedVariant(dynamicProduct, { Color: 'Blue', Size: 'Large' }).id, 'blue-large');
  assert.equal(availableStock(dynamicProduct, { Color: 'Red', Size: 'Small' }), 0);
  assert.equal(optionValueUnavailable(dynamicProduct, { Size: 'Small' }, 'Color', 'Red'), true);
});

test('static fallback products remain unbounded by platform inventory helpers', () => {
  assert.equal(productStock({ availability: 'In stock' }), Number.POSITIVE_INFINITY);
  assert.equal(availableStock({ availability: 'In stock' }), Number.POSITIVE_INFINITY);
});

test('dynamic catalog derives availability from serialized variant stock', () => {
  const payload = {
    brands: [{ id: 'b1', slug: 'brand', name: { en: 'Brand' } }],
    categories: [{ id: 'c1', slug: 'main', name: { en: 'Main' }, brandId: 'b1', parentId: null }],
    products: [{ id: 'p1', slug: 'toy', name: { en: 'Toy' }, brandId: 'b1', mainCategoryId: 'c1', variants: [{ id: 'v1', stock: 0 }] }],
  };
  const catalog = buildDynamicCatalog(payload, 'https://api.test');
  assert.equal(catalog.products[0].inventoryManaged, true);
  assert.equal(catalog.products[0].stock, 0);
  assert.equal(catalog.products[0].availability, 'Out of stock');
});
