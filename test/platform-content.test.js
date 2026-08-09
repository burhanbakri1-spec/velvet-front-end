import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPlatformContent, getPlatformMedia, mapPlatformProduct, platformContentConfig } from '../src/data/platformContent.js';
import { productCategories, products } from '../src/data/products.js';

test('integration is opt-in and requires explicit tenant/site configuration', () => {
  assert.deepEqual(platformContentConfig({}), { enabled: false, apiUrl: '', companyId: '', siteId: '' });
  assert.deepEqual(platformContentConfig({ VITE_IGROUP_CONTENT_ENABLED: 'true', VITE_IGROUP_API_URL: 'https://api.test/', VITE_IGROUP_COMPANY_ID: 'kids-velvet', VITE_IGROUP_SITE_ID: 'kids-velvet-storefront' }), {
    enabled: true, apiUrl: 'https://api.test', companyId: 'kids-velvet', siteId: 'kids-velvet-storefront',
  });
});

test('platform products map bilingual fields and absolute media URLs without tenant input', () => {
  const category = { id: 'creative', slug: 'creative', nameEn: 'Creative', nameAr: 'إبداع' };
  const product = mapPlatformProduct({ id: 'p1', slug: 'toy', name: { en: 'Toy', ar: 'لعبة' }, description: { en: 'Fun', ar: 'مرح' }, shortDescription: { en: 'Short', ar: 'قصير' }, image: '/uploads/toy.jpg', categoryId: 'creative', price: 10, options: [] }, [category], 'https://api.test');
  assert.equal(product.name, 'Toy');
  assert.equal(product.nameAr, 'لعبة');
  assert.equal(product.image, 'https://api.test/uploads/toy.jpg');
  assert.equal(product.categorySlug, 'creative');
});

test('canonical payload replaces the runtime catalog instead of silently merging static products', () => {
  applyPlatformContent({ site: { id: 'kids-velvet-storefront', companyId: 'kids-velvet' }, categories: [{ id: 'c1', slug: 'toys', name: { en: 'Toys', ar: 'ألعاب' }, description: { en: '', ar: '' }, image: '', sortOrder: 1 }], products: [{ id: 'p1', slug: 'toy', name: { en: 'Toy', ar: 'لعبة' }, description: { en: '', ar: '' }, shortDescription: { en: '', ar: '' }, categoryId: 'c1', image: 'https://assets.test/toy.svg', price: 12 }], texts: [], media: [{ sectionKey: 'home.hero.poster', image: '/uploads/hero.jpg' }] }, 'https://api.test');
  assert.deepEqual(products.map((item) => item.slug), ['toy']);
  assert.deepEqual(productCategories.map((item) => item.slug), ['all', 'toys']);
  assert.equal(getPlatformMedia('home.hero.poster'), 'https://api.test/uploads/hero.jpg');
});
