import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { filterProducts, getProductBySlug } from '../src/data/velvetCatalog.js';
import { getCustomerFacingOptions } from '../src/data/products.js';
import { productStock } from '../src/data/inventory.js';
import { products as staticProducts } from '../src/data/products.js';

const searchDropdown = fs.readFileSync(new URL('../src/components/SearchDropdown.jsx', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('Arabic search normalization works in filterProducts', () => {
  // Get some products with Arabic names
  const allProducts = filterProducts({ age: [], gender: [], skill: [], occasion: [], shopping: [] });
  const arabicProduct = allProducts.find(p => p.nameAr && p.nameAr.length > 0);
  
  if (arabicProduct) {
    const arabicName = arabicProduct.nameAr;
    // Test with hamza variant
    const withHamza = arabicName.replace(/ا/g, 'أ');
    const results1 = filterProducts({ search: withHamza, age: [], gender: [], skill: [], occasion: [], shopping: [] });
    const results2 = filterProducts({ search: arabicName, age: [], gender: [], skill: [], occasion: [], shopping: [] });
    
    // Both should match the same products
    assert.ok(results1.length > 0, 'Should find products with hamza variant');
    assert.ok(results2.length > 0, 'Should find products with normalized Arabic');
    
    // The slug should be in both results
    const slugs1 = new Set(results1.map(p => p.slug));
    const slugs2 = new Set(results2.map(p => p.slug));
    assert.ok(slugs1.has(arabicProduct.slug), 'Original product should match with hamza variant');
    assert.ok(slugs2.has(arabicProduct.slug), 'Original product should match with normalized');
  }
});

test('SearchDropdown source has quick add button', () => {
  assert.match(searchDropdown, /handleQuickAdd/);
  assert.match(searchDropdown, /search-dropdown__quick-add/);
  assert.match(searchDropdown, /search-dropdown__result-row/);
  assert.match(searchDropdown, /getCustomerFacingOptions/);
  assert.match(searchDropdown, /productStock/);
  assert.match(searchDropdown, /useCart/);
  assert.match(searchDropdown, /addItem/);
  assert.match(searchDropdown, /event\.stopPropagation/);
  assert.match(searchDropdown, /event\.preventDefault/);
});

test('SearchDropdown quick add handles normal product', () => {
  assert.match(searchDropdown, /hasRequiredOptions[\s\S]*getCustomerFacingOptions\(product\)/);
  assert.match(searchDropdown, /unavailable[\s\S]*!isAvailable\(product\)/);
  assert.match(searchDropdown, /addItem\(product, \{\}, 1, product\.image\)/);
});

test('SearchDropdown quick add does not auto-select variant for products with options', () => {
  // Products with customer-facing options should navigate to PDP, not auto-add
  assert.match(searchDropdown, /options\.length > 0/);
  assert.match(searchDropdown, /goProduct\(product\.slug\)/);
  assert.match(searchDropdown, /return;/); // Early return after navigation
});

test('SearchDropdown quick add click does not navigate', () => {
  assert.match(searchDropdown, /event\.stopPropagation/);
  assert.match(searchDropdown, /event\.preventDefault/);
});

test('SearchDropdown shows added state briefly', () => {
  assert.match(searchDropdown, /setQuickAdded\(product\.slug\)/);
  assert.match(searchDropdown, /setTimeout\(\(\) => setQuickAdded\(null\)/, 'Should clear added state after delay');
});

test('SearchDropdown keeps dropdown open after quick add', () => {
  // Should NOT call setDismissed(true) after successful quick add
  assert.doesNotMatch(searchDropdown, /setQuickAdded\(product\.slug\)[\s\S]{0,100}setDismissed\(true\)/);
});

test('SearchDropdown quick add disabled for unavailable products', () => {
  assert.match(searchDropdown, /disabled=\{unavailable \|\| isJustAdded\}/);
  assert.match(searchDropdown, /search-dropdown__quick-add--disabled/);
});

test('SearchDropdown shows different icons for different states', () => {
  assert.match(searchDropdown, /isJustAdded \?[\s\S]*?✓/);
  assert.match(searchDropdown, /needsOptions \?[\s\S]*?→/);
  assert.match(searchDropdown, /\+/); // Default plus icon
});

test('SearchDropdown quick add has RTL/LTR styling', () => {
  assert.match(styles, /\[dir="rtl"\] .search-dropdown__quick-add/);
  assert.match(styles, /margin-inline-start/);
  assert.match(styles, /margin-inline-end/);
});

test('SearchDropdown quick add button has proper accessibility', () => {
  assert.match(searchDropdown, /aria-label=/);
  assert.match(searchDropdown, /copy\.detail\.unavailable/);
  assert.match(searchDropdown, /copy\.detail\.viewProduct/);
  assert.match(searchDropdown, /copy\.detail\.added/);
  assert.match(searchDropdown, /copy\.detail\.add/);
});

test('CSS has quick add styles with RTL support', () => {
  assert.match(styles, /\.search-dropdown__result-row/);
  assert.match(styles, /\.search-dropdown__quick-add/);
  assert.match(styles, /border-radius: 50%/);
  assert.match(styles, /search-dropdown__quick-add--disabled/);
  assert.match(styles, /search-dropdown__quick-add--has-options/);
  assert.match(styles, /search-dropdown__quick-add--added/);
  assert.match(styles, /@keyframes searchDropdownQuickAddPop/);
  assert.match(styles, /\[dir="rtl"\] .search-dropdown__quick-add/);
});

test('Products with customer-facing options are detected correctly', () => {
  // Find products with options
  const productsWithOptions = staticProducts.filter(p => 
    getCustomerFacingOptions(p).length > 0
  );
  assert.ok(productsWithOptions.length > 0, 'Should have products with options');
  
  // Verify they have proper options structure
  for (const product of productsWithOptions) {
    const options = getCustomerFacingOptions(product);
    assert.ok(options.length > 0);
    for (const opt of options) {
      assert.ok(opt.name);
      assert.ok(opt.values.length > 0);
    }
  }
});

test('productStock returns correct availability', () => {
  const allProducts = filterProducts({ age: [], gender: [], skill: [], occasion: [], shopping: [] });
  for (const product of allProducts) {
    const stock = productStock(product);
    assert.ok(typeof stock === 'number');
    assert.ok(stock >= 0 || stock === Number.POSITIVE_INFINITY);
  }
});