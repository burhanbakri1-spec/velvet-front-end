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

test('Categories mega menu preview overlays brand logo on poster without strip wrapper', () => {
  const megaMenu = fs.readFileSync(new URL('../src/components/CategoriesMegaMenu.jsx', import.meta.url), 'utf8');
  assert.match(megaMenu, /getBrandLogo\(brand\.slug, locale\)/);
  assert.match(megaMenu, /getBrandMenuMedia\(brand\.slug\)/);
  assert.match(megaMenu, /mega-menu__preview-logo/);
  assert.doesNotMatch(megaMenu, /mega-menu__preview-brand/);
  assert.match(megaMenu, /onMouseEnter=\{\(\) => selectBrand\(item\.slug\)\}/);
});

test('BrandPage hero uses full-width adaptive media without hero logo', () => {
  const brandPage = fs.readFileSync(new URL('../src/pages/BrandPage.jsx', import.meta.url), 'utf8');
  const styles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(brandPage, /getBrandPageHeaderMedia\(slug\)/);
  assert.match(brandPage, /variant="full-banner"/);
  assert.doesNotMatch(brandPage, /getBrandLogo/);
  assert.doesNotMatch(brandPage, /category-hero__logo/);
  assert.match(styles, /\.category-hero\s*\{[^}]*height:\s*auto/);
  assert.match(styles, /\.category-hero\s*\{[^}]*overflow:\s*visible/);
  assert.match(styles, /\.category-hero__media[\s\S]*width:\s*100%/);
  assert.match(styles, /\.category-hero__media[\s\S]*height:\s*auto/);
  assert.match(styles, /\.category-hero__media[\s\S]*object-fit:\s*contain/);
  assert.doesNotMatch(styles, /\.category-hero__media[^}]*object-fit:\s*cover/);
  assert.doesNotMatch(styles, /\.category-hero\s*\{[^}]*100vh/);
  assert.match(styles, /\.brand-hero \.category-hero__media[\s\S]*max-height:\s*none/);
  assert.match(styles, /\.brand-showcase\.brand-showcase--full-banner[\s\S]*height:\s*auto/);
  assert.match(styles, /\.brand-showcase\.brand-showcase--full-banner \.brand-showcase__image[\s\S]*object-fit:\s*contain/);
  assert.doesNotMatch(styles, /\.brand-showcase\.brand-showcase--full-banner \.brand-showcase__image[^}]*object-fit:\s*cover/);
});

test('homepage BrandShowcase uses full-banner natural media without cover crop', () => {
  const homePage = fs.readFileSync(new URL('../src/pages/HomePage.jsx', import.meta.url), 'utf8');
  const showcase = fs.readFileSync(new URL('../src/components/BrandShowcase.jsx', import.meta.url), 'utf8');
  const styles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(homePage, /variant="full-banner"/);
  assert.match(showcase, /isFullBanner \? ' brand-showcase--full-banner'/);
  assert.match(showcase, /brand-showcase__content/);
  assert.match(showcase, /showcase-more/);
  assert.match(styles, /\.brand-showcase\.brand-showcase--full-banner[\s\S]{0,220}?height:\s*auto/);
  assert.match(styles, /\.brand-showcase\.brand-showcase--full-banner[\s\S]{0,220}?overflow:\s*visible/);
  assert.match(styles, /\.brand-showcase\.brand-showcase--full-banner \.brand-showcase__image[\s\S]{0,280}?width:\s*100%/);
  assert.match(styles, /\.brand-showcase\.brand-showcase--full-banner \.brand-showcase__image[\s\S]{0,280}?height:\s*auto/);
  assert.match(styles, /\.brand-showcase\.brand-showcase--full-banner \.brand-showcase__image[\s\S]{0,280}?object-fit:\s*contain/);
  assert.doesNotMatch(styles, /\.brand-showcase\.brand-showcase--full-banner \.brand-showcase__image[^}]*object-fit:\s*cover/);
  assert.doesNotMatch(styles, /\.brand-showcase\.brand-showcase--full-banner \.brand-showcase__image[^}]*position:\s*absolute/);
});

test('homepage brand banners overlay managed brand logos without affecting BrandPage', () => {
  const homePage = fs.readFileSync(new URL('../src/pages/HomePage.jsx', import.meta.url), 'utf8');
  const showcase = fs.readFileSync(new URL('../src/components/BrandShowcase.jsx', import.meta.url), 'utf8');
  const brandPage = fs.readFileSync(new URL('../src/pages/BrandPage.jsx', import.meta.url), 'utf8');
  const styles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

  assert.match(homePage, /showBrandLogo/);
  assert.match(showcase, /getBrandLogo/);
  assert.match(showcase, /hasUploadedBrandLogo/);
  assert.match(showcase, /brand-showcase__brand-logo/);
  assert.match(showcase, /showBrandLogo = false/);
  assert.doesNotMatch(brandPage, /showBrandLogo/);
  assert.match(styles, /\.brand-showcase__brand-logo[\s\S]{0,400}?position:\s*absolute/);
  assert.match(styles, /\.brand-showcase__brand-logo[\s\S]{0,400}?pointer-events:\s*none/);
  assert.match(styles, /\.brand-showcase__brand-logo[\s\S]{0,400}?object-fit:\s*contain/);
  assert.doesNotMatch(styles, /\.brand-showcase__brand-logo[^}]*background:\s*#/);
});

test('homepage prioritizes first banner media and lazy-loads the rest', () => {
  const homePage = fs.readFileSync(new URL('../src/pages/HomePage.jsx', import.meta.url), 'utf8');
  const showcase = fs.readFileSync(new URL('../src/components/BrandShowcase.jsx', import.meta.url), 'utf8');
  const styles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');

  assert.match(homePage, /mediaLoading=\{index === 0 \? 'eager' : 'lazy'\}/);
  assert.match(homePage, /mediaFetchPriority=\{index === 0 \? 'high' : undefined\}/);
  assert.doesNotMatch(homePage, /velvet-home-intro-seen|sessionStorage/);
  assert.match(showcase, /mediaLoading = 'lazy'/);
  assert.match(showcase, /loading=\{mediaLoading\}/);
  assert.match(main, /preconnect/);
  assert.match(styles, /\.brand-showcase\.brand-showcase--full-banner \.brand-showcase__tint[\s\S]{0,280}?linear-gradient/);
  assert.match(styles, /\.category-hero__shade[\s\S]{0,280}?linear-gradient/);
  assert.match(styles, /html\[lang="ar"\] \.brand-showcase__content h2[\s\S]{0,40}?font-size:\s*60px/);
  assert.match(styles, /html\[lang="ar"\] \.category-hero__title h1[\s\S]{0,80}?clamp\(60px/);
});
test('header uses managed-logo classes for uploaded artwork; mega menu overlays logo on poster', () => {
  const header = fs.readFileSync(new URL('../src/components/Header.jsx', import.meta.url), 'utf8');
  const megaMenu = fs.readFileSync(new URL('../src/components/CategoriesMegaMenu.jsx', import.meta.url), 'utf8');
  const brandPage = fs.readFileSync(new URL('../src/pages/BrandPage.jsx', import.meta.url), 'utf8');

  assert.match(header, /hasUploadedBrandLogo/);
  assert.match(header, /logo--managed/);
  assert.match(megaMenu, /mega-menu__preview-media/);
  assert.match(megaMenu, /mega-menu__preview-logo/);
  assert.doesNotMatch(megaMenu, /mega-menu__preview-brand/);
  assert.doesNotMatch(brandPage, /category-hero__logo/);
  assert.doesNotMatch(brandPage, /getBrandLogo/);
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