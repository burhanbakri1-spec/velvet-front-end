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
  getSubcategory,
  velvetBrands,
  velvetTaxonomyStats,
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
      { sectionKey: 'brand.baby.video', mediaType: 'video', video: '/uploads/legacy-baby.mp4' },
    ],
  };
}

test('dynamic catalog keeps workbook taxonomy and remaps platform brand media/products', () => {
  applyPlatformContent(canonicalPayload(), API);

  const brand = getBrand('baby');
  assert.ok(brand, 'workbook brand slug remains canonical');
  assert.equal(getBrand('velvet-baby'), null);
  assert.equal(brand.name.en, 'VELVET BABY');
  assert.ok(brand.categories.length >= 10, 'full workbook mains remain available');
  assert.ok(getCategory('baby', 'baby-development'));
  assert.ok(getCategory('baby', 'bath-toys'));
  assert.deepEqual(
    getSubcategory('baby', 'baby-development', 'sensory-toys')?.name.en,
    'Sensory Toys',
  );

  const exact = getPathProducts({ brand: 'baby', category: 'baby-development', subcategory: 'sensory-toys' });
  assert.deepEqual(exact.map((product) => product.slug), ['baby-sensory-set']);
  const product = getProductBySlug('baby-sensory-set');
  assert.ok(product);
  assert.deepEqual(product.velvetPath, { brandId: 'baby', categoryId: 'baby-development', subcategoryId: 'sensory-toys' });
  assert.equal(product.price, 34);
  assert.equal(product.image, 'https://api.test/uploads/p1.jpg');
});

test('a category renders under its brand even with zero products', () => {
  applyPlatformContent(canonicalPayload(), API);

  const emptyMain = getCategory('baby', 'bath-toys');
  assert.ok(emptyMain, 'main category must appear even without products');
  assert.ok(Array.isArray(emptyMain.subs));
  assert.deepEqual(filterProducts({
    brand: 'baby', category: 'bath-toys', subcategory: '', manufacturer: '', age: [], gender: [], skill: [], occasion: [], shopping: [], search: '',
  }).filter((product) => product.velvetPath?.categoryId === 'bath-toys' && product.velvetPath?.subcategoryId), []);
});

test('brand, category and product pages consume entity-owned media directly', () => {
  applyPlatformContent(canonicalPayload(), API);

  const media = getBrandMedia('baby');
  assert.equal(media.video, 'https://api.test/uploads/baby.mp4');
  assert.equal(media.poster, 'https://api.test/uploads/baby-poster.jpg');
  assert.equal(getBrandLogo('baby'), 'https://api.test/uploads/baby-logo.png');

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
  assert.deepEqual(getPathProducts({ brand: 'baby', category: 'baby-development' }).map((entry) => entry.slug), ['baby-sensory-set']);
  assert.deepEqual(getPathProducts({ brand: 'baby', category: 'baby-development', subcategory: 'sensory-toys' }), []);
});

test('a product whose declared hierarchy does not resolve is not placed', () => {
  const payload = canonicalPayload();
  payload.products[0] = { ...payload.products[0], slug: 'pocket-worlds-starter-set', brandId: 'b9', id: 'unmapped-x' };
  applyPlatformContent(payload, API);

  assert.deepEqual(getPathProducts({ brand: 'baby', category: 'baby-development' }), []);
  assert.deepEqual(getPathProducts({ brand: 'baby' }).filter((item) => item.slug === 'pocket-worlds-starter-set'), []);
  assert.equal(getProductBySlug('pocket-worlds-starter-set'), null, 'dynamic mode must not recover an unresolved product from the static catalog');
});

test('static VELVET catalog remains the fallback when no brand entities are supplied', () => {
  applyPlatformContent(canonicalPayload({ withBrands: false }), API);

  assert.equal(getBrand('velvet-baby'), null);
  assert.ok(getBrand('baby'), 'static brand must remain');
  assert.equal(velvetBrands.length, velvetTaxonomyStats.brands);
  assert.equal(getProductBySlug('pocket-worlds-starter-set')?.slug, 'pocket-worlds-starter-set', 'static fallback mode must keep static product lookup');

  applyPlatformContent({ ...canonicalPayload({ withBrands: false }), media: [{ sectionKey: 'brand.baby.video', mediaType: 'video', video: '/uploads/baby-legacy.mp4' }] }, API);
  assert.equal(getBrandMedia('baby').video, 'https://api.test/uploads/baby-legacy.mp4');
});
