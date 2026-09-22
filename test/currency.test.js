import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { formatPrice, STOREFRONT_CURRENCY_SYMBOL } from '../src/data/currency.js';
import { formatOrderPrice } from '../src/data/whatsappOrder.js';

const priceSources = [
  '../src/components/ProductCard.jsx',
  '../src/components/ProductDetailSlide.jsx',
  '../src/components/CartDrawer.jsx',
  '../src/components/SearchDropdown.jsx',
  '../src/components/CategoryProductShowcase.jsx',
  '../src/pages/CartPage.jsx',
  '../src/pages/CheckoutPage.jsx',
  '../src/data/whatsappOrder.js',
].map((rel) => ({
  rel,
  source: fs.readFileSync(new URL(rel, import.meta.url), 'utf8'),
}));

test('shared currency formatter displays shekels without converting amounts', () => {
  assert.equal(STOREFRONT_CURRENCY_SYMBOL, '₪');
  assert.equal(formatPrice(24.5), '₪24.50');
  assert.equal(formatPrice(0), '₪0.00');
  assert.equal(formatPrice('15'), '₪15.00');
  assert.equal(formatPrice(Number.NaN), '₪0.00');
  assert.equal(formatOrderPrice(64), '₪64.00');
});

test('customer-facing price surfaces import shared formatPrice and do not hardcode $', () => {
  for (const { rel, source } of priceSources) {
    assert.match(source, /from ['"].*currency['"]|from ['"]\.\/currency\.js['"]/, `${rel} should use shared currency`);
    assert.doesNotMatch(source, /=\s*\(value\)\s*=>\s*`\$\$\{/, `${rel} should not keep local $ formatPrice`);
    assert.doesNotMatch(source, /<strong>\$\{/, `${rel} should not hardcode $ in JSX`);
  }
});
