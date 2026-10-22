import assert from 'node:assert/strict';
import test from 'node:test';
import { getCustomerFacingProductBadge as resolve, getProductBadgeFields, resolveProductBadgeMode } from '../src/data/productBadge.js';

for (const [flag, en, ar] of [
  ['newArrival', 'New', 'وصل حديثًا'],
  ['bestseller', 'Best Seller', 'الأكثر مبيعًا'],
  ['featured', 'Featured', 'مميز'],
]) test(`auto: ${flag} is bilingual and independent of manual text`, () => {
  const product = { badgeMode: 'auto', [flag]: true, badge: { en: 'Old text', ar: 'نص قديم' } };
  assert.equal(resolve(product, 'en'), en);
  assert.equal(resolve(product, 'ar'), ar);
});

test('auto priority and Quick Buy behavior', () => {
  assert.equal(resolve({ badgeMode: 'auto', newArrival: true, bestseller: true, featured: true }), 'New');
  assert.equal(resolve({ badgeMode: 'auto', bestseller: true, featured: true }), 'Best Seller');
  assert.equal(resolve({ badgeMode: 'auto', quickShop: true }), '');
  assert.equal(resolve({ badgeMode: 'auto' }), '');
  assert.equal(resolve({ badgeMode: 'none', newArrival: true, customBadge: { en: 'Exclusive' } }), '');
});

test('custom localization, Arabic-only text and safe same-product fallback', () => {
  const product = { badgeMode: 'custom', newArrival: true, customBadge: { en: 'Exclusive', ar: 'حصري' } };
  assert.equal(resolve(product, 'en'), 'Exclusive');
  assert.equal(resolve(product, 'ar'), 'حصري');
  assert.equal(resolve({ badgeMode: 'custom', customBadge: { en: '', ar: 'حصري' } }, 'ar'), 'حصري');
  assert.equal(resolve({ badgeMode: 'custom', customBadge: { en: '', ar: 'حصري' } }, 'en'), 'حصري');
  assert.equal(resolve({ badgeMode: 'custom', customBadge: { en: '', ar: '' }, badge: { en: 'Stale' } }), '');
});

test('legacy text is preserved, aliases work, and blank legacy text uses flags', () => {
  const legacy = { badge: { en: 'Featured', ar: 'مميز' }, newArrival: true };
  const before = JSON.stringify(legacy);
  assert.equal(resolveProductBadgeMode(legacy), 'custom');
  assert.equal(resolve(legacy), 'Featured');
  assert.equal(JSON.stringify(legacy), before);
  assert.equal(resolve({ label: 'Limited', labelAr: 'محدود' }, 'ar'), 'محدود');
  assert.equal(resolve({ badge: '', badgeAr: 'حصري' }, 'ar'), 'حصري');
  assert.equal(resolve({ isNewArrival: true }), 'New');
  assert.equal(resolve({ newArrival: false, isNewArrival: true }), '');
  assert.equal(getProductBadgeFields({ badge: 'Best Seller' }).bestseller, false);
  assert.equal(getProductBadgeFields({ quickShop: true }).quickShop, true);
});
