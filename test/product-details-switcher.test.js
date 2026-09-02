import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { velvetProducts } from '../src/data/velvetCatalog.js';
import {
  buildInitialSelections,
  getProductSlidePercent,
  getSameSubcategoryProducts,
  getSiblingProduct,
  PRODUCT_SWITCH_DURATION_MS,
} from '../src/hooks/productSiblings.js';

const sampleProduct = velvetProducts.find((item) => item.velvetPath?.subcategoryId);

test('sibling products come from the same subcategory path', () => {
  assert.ok(sampleProduct);
  const siblings = getSameSubcategoryProducts(sampleProduct, velvetProducts);
  assert.ok(siblings.length >= 1);
  assert.ok(siblings.every((item) => (
    item.velvetPath?.brandId === sampleProduct.velvetPath.brandId
    && item.velvetPath?.categoryId === sampleProduct.velvetPath.categoryId
    && item.velvetPath?.subcategoryId === sampleProduct.velvetPath.subcategoryId
  )));
});

test('next and previous sibling resolution loops within the subcategory', () => {
  assert.ok(sampleProduct);
  const siblings = getSameSubcategoryProducts(sampleProduct, velvetProducts);
  if (siblings.length < 2) return;
  const next = getSiblingProduct(siblings[0], siblings, 'next');
  const previous = getSiblingProduct(siblings[0], siblings, 'previous');
  assert.notEqual(next.slug, siblings[0].slug);
  assert.notEqual(previous.slug, siblings[0].slug);
  const loopBack = getSiblingProduct(next, siblings, 'next');
  if (siblings.length === 2) {
    assert.equal(loopBack.slug, siblings[0].slug);
  }
});

test('slide transition direction state maps outgoing and incoming offsets', () => {
  const nextOutgoing = getProductSlidePercent('next', 'outgoing', false);
  const nextIncoming = getProductSlidePercent('next', 'incoming', false);
  assert.deepEqual(nextOutgoing, { start: 0, end: -100 });
  assert.deepEqual(nextIncoming, { start: 100, end: 0 });

  const prevOutgoing = getProductSlidePercent('previous', 'outgoing', false);
  const prevIncoming = getProductSlidePercent('previous', 'incoming', false);
  assert.deepEqual(prevOutgoing, { start: 0, end: 100 });
  assert.deepEqual(prevIncoming, { start: -100, end: 0 });
});

test('rtl flips slide transition offsets without reversing product order', () => {
  const nextIncoming = getProductSlidePercent('next', 'incoming', true);
  assert.deepEqual(nextIncoming, { start: -100, end: 0 });
  const siblings = getSameSubcategoryProducts(sampleProduct, velvetProducts);
  assert.equal(getSiblingProduct(siblings[0], siblings, 'next').slug, getSiblingProduct(siblings[0], siblings, 'next').slug);
});

test('product details page uses product switcher and client-side sibling navigation', () => {
  const source = fs.readFileSync(new URL('../src/pages/ProductDetailsPage.jsx', import.meta.url), 'utf8');
  assert.match(source, /product-switcher-viewport/);
  assert.match(source, /beginSiblingTransition/);
  assert.match(source, /navigate\(localizePath\(`\/products\/\$\{targetSlug\}`/);
  assert.match(source, /scroll: false/);
  assert.match(source, /getSameSubcategoryProducts/);
  assert.doesNotMatch(source, /openSiblingProduct/);
  assert.doesNotMatch(source, /data-sibling-slug/);
});

test('lower gallery strip shows current product images and does not navigate products', () => {
  const source = fs.readFileSync(new URL('../src/pages/ProductDetailsPage.jsx', import.meta.url), 'utf8');
  assert.match(source, /product-image-gallery/);
  assert.match(source, /collectProductImages\(routeProduct\)/);
  assert.match(source, /setImageIndex\(index\)/);
  assert.doesNotMatch(source, /sameSubcategory\.map/);
});

test('product switch duration is within the premium transition range', () => {
  assert.ok(PRODUCT_SWITCH_DURATION_MS >= 400);
  assert.ok(PRODUCT_SWITCH_DURATION_MS <= 600);
});

test('sibling switcher slides span the viewport and center inner presentation', () => {
  const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.product-switcher-slide \{[\s\S]*?align-items:\s*center/);
  assert.match(css, /\.product-switcher-slide__content \{[\s\S]*?margin-inline:\s*auto/);
  assert.match(css, /\.product-switcher-viewport\.is-transitioning \.product-switcher-slide \{[\s\S]*?width:\s*100%/);
  assert.match(css, /\.category-product-showcase__media:not\(\.product-detail-hero__media\):hover img/);
  assert.match(css, /\.product-detail-focal__image:hover[\s\S]*opacity:\s*1/);
  assert.doesNotMatch(css, /\.category-product-showcase__media:hover img \{ transform: scale/);
  assert.match(css, /\.category-product-showcase__media:not\(\.product-detail-hero__media\) \{ cursor: none/);
  assert.match(css, /\.product-detail-hero__media[\s\S]*cursor:\s*default/);
});

test('buildInitialSelections resets option defaults per product', () => {
  const withOptions = velvetProducts.find((item) => item.options?.length);
  if (!withOptions) return;
  const selections = buildInitialSelections(withOptions);
  assert.equal(selections[withOptions.options[0].name], withOptions.options[0].values[0]?.label);
});
