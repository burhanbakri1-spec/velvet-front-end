import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPlatformContent } from '../src/data/platformContent.js';
import {
  filterProducts,
  getBrand,
  getBrandLogo,
  getBrandMedia,
  getCategory,
  getPathProducts,
  getProductBySlug,
  getProductMedia,
  velvetBrands,
} from '../src/data/velvetCatalog.js';

const API = 'https://api.test';

function canonicalPayload({ withBrands = true } = {}) {
  return {
    site: { id: 'kids-velvet-storefront', companyId: 'kids-velvet' },
    brands: withBrands ? [
      {
        id: 'b1', slug: 'velvet-baby', name: { en: 'VELVET BABY', ar: 'VELVET BABY' },
        logoUrl: '/uploads/baby-logo.png', heroVideo: '/uploads/baby.mp4', heroPoster: '/uploads/baby-poster.jpg', sortOrder: 1,
      },
    ] : [],
    categories: [
      { id: 'c1', slug: 'baby-development', name: { en: 'Baby Development', ar: 'تنمية الطفل' }, description: { en: 'Soft first toys', ar: 'ألعاب ناعمة أولى' }, parentId: null, brandId: 'b1', image: '/uploads/c1.jpg', sortOrder: 1 },
      { id: 'c2', slug: 'bath-toys', name: { en: 'Bath Toys', ar: 'ألعاب الاستحمام' }, description: { en: '', ar: '' }, parentId: null, brandId: 'b1', image: '/uploads/c2.jpg', heroVideo: '/uploads/c2.mp4', sortOrder: 2 },
      { id: 's1', slug: 'sensory-toys', name: { en: 'Sensory Toys', ar: 'ألعاب حسية' }, parentId: 'c1', brandId: 'b1', sortOrder: 1 },
      { id: 's2', slug: 'fine-motor', name: { en: 'Fine Motor', ar: 'مهارات دقيقة' }, parentId: 'c1', brandId: 'b1', sortOrder: 2 },
    ],
    products: [
      {
        id: 'p1', slug: 'baby-sensory-set', name: { en: 'Baby Sensory Set', ar: 'طقم حسّي للرضع' },
        shortDescription: { en: 'Tactile first toys.', ar: 'ألعاب لمسية أولى.' }, description: { en: 'Soft, safe sensory fun.', ar: 'مرح حسي آمن وناعم.' },
        price: 34, originalPrice: 42, brandId: 'b1', mainCategoryId: 'c1', subcategoryId: 's1',
        image: '/uploads/p1.jpg', hoverImage: '/uploads/p1-h.jpg', gallery: ['/uploads/p1.jpg', '/uploads/p1-h.jpg'],
        usageVideo: '/uploads/p1.mp4', usageVideoPoster: '/uploads/p1-v.jpg',
        badge: { en: 'New', ar: 'جديد' }, availability: { en: 'In stock', ar: 'متوفر' },
        age: '0-12m', gender: 'unisex', skill: 'fine-motor', occasion: 'gift', manufacturer: 'Fisher-Price', sortOrder: 1,
      },
    ],
    texts: [],
    media: [
      { sectionKey: 'brand.velvet-baby.video', mediaType: 'video', video: '/uploads/legacy-baby.mp4' },
    ],
  };
}

test('dynamic catalog builds Brand → Main Category → Subcategory → Products from platform entities', () => {
  applyPlatformContent(canonicalPayload(), API);

  const brand = getBrand('velvet-baby');
  assert.ok(brand, 'brand must appear from the API');
  assert.equal(brand.name.en, 'VELVET BABY');

  // Main Categories hang directly under the brand (matched by brandId).
  assert.deepEqual(brand.categories.map((category) => category.slug), ['baby-development', 'bath-toys']);

  // Subcategories appear under their parent.
  const main = getCategory('velvet-baby', 'baby-development');
  assert.ok(main);
  assert.deepEqual(main.subs.map((sub) => sub.slug), ['sensory-toys', 'fine-motor']);

  // Product appears in the exact hierarchy.
  const exact = getPathProducts({ brand: 'velvet-baby', category: 'baby-development', subcategory: 'sensory-toys' });
  assert.deepEqual(exact.map((product) => product.slug), ['baby-sensory-set']);
  const product = getProductBySlug('baby-sensory-set');
  assert.ok(product);
  assert.deepEqual(product.velvetPath, { brandId: 'velvet-baby', categoryId: 'baby-development', subcategoryId: 'sensory-toys' });
});

