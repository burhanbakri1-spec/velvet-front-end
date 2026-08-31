import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { applyPlatformContent } from '../src/data/platformContent.js';
import { getBrand, getBrandAbout, getBrandLogo, getBrandMedia, hasUploadedBrandLogo, isGeneratedBrandLogo } from '../src/data/velvetCatalog.js';

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
      { sectionKey: 'brand.baby.logo', image: '/uploads/baby-logo.png' },
    ],
  }, 'https://api.test');

  const baby = getBrandMedia('baby');
  assert.equal(baby.video, 'https://api.test/uploads/baby.mp4');
  assert.equal(baby.poster, 'https://api.test/uploads/baby-poster.jpg');
  assert.equal(getBrandLogo('baby'), 'https://api.test/uploads/baby-logo.png');

  const kids = getBrandMedia('kids');
  assert.equal(kids.video, '');
  assert.ok(kids.poster);
  assert.equal(getBrandMedia('unknown').video, '');
});

test('brand.{slug}.logo falls back to the static branch wordmark artwork when absent', () => {
  const kidsLogo = getBrandLogo('kids');
  assert.ok(kidsLogo.startsWith('data:image/svg+xml'), 'local branch logo must render as an SVG image');
  assert.equal(getBrandLogo('unknown'), '');
  const brand = getBrand('kids');
  assert.ok(brand.home.logo.en, 'local branch wordmark metadata must remain available');
});

test('uploaded brand logos are distinct from generated fallback artwork', () => {
  applyPlatformContent({
    site: { id: 'kids-velvet-storefront', companyId: 'kids-velvet' },
    categories: [],
    products: [],
    texts: [],
    media: [{ sectionKey: 'brand.baby.logo', image: '/uploads/baby-logo.png' }],
  }, 'https://api.test');

  const uploaded = getBrandLogo('baby');
  assert.equal(uploaded, 'https://api.test/uploads/baby-logo.png');
  assert.equal(isGeneratedBrandLogo(uploaded), false);
  assert.equal(hasUploadedBrandLogo('baby', 'en'), true);
  assert.equal(hasUploadedBrandLogo('baby', 'ar'), true);
  assert.equal(hasUploadedBrandLogo('kids', 'en'), false);
});

test('header, mega menu and brand page use managed-logo classes for uploaded artwork', () => {
  const header = fs.readFileSync(new URL('../src/components/Header.jsx', import.meta.url), 'utf8');
  const megaMenu = fs.readFileSync(new URL('../src/components/CategoriesMegaMenu.jsx', import.meta.url), 'utf8');
  const brandPage = fs.readFileSync(new URL('../src/pages/BrandPage.jsx', import.meta.url), 'utf8');

  assert.match(header, /hasUploadedBrandLogo/);
  assert.match(header, /logo--managed/);
  assert.match(megaMenu, /mega-menu__preview-brand--managed/);
  assert.match(megaMenu, /mega-menu__preview-logo--managed/);
  assert.match(brandPage, /category-hero__logo-img--managed/);
});

test('brand about content prefers platform copy and falls back to catalog tagline', () => {
  const playEn = getBrandAbout('play', 'en');
  assert.ok(playEn);
  assert.equal(playEn.title, 'About VELVET PLAY');
  assert.match(playEn.description, /Pretend Play/);

  const playAr = getBrandAbout('play', 'ar');
  assert.equal(playAr.title, 'عن VELVET PLAY');
  assert.match(playAr.description, /التمثيل/);

  applyPlatformContent({
    site: { id: 'kids-velvet-storefront', companyId: 'kids-velvet' },
    categories: [],
    products: [],
    texts: [
      { key: 'brand.play.about.eyebrow', values: { en: 'Discover', ar: 'اكتشف' } },
      { key: 'brand.play.about.title', values: { en: 'About VELVET PLAY', ar: 'عن VELVET PLAY' } },
      { key: 'brand.play.about.description', values: { en: 'Managed PLAY copy.', ar: 'نص PLAY من المنصة.' } },
    ],
    media: [],
  }, 'https://api.test');

  const managed = getBrandAbout('play', 'en');
  assert.equal(managed.eyebrow, 'Discover');
  assert.equal(managed.description, 'Managed PLAY copy.');
  assert.equal(getBrandAbout('unknown', 'en'), null);
});