import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSelectionPrice, selectedVariant, availableStock } from '../src/data/inventory.js';

const product = {
  price: 40, originalPrice: 50, inventoryManaged: true,
  options: [{ name: 'Size', values: [{ label: '120 cm', priceDelta: 4 }] }],
  variants: [
    { id: 'small', size: '120 cm', colorName: 'Black & Blue', price: 30, originalPrice: 35, stock: 20 },
    { id: 'large', size: '160 cm', colorName: 'Black & Blue', price: 40, stock: 3 },
  ],
};
const small = { Color: ' Black & Blue', Size: '120 cm' };
const large = { Color: 'Black & Blue', Size: '160 cm ' };

test('localized labels resolve the same exact variant without guessing from partial labels', () => {
  const localized = {
    ...product,
    variants: product.variants.map((variant, index) => ({
      ...variant, colorNameAr: 'أسود وأزرق', sizeAr: index === 0 ? '١٢٠ سم' : '١٦٠ سم',
    })),
  };
  const arabic = { Color: 'أسود وأزرق', Size: '١٢٠ سم' };
  assert.equal(selectedVariant(localized, arabic).id, 'small');
  assert.equal(selectedVariant(localized, large).id, 'large');
  assert.equal(resolveSelectionPrice(localized, arabic).price, 30);
  assert.equal(selectedVariant(localized, { Color: 'أسود وأزرق' }), null);
  assert.equal(selectedVariant(localized, { ...arabic, Size: '١٨٠ سم' }), null);
  assert.equal(selectedVariant(localized, {}, 'large').id, 'large');
  assert.equal(selectedVariant(localized, arabic, 'unknown'), null);
  assert.equal(selectedVariant({ ...localized, variants: [...localized.variants, { ...localized.variants[0], id: 'duplicate' }] }, arabic), null);
});

test('exact size sets the price, comparison price, variant and stock', () => {
  assert.deepEqual(resolveSelectionPrice(product, small), { price: 30, originalPrice: 35 });
  assert.deepEqual(resolveSelectionPrice(product, large), { price: 40, originalPrice: null });
  assert.equal(selectedVariant(product, large).id, 'large');
  assert.equal(availableStock(product, large), 3);
});

test('same-price variants keep distinct IDs and use the same price', () => {
  const same = { ...product, variants: product.variants.map(v => ({ ...v, price: 40 })) };
  assert.equal(resolveSelectionPrice(same, small).price, resolveSelectionPrice(same, large).price);
  assert.notEqual(selectedVariant(same, small).id, selectedVariant(same, large).id);
});

test('only a catalog zero with a valid comparison price is an explicit free variant', () => {
  assert.deepEqual(resolveSelectionPrice(product, small, { price: 0, originalPrice: 30 }), {
    price: 0, originalPrice: 30,
  });
  for (const price of [null, '', ' ', 'invalid', false]) {
    assert.equal(resolveSelectionPrice(product, small, { price, originalPrice: 30 }).price, 44);
  }
});

test('missing, zero, negative or invalid variant prices retain option deltas', () => {
  for (const price of [undefined, null, 0, -1, NaN, 'invalid']) {
    assert.deepEqual(resolveSelectionPrice(product, small, { price }), { price: 44, originalPrice: 54 });
  }
  assert.equal(resolveSelectionPrice({ ...product, variants: [] }, small).price, 44);
});
