import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPlatformContent } from '../src/data/platformContent.js';
import { getBrand, getBrandMedia } from '../src/data/velvetCatalog.js';

test('each VELVET brand exposes accent, wordmark, poster and video slots', () => {
  for (const brand of ['baby', 'kids', 'play', 'build', 'learn', 'create', 'games', 'move', 'collect', 'plush', 'books', 'muslim']) {
    const entry = getBrand(brand);
    assert.ok(entry, `missing brand ${brand}`);
    assert.ok(entry.accent, `missing accent for ${brand}`);
    assert.ok(entry.palette.length >= 3, `missing palette for ${brand}`);
    assert.ok(entry.home.logo.en, `missing wordmark for ${brand}`);
    assert.equal(entry.heroVideo, '', `unexpected static video for ${brand}`);
    assert.ok(entry.heroPoster === '', `unexpected static poster for ${brand}`);
  }
});

test('brand hero media is driven by managed platform slots with image fallback', () => {
  assert.equal(getBrandMedia('baby').video, '');
  assert.ok(getBrandMedia('baby').poster);

  applyPlatformContent({
    site: { id: 'kids-velvet-storefront', companyId: 'kids-velvet' },
    categories: [],
    products: [],
    texts: [],
    media: [
      { sectionKey: 'brand.baby.video', mediaType: 'video', video: '/uploads/baby.mp4' },
      { sectionKey: 'brand.baby.poster', image: '/uploads/baby-poster.jpg' },
    ],
  }, 'https://api.test');

  const baby = getBrandMedia('baby');
  assert.equal(baby.video, 'https://api.test/uploads/baby.mp4');
  assert.equal(baby.poster, 'https://api.test/uploads/baby-poster.jpg');

  const kids = getBrandMedia('kids');
  assert.equal(kids.video, '');
  assert.ok(kids.poster);
  assert.equal(getBrandMedia('unknown').video, '');
});