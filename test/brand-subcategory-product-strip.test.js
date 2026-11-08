import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { buildDynamicCatalog } from '../src/data/dynamicCatalog.js';
import { mapPlatformProduct } from '../src/data/platformContent.js';
import { selectBrandStripProducts } from '../src/data/brandProductStrip.js';

const path = (brandId, categoryId, subcategoryId) => ({ brandId, categoryId, subcategoryId });
const product = (id, velvetPath, extra = {}) => ({
  id,
  slug: id,
  name: id,
  price: 20,
  velvetPath,
  ...extra,
});
const scope = { categorySlug: 'blind-boxes', subcategorySlug: 'mini-figures' };

test('subcategory strip requires exact canonical brand, main-category, and subcategory membership', () => {
  const products = [
    product('match', path('collect', 'blind-boxes', 'mini-figures')),
    product('other-brand', path('baby', 'blind-boxes', 'mini-figures')),
    product('other-category', path('collect', 'action-figures', 'mini-figures')),
    product('other-subcategory', path('collect', 'blind-boxes', 'mystery-boxes')),
    { ...product('identity-pending', null), brandId: 'collect', categoryId: 'blind-boxes', subcategoryId: 'mini-figures' },
  ];

  const selected = selectBrandStripProducts(products, 'collect', scope);
  assert.deepEqual(selected.map((entry) => entry.id), ['match']);
});

test('unpublished, identity-pending, inactive, hidden and unavailable products stay out of strips', () => {
  const products = [
    product('visible', path('collect', 'blind-boxes', 'mini-figures')),
    product('draft', path('collect', 'blind-boxes', 'mini-figures'), { status: 'draft' }),
    product('unpublished', path('collect', 'blind-boxes', 'mini-figures'), { status: 'unpublished' }),
    product('identity-pending', path('collect', 'blind-boxes', 'mini-figures'), { status: 'identity_pending' }),
    product('pending-identity', path('collect', 'blind-boxes', 'mini-figures'), { status: 'Pending Identity' }),
    product('inactive', path('collect', 'blind-boxes', 'mini-figures'), { active: false }),
    product('hidden', path('collect', 'blind-boxes', 'mini-figures'), { visible: false }),
    product('unpublished-flag', path('collect', 'blind-boxes', 'mini-figures'), { published: false }),
    product('unavailable-flag', path('collect', 'blind-boxes', 'mini-figures'), { available: false }),
    product('unavailable-status', path('collect', 'blind-boxes', 'mini-figures'), { status: 'unavailable' }),
  ];

  assert.deepEqual(
    selectBrandStripProducts(products, 'collect', scope).map((entry) => entry.id),
    ['visible'],
  );
});

test('duplicate products are removed and saved brand shop priority orders matching products', () => {
  const products = [
    product('first', path('collect', 'blind-boxes', 'mini-figures')),
    product('second', path('collect', 'blind-boxes', 'mini-figures')),
    product('first', path('collect', 'blind-boxes', 'mini-figures'), { slug: 'duplicate-first' }),
    product('other-scope', path('collect', 'blind-boxes', 'mystery-boxes')),
  ];

  const selected = selectBrandStripProducts(products, 'collect', {
    ...scope,
    priority: { orderedIds: ['second', 'other-scope', 'first'] },
  });
  assert.deepEqual(selected.map((entry) => entry.id), ['second', 'first']);
  assert.equal(new Set(selected.map((entry) => entry.id)).size, selected.length);
});

test('default selection keeps source order for equal-priority products and empty scopes stay empty', () => {
  const products = [
    product('source-first', path('collect', 'blind-boxes', 'mini-figures')),
    product('source-second', path('collect', 'blind-boxes', 'mini-figures')),
    product('other-brand', path('play', 'blind-boxes', 'mini-figures')),
  ];
  assert.deepEqual(
    selectBrandStripProducts(products, 'collect', scope).map((entry) => entry.id),
    ['source-first', 'source-second'],
  );
  assert.deepEqual(selectBrandStripProducts(products, 'collect', { categorySlug: 'blind-boxes', subcategorySlug: 'empty' }), []);
  assert.deepEqual(selectBrandStripProducts(products, 'collect', { subcategorySlug: 'mini-figures' }), []);
});

