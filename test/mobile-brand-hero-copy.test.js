import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (relative) => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

const styles = read('../src/styles.css');
const brandPage = read('../src/pages/BrandPage.jsx');

// The mobile-only brand hero copy block (it is the last block in styles.css).
const mobileBlock = styles.match(/Mobile brand hero copy[\s\S]*$/)?.[0] ?? '';

test('mobile brand hero copy stacks subtitle above title inside the image', () => {
  assert.ok(mobileBlock, 'mobile brand hero copy block missing from styles.css');
  assert.match(mobileBlock, /@media \(max-width: 760px\)/, 'scoped to phones only');

  const heroRule = mobileBlock.match(/\.brand-hero \{[^{}]*\}/)?.[0] ?? '';
  assert.ok(heroRule, 'brand hero flex rule missing');
  assert.match(heroRule, /display: flex;/, 'copy becomes one layout');
  // column-reverse puts the first DOM node (title) below the second (subtitle).
  assert.match(heroRule, /flex-direction: column-reverse;/, 'subtitle renders above the title');
  assert.match(heroRule, /justify-content: flex-start;/, 'stack packs against the bottom edge');
  assert.match(heroRule, /align-items: stretch;/, 'copy spans the hero width');
  assert.match(heroRule, /gap: 10px;/, 'clear vertical spacing between subtitle and title');
  assert.match(heroRule, /padding-block-end: 20px;/, 'keeps the current bottom placement');
  assert.match(heroRule, /padding-inline: var\(--mobile-gutter, 20px\);/, 'keeps the current side insets');
});

test('mobile copy leaves the anchor offsets and typography alone', () => {
  const copyRule = mobileBlock.match(/\.brand-hero \.category-hero__title,[\s\S]*?\}/)?.[0] ?? '';
  assert.ok(copyRule, 'brand hero copy rule missing');
  assert.match(copyRule, /position: relative;/, 'copy stays in flow but paints above the shade');
  assert.match(copyRule, /z-index: 2;/, 'copy paints above the hero media and shade');
  // The RTL/mobile !important anchors (left/right/gutter) must not win, otherwise
  // relative positioning shifts the stack sideways in Arabic.
  assert.match(copyRule, /html\[dir="rtl"\] \.brand-hero \.category-hero__title,/);
  assert.match(copyRule, /left: auto !important;/, 'no horizontal relative shift (LTR)');
  assert.match(copyRule, /right: auto !important;/, 'no horizontal relative shift (RTL)');
  assert.match(copyRule, /text-align: start;/, 'keeps the existing alignment');

  assert.doesNotMatch(mobileBlock, /font-size|font-family|line-height|letter-spacing/,
    'existing typography is preserved');
  assert.doesNotMatch(mobileBlock, /object-fit|background|height:/, 'hero image and banner height untouched');
});

test('desktop hero anchors and contrast are unchanged', () => {
  assert.match(styles, /\.category-hero__title \{ position: absolute;[^}]*left: 64px; bottom: 62px;/,
    'desktop title keeps its absolute anchor');
  assert.match(styles, /\.category-hero__description \{ position: absolute;[^}]*right: 64px; bottom: 68px;/,
    'desktop subtitle keeps its absolute anchor');
  assert.match(styles, /\.category-hero__title \{ position: absolute;[^}]*text-shadow:/,
    'title keeps its readability shadow');
  assert.match(styles, /\.category-hero__description \{ position: absolute;[^}]*text-shadow:/,
    'subtitle keeps its readability shadow');

  const reverseIdx = styles.indexOf('flex-direction: column-reverse;');
  assert.ok(reverseIdx > -1, 'mobile stacking rule missing');
  const mediaBefore = styles.lastIndexOf('@media', reverseIdx);
  assert.match(styles.slice(mediaBefore, reverseIdx), /^@media \(max-width: 760px\)/,
    'stacking rule only runs on phones');
});

test('brand markup order is untouched (layout is fixed in CSS)', () => {
  assert.match(brandPage, /className=\{`category-hero brand-hero /, 'brand hero class present');
  const titleIdx = brandPage.indexOf('category-hero__title');
  const descIdx = brandPage.indexOf('category-hero__description');
  assert.ok(titleIdx > -1, 'brand title missing');
  assert.ok(descIdx > titleIdx, 'brand subtitle still follows the title in the DOM');
});
