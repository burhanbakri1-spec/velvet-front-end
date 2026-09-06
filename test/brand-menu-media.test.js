import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { applyPlatformContent, getBrandMenuMedia, getPlatformMedia } from '../src/data/platformContent.js';
import { getBrandMedia, getBrandPageHeaderMedia } from '../src/data/velvetCatalog.js';

const API = 'https://api.test';
const megaMenu = fs.readFileSync(new URL('../src/components/CategoriesMegaMenu.jsx', import.meta.url), 'utf8');

function basePayload(extra = {}) {
  return {
    site: { id: 'kids-velvet-storefront', companyId: 'kids-velvet' },
    brands: [],
    categories: [
      { id: 'c1', slug: 'toys', name: { en: 'Toys', ar: 'ألعاب' }, description: { en: '', ar: '' }, image: '', sortOrder: 1 },
    ],
    products: [
      {
        id: 'p1', slug: 'toy', name: { en: 'Toy', ar: 'لعبة' }, description: { en: '', ar: '' },
        shortDescription: { en: '', ar: '' }, categoryId: 'c1', image: 'https://assets.test/toy.svg', price: 12,
      },
    ],
    texts: [],
    media: [],
    ...extra,
  };
}

test('BABY and KIDS can use independent menuImage values', () => {
  applyPlatformContent(basePayload({
    media: [
      { sectionKey: 'brand.baby.menuImage', image: '/uploads/baby-menu.jpg' },
      { sectionKey: 'brand.kids.menuImage', image: '/uploads/kids-menu.jpg' },
      { sectionKey: 'brand.baby.poster', image: '/uploads/baby-poster.jpg' },
      { sectionKey: 'brand.kids.poster', image: '/uploads/kids-poster.jpg' },
    ],
  }), API);

  assert.equal(getBrandMenuMedia('baby').poster, 'https://api.test/uploads/baby-menu.jpg');
  assert.equal(getBrandMenuMedia('kids').poster, 'https://api.test/uploads/kids-menu.jpg');
  assert.notEqual(getBrandMenuMedia('baby').poster, getBrandMenuMedia('kids').poster);
});

test('multiple brands may intentionally share the same menuImage URL', () => {
  applyPlatformContent(basePayload({
    media: [
      { sectionKey: 'brand.baby.menuImage', image: '/uploads/shared-menu.jpg' },
      { sectionKey: 'brand.play.menuImage', image: '/uploads/shared-menu.jpg' },
    ],
  }), API);

  assert.equal(getBrandMenuMedia('baby').poster, 'https://api.test/uploads/shared-menu.jpg');
  assert.equal(getBrandMenuMedia('play').poster, 'https://api.test/uploads/shared-menu.jpg');
});

test('menuImage does not affect brand.headerImage and headerImage does not affect menuImage', () => {
  applyPlatformContent(basePayload({
    brands: [
      {
        id: 'b1', slug: 'baby', name: { en: 'VELVET BABY', ar: 'VELVET BABY' },
        headerImage: '/uploads/baby-header.jpg',
        heroPoster: '/uploads/baby-hero.jpg',
        menuImage: '/uploads/baby-menu-entity.jpg',
        sortOrder: 1,
      },
    ],
    media: [
      { sectionKey: 'brand.kids.menuImage', image: '/uploads/kids-menu-only.jpg' },
      { sectionKey: 'brand.kids.headerImage', image: '/uploads/kids-header-only.jpg' },
      { sectionKey: 'brand.kids.poster', image: '/uploads/kids-poster.jpg' },
    ],
  }), API);

  assert.equal(getBrandMenuMedia('baby').poster, 'https://api.test/uploads/baby-menu-entity.jpg');
  assert.equal(getBrandPageHeaderMedia('baby').poster, 'https://api.test/uploads/baby-header.jpg');
  assert.notEqual(getBrandMenuMedia('baby').poster, getBrandPageHeaderMedia('baby').poster);

  assert.equal(getBrandMenuMedia('kids').poster, 'https://api.test/uploads/kids-menu-only.jpg');
  assert.equal(getBrandPageHeaderMedia('kids').poster, 'https://api.test/uploads/kids-header-only.jpg');
  assert.notEqual(getBrandMenuMedia('kids').poster, getBrandPageHeaderMedia('kids').poster);
  assert.notEqual(getBrandMedia('kids').poster, getBrandMenuMedia('kids').poster);
});

test('empty menuImage falls back to existing Mega Menu poster media only for that brand', () => {
  applyPlatformContent(basePayload({
    media: [
      { sectionKey: 'brand.baby.poster', image: '/uploads/baby-poster.jpg' },
      { sectionKey: 'brand.kids.menuImage', image: '/uploads/kids-menu.jpg' },
      { sectionKey: 'brand.kids.poster', image: '/uploads/kids-poster.jpg' },
    ],
  }), API);

  assert.equal(getPlatformMedia('brand.baby.menuImage'), '');
  assert.equal(getBrandMenuMedia('baby').poster, 'https://api.test/uploads/baby-poster.jpg');
  assert.equal(getBrandMenuMedia('kids').poster, 'https://api.test/uploads/kids-menu.jpg');
  assert.notEqual(getBrandMenuMedia('baby').poster, getBrandMenuMedia('kids').poster);
});

test('Mega Menu hover/focus wires preview to getBrandMenuMedia for the active brand', () => {
  assert.match(megaMenu, /getBrandMenuMedia\(brand\.slug\)/);
  assert.match(megaMenu, /onMouseEnter=\{\(\) => selectBrand\(item\.slug\)\}/);
  assert.match(megaMenu, /onFocus=\{\(\) => selectBrand\(item\.slug\)\}/);
  assert.match(megaMenu, /data-mega-brand-preview=\{brand\.slug\}/);
  assert.match(megaMenu, /mega-menu__preview-media/);
  assert.doesNotMatch(megaMenu, /getBrandMedia\(brand\.slug\)/);
});
