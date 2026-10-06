import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (relative) => fs.readFileSync(new URL(`../src/${relative}`, import.meta.url), 'utf8');

const styles = read('styles.css');
const filterBar = read('components/ShopFilterBar.jsx');
const productsPage = read('pages/ProductsPage.jsx');

// The single mobile rule that hides the density switch (plus the tools-row fix).
const mobileDensityBlock = styles.match(
  /@media \(max-width: 760px\) \{\s*\.shop-grid-density \{\s*display: none;\s*\}[\s\S]{0,200}?\}/,
)?.[0] ?? '';

test('grid-density controls are hidden at viewport widths <= 760px', () => {
  assert.ok(mobileDensityBlock, 'a max-width: 760px rule must hide the density switch');
  assert.match(mobileDensityBlock, /\.shop-grid-density \{\s*display: none;/);
  // Scoped to the media query only — never hidden globally (desktop must keep them).
  assert.doesNotMatch(styles, /^\.shop-grid-density \{\s*display: none;/m);
});

test('hiding the icons leaves no empty gap in the tools row', () => {
  assert.match(
    mobileDensityBlock,
    /\.shop-filter-tools \{\s*justify-content: flex-end;/,
    'Sort stays on the trailing edge instead of the density icons leaving a hole',
  );
  assert.doesNotMatch(mobileDensityBlock, /shop-filter-bar__sort/, 'the hide rule must not touch Sort');
  assert.doesNotMatch(mobileDensityBlock, /shop-filter-bar__search/, 'the hide rule must not touch Search');
  assert.doesNotMatch(mobileDensityBlock, /shop-filter-bar__toggle/, 'the hide rule must not touch Filter');
  assert.doesNotMatch(mobileDensityBlock, /shop-products/, 'the hide rule must not touch the product grid');
});

test('desktop keeps the grid-density controls visible and functional', () => {
  assert.match(styles, /\.shop-grid-density \{\s*display: inline-flex;/, 'base rule still shows the control');
  assert.doesNotMatch(styles, /@media \(min-width: 761px\)[\s\S]{0,200}?\.shop-grid-density \{[^}]*display: none/);

  // The component is intact, not removed or gated by a viewport check.
  assert.match(filterBar, /export \{ GridDensityControl \};/);
  assert.match(filterBar, /data-shop-grid-density/);
  assert.match(filterBar, /\[2,\s*3\]\.map/);
  assert.match(filterBar, /onClick=\{\(\) => onGridColsChange\(cols\)\}/);
  assert.match(filterBar, /showDensity \?/);
  assert.doesNotMatch(filterBar, /matchMedia|@media|innerWidth/);
  assert.match(productsPage, /onGridColsChange=\{setGridCols\}/);
  assert.match(productsPage, /shop-products--pref-\$\{gridCols\}/);
});

test('mobile product grid and Shop search/filter/sort/category controls are unchanged', () => {
  // Mobile keeps the same 2/3 column preferences as desktop (no layout change).
  assert.match(styles, /\.shop-products--pref-2 \{ grid-template-columns: repeat\(2,/);
  assert.match(styles, /\.shop-products--pref-3 \{ grid-template-columns: repeat\(3,/);
  assert.match(styles, /@media \(max-width: 560px\)[\s\S]*\.shop-products--pref-2 \{[\s\S]*?repeat\(2,/);
  assert.match(styles, /@media \(max-width: 560px\)[\s\S]*\.shop-products--pref-3 \{[\s\S]*?repeat\(3,/);

  // Search, Filter, Sort and the quick category chips still render and stay visible.
  assert.match(styles, /@media \(max-width: 760px\) \{\s*\.shop-filter-bar__row\.shop-filter-bar__row--filter \{/);
  assert.match(styles, /\.shop-filter-bar__search-input \{/);
  assert.match(styles, /\.shop-filter-bar__sort \{/);
  assert.match(styles, /\.shop-filter-bar__quick-chip \{/);
  assert.doesNotMatch(styles, /\.shop-filter-bar__sort \{[^}]*display: none/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]{0,400}?\.shop-filter-bar__search \{[^}]*display: flex/, 'search stays visible on mobile');
  assert.match(filterBar, /type="search"/);
  assert.match(filterBar, /aria-expanded=\{open\}/);
  assert.match(filterBar, /onChange=\{\(event\) => onSortChange\(event\.target\.value\)\}/);
  assert.match(filterBar, /shop-filter-bar__quick-chip/);
});
