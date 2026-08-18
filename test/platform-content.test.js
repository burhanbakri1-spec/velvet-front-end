import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { applyPlatformContent, getPlatformMedia, mapPlatformCategory, mapPlatformProduct, platformContentConfig } from '../src/data/platformContent.js';
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

test('mapPlatformCategory exposes a managed heroVideo slot', () => {
  const category = mapPlatformCategory({ id: 'toys', slug: 'toys', name: { en: 'Toys', ar: 'ألعاب' }, description: { en: '', ar: '' }, image: '/uploads/toys.jpg', sortOrder: 1 }, 'https://api.test', { toys: '/uploads/toys.mp4' });
  assert.equal(category.heroImage, 'https://api.test/uploads/toys.jpg');
  assert.equal(category.heroVideo, 'https://api.test/uploads/toys.mp4');
  const withoutVideo = mapPlatformCategory({ id: 'toys', slug: 'toys', name: { en: 'Toys', ar: 'ألعاب' }, description: { en: '', ar: '' }, image: '', sortOrder: 1 }, 'https://api.test');
  assert.equal(withoutVideo.heroVideo, '');
});

test('managed video slots drive the home, about and category hero videos', () => {
  applyPlatformContent({
    site: { id: 'kids-velvet-storefront', companyId: 'kids-velvet' },
    categories: [{ id: 'toys', slug: 'toys', name: { en: 'Toys', ar: 'ألعاب' }, description: { en: '', ar: '' }, image: '', sortOrder: 1 }],
    products: [],
    texts: [],
    media: [
      { sectionKey: 'home.hero.video', mediaType: 'video', video: '/uploads/home.mp4' },
      { sectionKey: 'about.hero.video', mediaType: 'video', video: '/uploads/about.mp4' },
      { sectionKey: 'category.toys.heroVideo', mediaType: 'video', video: '/uploads/toys.mp4' },
      { sectionKey: 'home.hero.poster', image: '/uploads/hero-poster.jpg' },
    ],
  }, 'https://api.test');
  assert.equal(getPlatformMedia('home.hero.video'), 'https://api.test/uploads/home.mp4');
  assert.equal(getPlatformMedia('about.hero.video'), 'https://api.test/uploads/about.mp4');
  assert.equal(getPlatformMedia('home.hero.poster'), 'https://api.test/uploads/hero-poster.jpg');
  assert.equal(productCategories.find((category) => category.slug === 'toys').heroVideo, 'https://api.test/uploads/toys.mp4');
});

test('site.logo media is exposed for the header and keeps the local logo as fallback', () => {
  applyPlatformContent({
    site: { id: 'kids-velvet-storefront', companyId: 'kids-velvet' },
    categories: [],
    products: [],
    texts: [],
    media: [
      { sectionKey: 'site.logo', image: '/uploads/site-logo.png' },
      { sectionKey: 'about.0.image', image: '/uploads/about-0.jpg' },
      { sectionKey: 'news.0.image', image: '/uploads/news-0.jpg' },
    ],
  }, 'https://api.test');
  assert.equal(getPlatformMedia('site.logo'), 'https://api.test/uploads/site-logo.png');
  assert.equal(getPlatformMedia('about.0.image'), 'https://api.test/uploads/about-0.jpg');
  assert.equal(getPlatformMedia('news.0.image'), 'https://api.test/uploads/news-0.jpg');
  assert.equal(getPlatformMedia('site.logo.missing'), '');
  assert.equal(getPlatformMedia('brand.logo'), '');
});

test('header renders the managed site logo and falls back to the text logo when absent', () => {
  const headerSource = fs.readFileSync(new URL('../src/components/Header.jsx', import.meta.url), 'utf8');
  assert.match(headerSource, /getPlatformMedia\('site\.logo'\)/);
  assert.match(headerSource, /className="logo__img"/);
  assert.match(headerSource, /<span>VELVET<\/span>/);
  assert.match(headerSource, /siteLogo \? /);
});

test('brand pages consume brand.{slug}.logo with the local static logo as fallback', () => {
  const brandPage = fs.readFileSync(new URL('../src/pages/BrandPage.jsx', import.meta.url), 'utf8');
  assert.match(brandPage, /getBrandLogo\(slug\)/);
  assert.match(brandPage, /category-hero__logo-img/);
  assert.match(brandPage, /brand\.home\.logo\[locale\]/);
  const headerSource = fs.readFileSync(new URL('../src/components/Header.jsx', import.meta.url), 'utf8');
  assert.match(headerSource, /getBrandLogo\(contextBrand\.slug\)/);
  assert.match(headerSource, /logo__img--brand/);
});