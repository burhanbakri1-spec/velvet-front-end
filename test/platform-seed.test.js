import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlatformSeed } from '../src/data/platformSeed.js';

test('preview seed represents the real static catalog without data URI media', () => {
  const seed = buildPlatformSeed('https://preview.example');
  assert.equal(seed.companyId, 'kids-velvet');
  assert.equal(seed.siteId, 'kids-velvet-storefront');
  assert.equal(seed.products.length, 8);
  assert.equal(seed.categories.length, 7);
  assert.ok(seed.products.every((product) => product.galleryImages.length === 3));
  assert.doesNotMatch(JSON.stringify(seed), /data:image|api\.ebchemi\.com|icare/i);
  assert.ok(seed.texts.some((item) => item.key === 'copy.home.introP1' && item.valueEn && item.valueAr));
  assert.ok(seed.media.some((item) => item.sectionKey === 'home.hero.poster'));
});
