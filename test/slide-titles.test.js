import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { buildDynamicCatalog } from '../src/data/dynamicCatalog.js';
import { getProductName, readCanonicalName } from '../src/data/products.js';
import { buildProductTitleSequence, gallerySlideDirection, resolveProductSlides, stepTitleIndex } from '../src/data/slideTitles.js';

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

function walk(titles, directions) {
  let titleIndex = 0;
  let imageIndex = 0;
  const imageCount = 4;
  const frames = [{ imageIndex, title: titles[titleIndex] }];
  directions.forEach((direction) => {
    imageIndex = (imageIndex + (direction === 'next' ? 1 : -1) + imageCount) % imageCount;
    titleIndex = stepTitleIndex(titleIndex, titles.length, direction);
    frames.push({ imageIndex, title: titles[titleIndex] });
  });
  return frames;
}

test('initial title is the Arabic canonical name, then English, then custom titles', () => {
  const titles = buildProductTitleSequence(product);
  assert.deepEqual(titles, ['طقم البناء', 'Build Club Maker Kit', 'عنوان البناء', 'Build Club', 'Studio set', 'Fourth title']);
  assert.equal(titles[0], 'طقم البناء');
  const frames = walk(titles, ['next', 'next', 'previous']);
  assert.equal(frames[1].title, 'Build Club Maker Kit');
  assert.equal(frames[2].title, 'عنوان البناء');
  assert.equal(frames[3].title, 'Build Club Maker Kit');
});

test('four or more custom titles stay in sort order and ignore gallery image ids', () => {
  const titles = buildProductTitleSequence({
    ...product,
    slideTitles: [
      { title: 'Fourth custom', galleryImageId: 'gallery-ar', sortOrder: 4 },
      { title: 'Third custom', galleryImageId: 'gallery-fourth', sortOrder: 3 },
      { title: 'First custom', galleryImageId: 'no-image', sortOrder: 1 },
      { title: 'Second custom', galleryImageId: 'gallery-en', sortOrder: 2 },
    ],
  });
  assert.deepEqual(titles.slice(2), ['First custom', 'Second custom', 'Third custom', 'Fourth custom']);
});

test('title index wraps independently when there are more images than titles', () => {
  const titles = buildProductTitleSequence({
    name: 'English kit',
    nameAr: 'طقم',
    slideTitles: [{ title: 'Custom line', sortOrder: 0 }],
  });
  const frames = walk(titles, ['next', 'next', 'next', 'next']);
  assert.deepEqual(frames.map((frame) => frame.title), ['طقم', 'English kit', 'Custom line', 'طقم', 'English kit']);
  assert.deepEqual(frames.map((frame) => frame.imageIndex), [0, 1, 2, 3, 0]);
});

test('title index wraps independently when there are more titles than images', () => {
  const titles = buildProductTitleSequence(product);
  let titleIndex = 0;
  let imageIndex = 0;
  const imageCount = 2;
  for (let step = 0; step < 5; step += 1) {
    imageIndex = (imageIndex + 1) % imageCount;
    titleIndex = stepTitleIndex(titleIndex, titles.length, 'next');
  }
  assert.equal(imageIndex, 1);
  assert.equal(titles[titleIndex], 'Fourth title');
});

test('a single valid title does not move when arrows are used', () => {
  const titles = buildProductTitleSequence({ name: 'Only English', nameAr: 'Only English', slideTitles: [{ title: 'Only English', sortOrder: 0 }] });
  assert.deepEqual(titles, ['Only English']);
  assert.equal(stepTitleIndex(0, titles.length, 'next'), 0);
  assert.equal(stepTitleIndex(0, titles.length, 'previous'), 0);
});

test('missing Arabic starts at English, and missing both names start at the first custom title', () => {
  assert.equal(buildProductTitleSequence({ name: 'English only', nameAr: '', slideTitles: [{ title: 'Extra', sortOrder: 1 }] })[0], 'English only');
  assert.deepEqual(buildProductTitleSequence({ name: ' ', nameAr: '', slideTitles: [{ title: 'Only custom', sortOrder: 2 }] }), ['Only custom']);
});

test('rapid next and previous settle on the last requested title', () => {
  const titles = buildProductTitleSequence(product);
  let titleIndex = 0;
  ['next', 'next', 'next', 'previous', 'next'].forEach((direction) => {
    titleIndex = stepTitleIndex(titleIndex, titles.length, direction);
  });
  assert.equal(titles[titleIndex], 'Build Club');
});

