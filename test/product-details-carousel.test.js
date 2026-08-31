import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  isSiblingDragGesture,
  shouldNavigateSibling,
  SIBLING_DRAG_CLICK_THRESHOLD,
} from '../src/hooks/siblingCarousel.js';

test('shouldNavigateSibling opens only a different sibling when not dragged', () => {
  assert.equal(shouldNavigateSibling({ dragged: false, targetSlug: 'product-b', currentSlug: 'product-a' }), true);
  assert.equal(shouldNavigateSibling({ dragged: true, targetSlug: 'product-b', currentSlug: 'product-a' }), false);
  assert.equal(shouldNavigateSibling({ dragged: false, targetSlug: 'product-a', currentSlug: 'product-a' }), false);
  assert.equal(shouldNavigateSibling({ dragged: false, targetSlug: '', currentSlug: 'product-a' }), false);
});

test('isSiblingDragGesture ignores small pointer movement', () => {
  assert.equal(isSiblingDragGesture(10, 10, 14, 12, SIBLING_DRAG_CLICK_THRESHOLD), false);
  assert.equal(isSiblingDragGesture(10, 10, 30, 10, SIBLING_DRAG_CLICK_THRESHOLD), true);
});

test('product details gallery drag uses pointer threshold without product navigation', () => {
  const source = fs.readFileSync(new URL('../src/pages/ProductDetailsPage.jsx', import.meta.url), 'utf8');
  assert.match(source, /galleryViewportRef/);
  assert.match(source, /onGalleryPointerDown/);
  assert.match(source, /isSiblingDragGesture/);
  assert.doesNotMatch(source, /openSiblingProduct/);
  assert.doesNotMatch(source, /onPointerUp=\{onSiblingPointerUp\}/);
});
