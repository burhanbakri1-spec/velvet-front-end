import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { selectBrandStripProducts } from '../src/data/brandProductStrip.js';

const source = (file) => fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
const product = (id, brandId, categoryId, subcategoryId = '', extra = {}) => ({
  id, slug: id, name: id, price: 10,
  velvetPath: { brandId, categoryId, subcategoryId },
  ...extra,
});

test('brand pages enumerate their storefront-visible main categories in source order', () => {
  const page = source('pages/BrandPage.jsx');
  assert.match(page, /getStorefrontCategories\(brand\)/);
  assert.match(page, /categoryBanners\.map\(\(category, index\)/);
  assert.match(page, /key=\{category\.slug\}/);
  assert.match(page, /category\.heroImage/);
  assert.match(page, /category\.name/);
  assert.match(page, /category\.description\?\.en/);
  assert.match(page, /category\.description\?\.ar/);
  assert.doesNotMatch(page, /\['baby'|\['kids'|categoryBanners\s*=\s*\[/);
});

test('main-category strip includes its own and descendant products only, once per product identity', () => {
  const products = [
    product('main', 'baby', 'clothing'),
    product('child-a', 'baby', 'clothing', 'sleepwear'),
    product('child-b', 'baby', 'clothing', 'outerwear'),
    product('duplicate-child', 'baby', 'clothing', 'sleepwear'),
    product('duplicate-child', 'baby', 'clothing', 'outerwear', { name: 'duplicate catalog association' }),
    product('sibling', 'baby', 'feeding', 'bottles'),
    product('other-brand', 'kids', 'clothing', 'sleepwear'),
    product('unclassified', 'baby', '', 'sleepwear'),
    product('hidden', 'baby', 'clothing', 'sleepwear', { active: false }),
  ];
  const selected = selectBrandStripProducts(products, 'baby', { categorySlug: 'clothing' });
  assert.deepEqual(selected.map((entry) => entry.id), ['main', 'child-a', 'child-b', 'duplicate-child']);
  assert.deepEqual(selectBrandStripProducts([], 'baby', { categorySlug: 'clothing' }), []);
});

test('category strip links remain scoped to the brand and main category', () => {
  const strip = source('components/BrandProductStrip.jsx');
  const page = source('pages/BrandPage.jsx');
  assert.match(page, /<BrandProductStrip brandSlug=\{slug\} deckIndex=\{index\} categorySlug=\{category\.slug\}/);
  assert.match(strip, /data-category=\{categorySlug \|\| undefined\}/);
  assert.match(strip, /`\/products\?brand=\$\{encodeURIComponent\(brandSlug\)\}&category=\$\{encodeURIComponent\(categorySlug\)\}/);
});

test('Brand category deck opts into the shared Home reverse choreography without tagging Home', () => {
  const page = source('pages/BrandPage.jsx');
  const home = source('pages/HomePage.jsx');
  const motion = source('components/useHeroStageMotion.js');
  assert.match(page, /id="showcases" data-brand-category-deck/);
  assert.match(home, /id="showcases" data-home-brand-deck/);
  assert.match(motion, /root\.hasAttribute\('data-home-brand-deck'\) \|\| root\.hasAttribute\('data-brand-category-deck'\)/);
  assert.match(motion, /latchHomeDeckMode\(direction\.mode, delta, rawPreviousLocal, rawLocal, slides, geometryCache, mobileHomeReverseEntry\)/);
  assert.match(motion, /homeReverseMotion\(slides, local, stageHeight, pinHeight, geometryCache, mobileHomeReverseEntry\)/);
});
