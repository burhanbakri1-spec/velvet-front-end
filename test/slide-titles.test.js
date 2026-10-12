import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDynamicCatalog } from '../src/data/dynamicCatalog.js';
import { gallerySlideDirection, resolveProductSlides, resolveSlideTitle } from '../src/data/slideTitles.js';

const API = 'https://api.test';

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

function buildMappedProduct(rawProduct) {
  const catalog = buildDynamicCatalog({
    brands: [{ id: 'b1', slug: 'velvet-baby', name: { en: 'VELVET BABY', ar: 'VELVET BABY' } }],
    categories: [
      { id: 'c1', slug: 'baby-development', name: { en: 'Baby Development', ar: 'تنمية الطفل' }, parentId: null, brandId: 'b1', sortOrder: 1 },
    ],
    products: [rawProduct],
  }, API);
  assert.equal(catalog?.products.length, 1, 'the mapped product must be placed in the catalog');
  return catalog.products[0];
}

test('galleryItems in a different order than gallery still attach the correct id to each URL', () => {
  const mapped = buildMappedProduct({
    id: 'gallery-map-1', slug: 'gallery-map-set',
    name: { en: 'Gallery Map Set', ar: 'طقم الخريطة' },
    brandId: 'b1', mainCategoryId: 'c1',
    image: '/uploads/a.jpg', hoverImage: '/uploads/c.jpg',
    gallery: ['/uploads/a.jpg', '/uploads/b.jpg', '/uploads/c.jpg'],
    galleryItems: [
      { id: 'gi-c', url: '/uploads/c.jpg', sortOrder: 0 },
      { id: 'gi-a', url: '/uploads/a.jpg', sortOrder: 1 },
      { id: 'gi-b', url: '/uploads/b.jpg', sortOrder: 2 },
    ],
    slideTitles: [{ id: 't-b', title: 'Middle slide', language: 'en', galleryImageId: 'gi-b', sortOrder: 0 }],
  });

  assert.deepEqual(mapped.gallery, [
    'https://api.test/uploads/a.jpg',
    'https://api.test/uploads/b.jpg',
    'https://api.test/uploads/c.jpg',
  ], 'gallery keeps the raw.gallery URL order');
  assert.deepEqual(mapped.galleryItems, [
    { id: 'gi-c', url: 'https://api.test/uploads/c.jpg', sortOrder: 0 },
    { id: 'gi-a', url: 'https://api.test/uploads/a.jpg', sortOrder: 1 },
    { id: 'gi-b', url: 'https://api.test/uploads/b.jpg', sortOrder: 2 },
  ]);

  const slides = resolveProductSlides(mapped, {});
  assert.deepEqual(slides.map((slide) => slide.id), ['gi-a', 'gi-b', 'gi-c']);
  assert.equal(resolveSlideTitle({ product: mapped, galleryImageId: slides[1].id, locale: 'en' }), 'Middle slide');
  assert.equal(resolveSlideTitle({ product: mapped, galleryImageId: slides[2].id, locale: 'en' }), 'Gallery Map Set');
});

test('a gallery URL without a matching galleryItems URL keeps an empty id and the canonical name', () => {
  const mapped = buildMappedProduct({
    id: 'gallery-map-2', slug: 'gallery-map-partial',
    name: { en: 'Partial Gallery Set', ar: 'طقم جزئي' },
    brandId: 'b1', mainCategoryId: 'c1',
    image: '/uploads/one.jpg',
    gallery: ['/uploads/one.jpg', '/uploads/two.jpg'],
    galleryItems: [{ id: 'gi-first', url: '/uploads/two.jpg', sortOrder: 0 }],
    slideTitles: [{ id: 't-two', title: 'Second slide', language: 'en', galleryImageId: 'gi-first', sortOrder: 0 }],
  });

  const slides = resolveProductSlides(mapped, {});
  assert.equal(slides[0].id, '', 'the unmatched gallery URL must not borrow another item id');
  assert.equal(slides[1].id, 'gi-first');
  assert.equal(resolveSlideTitle({ product: mapped, galleryImageId: slides[0].id, locale: 'en' }), 'Partial Gallery Set');
  assert.equal(resolveSlideTitle({ product: mapped, galleryImageId: slides[0].id, locale: 'ar' }), 'طقم جزئي');
  assert.equal(resolveSlideTitle({ product: mapped, galleryImageId: slides[1].id, locale: 'en' }), 'Second slide');
});

test('products without galleryItems keep the legacy URL-only ids', () => {
  const mapped = buildMappedProduct({
    id: 'gallery-map-3', slug: 'gallery-map-legacy',
    name: { en: 'Legacy Gallery Set', ar: 'طقم قديم' },
    brandId: 'b1', mainCategoryId: 'c1',
    image: '/uploads/x.jpg',
    gallery: ['/uploads/x.jpg', '/uploads/y.jpg'],
  });

  assert.deepEqual(mapped.gallery, [
    'https://api.test/uploads/x.jpg',
    'https://api.test/uploads/y.jpg',
  ]);
  assert.deepEqual(mapped.galleryItems, [
    { id: '', url: 'https://api.test/uploads/x.jpg' },
    { id: '', url: 'https://api.test/uploads/y.jpg' },
  ]);
  const slides = resolveProductSlides(mapped, {});
  assert.ok(slides.every((slide) => slide.id === ''));
  assert.equal(resolveSlideTitle({ product: mapped, galleryImageId: slides[0].id, locale: 'en' }), 'Legacy Gallery Set');
});