test('platform and dynamic product adapters preserve existing storefront eligibility fields', () => {
  const flags = { active: false, visible: false, published: false, available: false, status: 'identity-pending' };
  const mapped = mapPlatformProduct({
    id: 'p1', slug: 'toy', name: { en: 'Toy', ar: 'لعبة' }, categoryId: 'main', price: 10, options: [], ...flags,
  }, [], 'https://api.test');
  for (const key of Object.keys(flags)) assert.equal(mapped[key], flags[key]);

  const catalog = buildDynamicCatalog({
    brands: [{ id: 'b1', slug: 'collect', name: { en: 'Collect', ar: 'كولكت' } }],
    categories: [
      { id: 'c1', brandId: 'b1', slug: 'blind-boxes', name: { en: 'Blind Boxes', ar: 'صناديق' } },
      { id: 's1', brandId: 'b1', parentId: 'c1', slug: 'mini-figures', name: { en: 'Mini Figures', ar: 'مجسمات' } },
    ],
    products: [{
      id: 'p2', slug: 'toy-two', brandId: 'b1', categoryId: 'c1', subcategoryId: 's1',
      name: { en: 'Toy Two', ar: 'لعبة' }, price: 10, ...flags,
    }],
  }, 'https://api.test');
  for (const key of Object.keys(flags)) assert.equal(catalog.products[0][key], flags[key]);
});

test('main-category page places the scoped strip immediately after each subcategory banner', () => {
  const page = fs.readFileSync(new URL('../src/pages/BrandCategoryPage.jsx', import.meta.url), 'utf8');
  const start = page.indexOf('{category.subs.map');
  const end = page.indexOf('</section>', start);
  const section = page.slice(start, end);
  const banner = section.indexOf('<BrandShowcase');
  const strip = section.indexOf('<BrandProductStrip');
  assert.ok(banner >= 0 && strip > banner);
  assert.match(section, /brandSlug=\{slug\}/);
  assert.match(section, /categorySlug=\{category\.slug\}/);
  assert.match(section, /subcategorySlug=\{sub\.slug\}/);
  assert.match(section, /subcategoryName=\{sub\.name\[locale\]\}/);
});

test('parent pages with subcategory strips do not append the legacy category spotlight', () => {
  const page = fs.readFileSync(new URL('../src/pages/BrandCategoryPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /\{\(isSubMode \|\| category\.subs\.length === 0\) && \(products\.length > 0 \?/);
});

test('empty subcategories render no product strip', () => {
  const strip = fs.readFileSync(new URL('../src/components/BrandProductStrip.jsx', import.meta.url), 'utf8');
  assert.match(strip, /if \(!brandSlug \|\| products\.length === 0\) return null/);
});

test('subcategory strip links back to its exact filtered shop and reuses horizontal product-card styling', () => {
  const strip = fs.readFileSync(new URL('../src/components/BrandProductStrip.jsx', import.meta.url), 'utf8');
  const styles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(strip, /subcategorySlug/);
  assert.match(strip, /scopedBySubcategory \? 1 : selectStripGroupCount/);
  assert.match(strip, /scopedBySubcategory \? ' is-subcategory' : ''/);
  assert.match(strip, /onScroll=\{scopedBySubcategory \? undefined : normalizeStripScroll\}/);
  assert.match(strip, /product\.slug/);
  assert.match(strip, /className="brand-strip__viewport"/);
  assert.match(styles, /\.brand-strip__viewport\s*\{[\s\S]*?overflow-x:\s*auto/);
  assert.match(styles, /\.brand-strip__track\.is-subcategory\s*\{\s*animation:\s*none;/);
  assert.match(styles, /html\[dir="rtl"\] \.brand-strip__track\.is-subcategory\s*\{\s*animation:\s*none;/);
  assert.match(styles, /html\[dir="rtl"\] \.brand-strip__track/);
});