test('title slides use the same timing and direction as the image transition', () => {
  const page = fs.readFileSync(new URL('../src/pages/ProductDetailsPage.jsx', import.meta.url), 'utf8');
  const slide = fs.readFileSync(new URL('../src/components/ProductDetailSlide.jsx', import.meta.url), 'utf8');
  const styles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(page, /titleMotion/);
  assert.match(slide, /translate3d\(\$\{percent\}%, 0, 0\)/);
  assert.match(slide, /PRODUCT_SWITCH_DURATION_MS/);
  assert.match(styles, /\.product-detail-title__slide \{[^}]*width:\s*100%/);
  assert.match(styles, /\.product-detail-title\.is-transitioning \.product-detail-title__slide \{[^}]*transform 500ms cubic-bezier\(0\.22, 1, 0\.36, 1\)/);
  assert.match(styles, /\.product-switcher-viewport\.is-transitioning \.product-switcher-slide \{[^}]*transform 500ms cubic-bezier\(0\.22, 1, 0\.36, 1\)/);
});

test('thumbnail selection changes the image index and leaves the title index unchanged', () => {
  const page = fs.readFileSync(new URL('../src/pages/ProductDetailsPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /beginImageTransition\('next', true\)/);
  assert.match(page, /beginImageTransition\('previous', true\)/);
  assert.match(page, /beginImageTransitionTo\(index, gallerySlideDirection\(imageIndex, index\)\)/);
  let titleIndex = 2;
  const thumbnailIndex = 0;
  assert.equal(gallerySlideDirection(1, thumbnailIndex), 'previous');
  assert.equal(titleIndex, 2);
});

test('canonical names that also appear in slide titles are not repeated', () => {
  const titles = buildProductTitleSequence({
    name: 'Build Club',
    nameAr: 'طقم البناء',
    slideTitles: [
      { title: 'طقم البناء', sortOrder: 0 },
      { title: '  Build Club  ', sortOrder: 1 },
      { title: 'Studio set', sortOrder: 2 },
    ],
  });
  assert.deepEqual(titles, ['طقم البناء', 'Build Club', 'Studio set']);
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
  assert.deepEqual(buildProductTitleSequence(mapped), ['طقم الخريطة', 'Gallery Map Set', 'Middle slide']);
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
  assert.deepEqual(buildProductTitleSequence(mapped), ['طقم جزئي', 'Partial Gallery Set', 'Second slide']);
});

test('canonical Arabic and English stay independent and titles follow Arabic, English, then custom slides', () => {
  const monopoly = { name: 'Monopoly', nameAr: 'مونوبولي', sku: 'VELVET-173-MONOPOLY' };
  const sponge = { name: 'Sponge Ball and Cube', nameAr: 'كرة ومكعب اسفنج', sku: 'VELVET-104' };
  assert.equal(getProductName(monopoly, 'ar'), 'مونوبولي');
  assert.equal(getProductName(monopoly, 'en'), 'Monopoly');
  assert.equal(getProductName(sponge, 'ar'), 'كرة ومكعب اسفنج');
  assert.equal(getProductName(sponge, 'en'), 'Sponge Ball and Cube');
  assert.equal(getProductName({ name: 'Monopoly', nameAr: '' }, 'ar'), 'Monopoly');
  assert.equal(getProductName({ name: '', nameAr: 'مونوبولي' }, 'en'), 'مونوبولي');
  assert.equal(readCanonicalName({ en: 'Monopoly' }, 'ar'), '');
  assert.notEqual(readCanonicalName({ en: 'Monopoly', ar: 'مونوبولي' }, 'ar'), 'Monopoly');

  const mapped = buildMappedProduct({
    id: 'velvet-173',
    slug: 'velvet-173-monopoly',
    sku: 'VELVET-173-MONOPOLY',
    name: { en: 'Monopoly', ar: 'مونوبولي' },
    brandId: 'b1',
    mainCategoryId: 'c1',
    slideTitles: [
      { title: 'Custom #2', sortOrder: 2 },
      { title: 'Custom #1', sortOrder: 1 },
      { title: 'مونوبولي', sortOrder: 0 },
    ],
  });
  assert.equal(mapped.name, 'Monopoly');
  assert.equal(mapped.nameAr, 'مونوبولي');
  assert.deepEqual(buildProductTitleSequence(mapped), ['مونوبولي', 'Monopoly', 'Custom #1', 'Custom #2']);
  assert.deepEqual(buildProductTitleSequence({
    name: 'Sponge Ball and Cube',
    nameAr: 'كرة ومكعب اسفنج',
  }), ['كرة ومكعب اسفنج', 'Sponge Ball and Cube']);

  const englishOnly = buildMappedProduct({
    id: 'en-only',
    slug: 'en-only',
    name: { en: 'English only' },
    brandId: 'b1',
    mainCategoryId: 'c1',
  });
  assert.equal(englishOnly.nameAr, '');
  assert.equal(getProductName(englishOnly, 'ar'), 'English only');
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
  assert.deepEqual(buildProductTitleSequence(mapped), ['طقم قديم', 'Legacy Gallery Set']);
});
