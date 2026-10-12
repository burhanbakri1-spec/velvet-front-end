import assert from 'node:assert/strict';
import test from 'node:test';
import { gallerySlideDirection, resolveProductSlides, resolveSlideTitle } from '../src/data/slideTitles.js';

const product = {
  name: 'Build Club Maker Kit',
  nameAr: 'طقم البناء',
  galleryItems: [
    { id: 'gallery-ar', url: 'https://cdn.test/ar.webp' },
    { id: 'gallery-en', url: 'https://cdn.test/en.webp' },
    { id: 'gallery-extra', url: 'https://cdn.test/extra.webp' },
    { id: 'gallery-fourth', url: 'https://cdn.test/fourth.webp' },
  ],
  gallery: [
    'https://cdn.test/ar.webp',
    'https://cdn.test/en.webp',
    'https://cdn.test/extra.webp',
    'https://cdn.test/fourth.webp',
  ],
  slideTitles: [
    { id: 't1', title: 'عنوان البناء', language: 'ar', galleryImageId: 'gallery-ar', sortOrder: 0 },
    { id: 't2', title: 'Build Club', language: 'en', galleryImageId: 'gallery-en', sortOrder: 1 },
    { id: 't3', title: 'Studio set', language: 'en', galleryImageId: 'gallery-extra', sortOrder: 2 },
    { id: 't4', title: 'Fourth title', language: 'en', galleryImageId: 'gallery-fourth', sortOrder: 3 },
  ],
  slideTitleFallbacks: [
    { title: 'احتياطي', language: 'ar', galleryImageId: 'gallery-missing', sortOrder: 0 },
    { title: 'Fallback kit', language: 'en', galleryImageId: 'gallery-missing', sortOrder: 1 },
  ],
  options: [],
  variants: [],
};

test('saved slide titles resolve by gallery image id for Arabic and English', () => {
  assert.equal(resolveSlideTitle({ product, galleryImageId: 'gallery-ar', locale: 'en' }), 'عنوان البناء');
  assert.equal(resolveSlideTitle({ product, galleryImageId: 'gallery-en', locale: 'ar' }), 'Build Club');
});

test('three or more configured slide titles each stay independent', () => {
  const titles = ['gallery-ar', 'gallery-en', 'gallery-extra', 'gallery-fourth']
    .map((galleryImageId) => resolveSlideTitle({ product, galleryImageId, locale: 'en' }));
  assert.deepEqual(titles, ['عنوان البناء', 'Build Club', 'Studio set', 'Fourth title']);
  assert.equal(new Set(titles).size, 4);
});

test('missing explicit titles use the locale fallback, then the canonical name', () => {
  assert.equal(resolveSlideTitle({ product, galleryImageId: 'gallery-missing', locale: 'ar' }), 'احتياطي');
  assert.equal(resolveSlideTitle({ product, galleryImageId: 'gallery-missing', locale: 'en' }), 'Fallback kit');
  assert.equal(resolveSlideTitle({ product, galleryImageId: '', locale: 'ar' }), 'طقم البناء');
  assert.equal(resolveSlideTitle({ product, galleryImageId: 'unknown', locale: 'en' }), 'Build Club Maker Kit');
});

test('resolved titles are never Arabic and English concatenated', () => {
  const title = resolveSlideTitle({ product, galleryImageId: 'gallery-ar', locale: 'en' });
  assert.equal(title.includes('Build Club'), false);
  assert.equal(title.includes('\n'), false);
});

test('gallery slides keep stable ids and arrows or thumbnails move the same title', () => {
  const slides = resolveProductSlides(product, {});
  assert.equal(slides[2].id, 'gallery-extra');
  let index = 0;
  const nextIndex = (index + 1) % slides.length;
  assert.equal(gallerySlideDirection(index, nextIndex), 'next');
  index = nextIndex;
  const previousIndex = index - 1;
  assert.equal(gallerySlideDirection(index, previousIndex), 'previous');
  const thumbnailIndex = 3;
  assert.equal(gallerySlideDirection(index, thumbnailIndex), 'next');
  index = thumbnailIndex;
  assert.equal(resolveSlideTitle({ product, galleryImageId: slides[index].id, locale: 'en' }), 'Fourth title');
});

test('rapid index changes settle on the last requested slide title', () => {
  const slides = resolveProductSlides(product, {});
  let index = 0;
  [1, 3, 2].forEach((target) => {
    gallerySlideDirection(index, target);
    index = target;
  });
  assert.equal(index, 2);
  assert.equal(resolveSlideTitle({ product, galleryImageId: slides[index].id, locale: 'en' }), 'Studio set');
});

test('url-only gallery items do not invent an id match', () => {
  const bare = {
    ...product,
    galleryItems: product.gallery.map((url) => ({ id: '', url })),
  };
  const slides = resolveProductSlides(bare, {});
  assert.ok(slides.every((slide) => slide.id === ''));
  assert.equal(resolveSlideTitle({ product: bare, galleryImageId: slides[0].id, locale: 'en' }), 'Build Club Maker Kit');
});
