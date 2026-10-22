import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { getCustomerFacingProductBadge, getProductBadgeFields } from '../src/data/productBadge.js';
import { mapPlatformProduct } from '../src/data/platformContent.js';

// Public API field subset observed 2026-10-22. No live mutation or invented product names.
const balloon = {
  id: 'velvet-src-284', slug: 'velvet-284',
  name: { en: 'Balloon-Powered Cars', ar: 'سيارات البالون الهوائية' },
  badge: { en: 'Featured', ar: 'وصل حديثا ' },
  featured: false, newArrival: true, bestseller: false, quickShop: false,
};

const entry = fileURLToPath(new URL('../__badge_render_test__.jsx', import.meta.url));
const contents = `
    import React from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import ProductCard from './src/components/ProductCard.jsx';
    import ProductDetailSlide from './src/components/ProductDetailSlide.jsx';
    import BrandProductStrip from './src/components/BrandProductStrip.jsx';
    import { RouterProvider } from './src/routing/Router.jsx';
    import { I18nProvider } from './src/i18n/I18nContext.jsx';
    import { AuthProvider } from './src/context/AuthContext.jsx';
    import { applyPlatformContent } from './src/data/platformContent.js';
    import { getProductBySlug } from './src/data/velvetCatalog.js';
    export function prepare(payload, slug) { applyPlatformContent(payload, 'https://test.local'); return getProductBySlug(slug); }
    import { translations } from './src/i18n/translations.js';
    export function render(surface, product, locale) {
      const node = surface === 'pdp'
        ? <ProductDetailSlide product={product} locale={locale} copy={translations[locale]} imageSrc={product.image || "/toy.svg"} selections={{}} quantity={1} />
        : surface === 'home' ? <BrandProductStrip brandSlug="baby" deckIndex={0} /> : <ProductCard product={product} />;
      return renderToStaticMarkup(<RouterProvider><I18nProvider><AuthProvider>{node}</AuthProvider></I18nProvider></RouterProvider>);
    }
  `;
const bundled = await build({
  configFile: false, logLevel: 'silent',
  build: { ssr: entry, write: false, rollupOptions: { output: { format: 'cjs' }, external: (id) => id === 'react' || id.startsWith('react/') || id.startsWith('react-dom/') } },
  plugins: [react(), { name: 'badge-render-fixture', resolveId(id) { if (id === entry) return entry; }, load(id) { if (id === entry) return contents; } }],
  define: { 'import.meta.env': '{}' },
});
const module = { exports: {} };
new Function('require', 'module', 'exports', bundled.output[0].code)(createRequire(import.meta.url), module, module.exports);

function render(surface, product, locale) {
  const previous = globalThis.window;
  globalThis.window = { location: { pathname: '/' + locale, search: '', hash: '', origin: 'https://test.local' }, localStorage: { getItem: () => null } };
  try { return module.exports.render(surface, product, locale); }
  finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; }
}
const badgeText = (markup, className) => markup.match(new RegExp(`<span class="${className}[^"]*">([^<]*)<\\/span>`))?.[1] || '';

test('Balloon-Powered Cars in Auto renders the same EN/AR badge in Home, Shop and PDP', () => {
  const product = module.exports.prepare({
    site: {}, brands: [{ id: 'baby', slug: 'baby', name: { en: 'Baby', ar: 'بيبي' } }],
    categories: [{ id: 'main', slug: 'main', brandId: 'baby', name: { en: 'Toys', ar: 'ألعاب' } }],
    products: [{ ...balloon, badgeMode: 'auto', brandId: 'baby', mainCategoryId: 'main', categoryId: 'main', price: 1 }], texts: [], media: [],
  }, balloon.slug);
  assert.ok(product);
  for (const [locale, expected] of [['en', 'New'], ['ar', 'وصل حديثًا']]) {
    assert.equal(badgeText(render('card', product, locale), 'product-card__badge'), expected);
    assert.equal(badgeText(render('pdp', product, locale), 'product-detail-badge'), expected);
    assert.equal(badgeText(render('home', product, locale), 'brand-strip-card__badge'), expected);
  }
});

test('PDP and ProductCard honor every mode, including an Arabic-only custom badge', () => {
  const base = { id: 'p1', slug: 'toy', name: 'Toy', nameAr: 'لعبة', price: 1, options: [], image: '/toy.svg', ...getProductBadgeFields(balloon) };
  for (const fields of [
    { badgeMode: 'none', newArrival: true },
    { badgeMode: 'auto', newArrival: true },
    { badgeMode: 'auto', newArrival: false, bestseller: true },
    { badgeMode: 'auto', newArrival: false, featured: true },
    { badgeMode: 'custom', customBadge: { en: '', ar: 'حصري' } },
    { badgeMode: undefined, customBadge: undefined, badge: 'Legacy', badgeAr: 'قديم' },
  ]) for (const locale of ['en', 'ar']) {
    const product = { ...base, ...fields };
    const expected = getCustomerFacingProductBadge(product, locale);
    assert.equal(badgeText(render('card', product, locale), 'product-card__badge'), expected);
    assert.equal(badgeText(render('pdp', product, locale), 'product-detail-badge'), expected);
  }
});

test('both normalization paths retain additive badge fields and legacy manual values', () => {
  const raw = { ...balloon, badgeMode: 'auto', customBadge: { en: 'Exclusive', ar: 'حصري' }, quickShop: true };
  const mapped = mapPlatformProduct(raw, [], 'https://test.local');
  assert.deepEqual(getProductBadgeFields(mapped), getProductBadgeFields(raw));
  assert.equal(mapped.badge, 'Featured');
  assert.equal(getCustomerFacingProductBadge(mapped), 'New');
});

test('shared cards cover search, related products and checkout; badge-free surfaces remain unchanged', () => {
  for (const filename of ['ProductsPage', 'ProductDetailsPage', 'CheckoutPage']) {
    const source = fs.readFileSync(new URL('../src/pages/' + filename + '.jsx', import.meta.url), 'utf8');
    assert.match(source, /<ProductCard/);
  }
  for (const filename of ['SearchDropdown', 'CategoryProductShowcase', 'BrandShowcase']) {
    const source = fs.readFileSync(new URL('../src/components/' + filename + '.jsx', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /getProductBadge|product[^\n]*badge/i);
  }
});