test('a category renders under its brand even with zero products', () => {
  applyPlatformContent(canonicalPayload(), API);

  const emptyMain = getCategory('velvet-baby', 'bath-toys');
  assert.ok(emptyMain, 'main category must appear even without products');
  assert.deepEqual(emptyMain.subs, []);
  assert.deepEqual(filterProducts({ brand: 'velvet-baby', category: 'bath-toys' }), []);
});

test('brand, category and product pages consume entity-owned media directly', () => {
  applyPlatformContent(canonicalPayload(), API);

  // Brand entity media is canonical even when a legacy brand.* media slot exists.
  const media = getBrandMedia('velvet-baby');
  assert.equal(media.video, 'https://api.test/uploads/baby.mp4');
  assert.equal(media.poster, 'https://api.test/uploads/baby-poster.jpg');
  assert.equal(getBrandLogo('velvet-baby'), 'https://api.test/uploads/baby-logo.png');

  const bath = getCategory('velvet-baby', 'bath-toys');
  assert.equal(bath.heroImage, 'https://api.test/uploads/c2.jpg');
  assert.equal(bath.heroVideo, 'https://api.test/uploads/c2.mp4');

  const product = getProductBySlug('baby-sensory-set');
  const productMedia = getProductMedia(product);
  assert.equal(productMedia.usageVideo, 'https://api.test/uploads/p1.mp4');
  assert.equal(productMedia.usageVideoPoster, 'https://api.test/uploads/p1-v.jpg');
});

test('a product without a subcategory sits directly under its main category', () => {
  const payload = canonicalPayload();
  payload.products[0] = { ...payload.products[0], subcategoryId: 'c1' };
  applyPlatformContent(payload, API);

  const product = getProductBySlug('baby-sensory-set');
  assert.equal(product.velvetPath.subcategoryId, '');
  assert.deepEqual(getPathProducts({ brand: 'velvet-baby', category: 'baby-development' }).map((entry) => entry.slug), ['baby-sensory-set']);
  assert.deepEqual(getPathProducts({ brand: 'velvet-baby', category: 'baby-development', subcategory: 'sensory-toys' }), []);
});

test('a product whose declared hierarchy does not resolve is not placed', () => {
  const payload = canonicalPayload();
  payload.products[0] = { ...payload.products[0], slug: 'pocket-worlds-starter-set', brandId: 'b9' };
  applyPlatformContent(payload, API);

  assert.deepEqual(getPathProducts({ brand: 'velvet-baby', category: 'baby-development' }), []);
  assert.deepEqual(getPathProducts({ brand: 'velvet-baby' }), []);
  assert.equal(getProductBySlug('pocket-worlds-starter-set'), null, 'dynamic mode must not recover an unresolved product from the static catalog');
});

test('static VELVET catalog remains the fallback when no brand entities are supplied', () => {
  applyPlatformContent(canonicalPayload({ withBrands: false }), API);

  assert.equal(getBrand('velvet-baby'), null);
  assert.ok(getBrand('baby'), 'static brand must remain');
  assert.equal(velvetBrands.length, 12);
  assert.equal(getProductBySlug('pocket-worlds-starter-set')?.slug, 'pocket-worlds-starter-set', 'static fallback mode must keep static product lookup');

  // Static brand media still honours the legacy brand.* media slots as fallback.
  applyPlatformContent({ ...canonicalPayload({ withBrands: false }), media: [{ sectionKey: 'brand.baby.video', mediaType: 'video', video: '/uploads/baby-legacy.mp4' }] }, API);
  assert.equal(getBrandMedia('baby').video, 'https://api.test/uploads/baby-legacy.mp4');
});
