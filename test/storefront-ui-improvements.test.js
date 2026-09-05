import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  collectProductImages,
  getCustomerFacingOptions,
  getCustomerFacingSelectionLabels,
  getCustomerFacingVariantLabels,
  isTechnicalOptionLabel,
  resolveProductImages,
} from '../src/data/products.js';
import {
  coerceSelectionsToValidVariant,
  optionValueUnavailable,
  selectedVariant,
  variantsMatchingSelections,
} from '../src/data/inventory.js';
import {
  buildInitialSelections,
  getRelatedPageSize,
  getRelatedPageSlice,
  getRelatedProducts,
  getSameSubcategoryProducts,
} from '../src/hooks/productSiblings.js';
import { velvetProducts } from '../src/data/velvetCatalog.js';

const pageSource = fs.readFileSync(new URL('../src/pages/ProductDetailsPage.jsx', import.meta.url), 'utf8');
const slideSource = fs.readFileSync(new URL('../src/components/ProductDetailSlide.jsx', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const headerSource = fs.readFileSync(new URL('../src/components/Header.jsx', import.meta.url), 'utf8');
const brandPage = fs.readFileSync(new URL('../src/pages/BrandPage.jsx', import.meta.url), 'utf8');

const sampleProduct = velvetProducts.find((item) => item.velvetPath?.subcategoryId);

test('main gallery uses current product images only', () => {
  assert.match(pageSource, /resolveProductImages\(routeProduct, selections\)/);
  assert.match(pageSource, /beginImageTransition/);
  assert.match(pageSource, /product-switcher-viewport/);
  assert.doesNotMatch(pageSource, /beginSiblingTransition/);
  assert.doesNotMatch(pageSource, /getSiblingProduct/);
});

test('related products live in section 4 and exclude the current product', () => {
  assert.match(pageSource, /data-product-section="related"/);
  assert.match(pageSource, /getRelatedProducts/);
  assert.match(pageSource, /ProductCard/);
  assert.ok(sampleProduct);
  const related = getRelatedProducts(sampleProduct, velvetProducts);
  assert.ok(related.every((item) => item.slug !== sampleProduct.slug));
  const siblings = getSameSubcategoryProducts(sampleProduct, velvetProducts);
  assert.equal(related.length, Math.max(0, siblings.length - 1));
});

test('related products share the same subcategory path', () => {
  assert.ok(sampleProduct);
  const related = getRelatedProducts(sampleProduct, velvetProducts);
  related.forEach((item) => {
    assert.equal(item.velvetPath?.brandId, sampleProduct.velvetPath.brandId);
    assert.equal(item.velvetPath?.categoryId, sampleProduct.velvetPath.categoryId);
    assert.equal(item.velvetPath?.subcategoryId, sampleProduct.velvetPath.subcategoryId);
  });
});

test('compact secondary gallery styles reduce vertical height', () => {
  assert.match(pageSource, /product-image-gallery--compact/);
  assert.match(css, /\.product-image-gallery--compact/);
  assert.match(css, /max-height:\s*168px/);
  assert.match(css, /\.product-detail-page\s+\.same-subcategory-products\.product-image-gallery[\s\S]*#fdfdfd/);
  assert.match(css, /\.product-image-gallery--compact\s+\.same-subcategory-products__slide\.is-active[\s\S]*border-color:\s*rgba\(21,\s*18,\s*37/);
  assert.doesNotMatch(css, /\.product-image-gallery--compact\s+\.same-subcategory-products__slide\.is-active[\s\S]*outline:\s*2px\s+solid\s+var\(--red\)/);
});

test('resolveProductImages prefers variant and option images then falls back', () => {
  const product = {
    image: 'https://cdn.test/base.jpg',
    gallery: ['https://cdn.test/g1.jpg'],
    hoverImage: 'https://cdn.test/hover.jpg',
    options: [
      {
        name: 'Color',
        values: [
          { label: 'Blue', image: 'https://cdn.test/blue-opt.jpg' },
          { label: 'Red', image: 'https://cdn.test/red-opt.jpg' },
        ],
      },
      {
        name: 'Size',
        values: [{ label: 'S' }, { label: 'M' }],
      },
    ],
    variants: [
      {
        id: 'v1',
        colorName: 'Blue',
        size: 'S',
        stock: 3,
        image: 'https://cdn.test/blue-s.jpg',
      },
      {
        id: 'v2',
        colorName: 'Red',
        size: 'M',
        stock: 2,
        image: 'https://cdn.test/red-m.jpg',
      },
    ],
  };

  const blue = resolveProductImages(product, { Color: 'Blue', Size: 'S' });
  assert.equal(blue[0], 'https://cdn.test/blue-s.jpg');
  assert.ok(blue.includes('https://cdn.test/blue-opt.jpg'));
  assert.ok(blue.includes('https://cdn.test/base.jpg'));

  const fallback = resolveProductImages({ image: 'https://cdn.test/only.jpg', options: [], variants: [] }, {});
  assert.deepEqual(fallback, ['https://cdn.test/only.jpg']);
  assert.deepEqual(collectProductImages(product).slice(0, 1), ['https://cdn.test/base.jpg']);
});

test('valid variant combinations disable impossible size/color pairs', () => {
  const product = {
    inventoryManaged: true,
    options: [
      { name: 'Color', values: [{ label: 'Blue' }, { label: 'Red' }] },
      { name: 'Size', values: [{ label: 'S' }, { label: 'M' }, { label: 'L' }] },
    ],
    variants: [
      { id: '1', colorName: 'Blue', size: 'S', stock: 2 },
      { id: '2', colorName: 'Blue', size: 'M', stock: 1 },
      { id: '3', colorName: 'Red', size: 'L', stock: 4 },
    ],
  };
  const selections = { Color: 'Blue', Size: 'S' };
  assert.equal(optionValueUnavailable(product, selections, 'Size', 'L'), false);
  assert.equal(optionValueUnavailable(product, selections, 'Size', 'M'), false);
  assert.equal(optionValueUnavailable(product, selections, 'Color', 'Red'), false);
  assert.equal(variantsMatchingSelections(product, { Color: 'Red', Size: 'L' }).length, 1);
  assert.equal(selectedVariant(product, { Color: 'Blue', Size: 'S' })?.id, '1');
  const coerced = coerceSelectionsToValidVariant(product, { Color: 'Red', Size: 'S' });
  assert.equal(selectedVariant(product, coerced)?.id, '3');
  assert.equal(coerced.Size, 'L');
});

test('selected variant drives add-to-cart image and id wiring on the page', () => {
  assert.match(pageSource, /selectedVariant\(routeProduct, selections\)/);
  assert.match(pageSource, /addItem\(routeProduct, selections/);
  assert.match(pageSource, /activeImage/);
  assert.match(slideSource, /showMedia/);
  assert.match(pageSource, /showMedia:\s*true/);
});

test('header restores velvet white plate for the main site logo only', () => {
  assert.match(headerSource, /logo--velvet-badge/);
  assert.match(headerSource, /logo__badge/);
  assert.match(headerSource, /!contextBrand \? ' logo--velvet-badge'/);
  assert.match(css, /\.logo--velvet-badge \.logo__badge/);
  assert.match(css, /\.logo--velvet-badge/);
  assert.match(css, /\.logo--velvet-badge \.logo__badge[\s\S]{0,360}?background:\s*#fff/);
  assert.match(css, /\.logo--velvet-badge \.logo__badge[\s\S]{0,360}?clip-path:\s*polygon\(0%\s*18%,\s*100%\s*0%,\s*94%\s*100%,\s*0%\s*82%\)/);
  assert.match(css, /\.logo--velvet-badge[\s\S]{0,280}?display:\s*grid/);
  assert.match(css, /\.logo--velvet-badge[\s\S]{0,280}?height:\s*46px/);
  assert.match(css, /\.logo--velvet-badge \.logo__badge[\s\S]{0,220}?width:\s*156px/);
  assert.doesNotMatch(css, /\.logo--velvet-badge \.logo__badge[\s\S]{0,220}?background:\s*var\(--red\)/);
  assert.doesNotMatch(css, /html\[dir="rtl"\]\s+\.logo__badge/);
});

test('brand page uses dedicated header image helper with fallback', () => {
  assert.match(brandPage, /getBrandPageHeaderMedia/);
  assert.doesNotMatch(brandPage, /getBrandMedia\(slug\)/);
  const catalog = fs.readFileSync(new URL('../src/data/velvetCatalog.js', import.meta.url), 'utf8');
  assert.match(catalog, /export function getBrandPageHeaderMedia/);
  assert.match(catalog, /headerImage/);
});

test('commerce section keeps real option selectors', () => {
  assert.match(slideSource, /getCustomerFacingOptions/);
  assert.match(slideSource, /optionValueUnavailable/);
  assert.match(pageSource, /data-product-section="commerce"/);
});

test('product details page uses soft #fdfdfd background only', () => {
  assert.match(css, /\.product-detail-page\s*\{[^}]*background:\s*#fdfdfd/);
  assert.match(css, /\.product-related\s*\{[^}]*background:\s*#fdfdfd/);
});

test('product details focal image stays contained and controlled', () => {
  assert.match(css, /\.product-detail-page\s+\.product-detail-focal/);
  assert.match(css, /object-fit:\s*contain/);
  assert.doesNotMatch(css, /\.product-main-gallery__frame/);
});

test('related products render only the current page slice', () => {
  assert.match(pageSource, /getRelatedPageSlice\(relatedProducts, relatedPage, relatedPageSize\)/);
  assert.doesNotMatch(pageSource, /relatedProducts\.map\(/);
  assert.match(pageSource, /getRelatedPageSize/);
  assert.equal(getRelatedPageSize(1440), 4);
  assert.equal(getRelatedPageSize(900), 3);
  assert.equal(getRelatedPageSize(390), 2);
  const related = getRelatedProducts(sampleProduct, velvetProducts);
  if (related.length > 4) {
    const page = getRelatedPageSlice(related, 0, 4);
    assert.equal(page.length, 4);
    assert.ok(page.every((item) => item.slug !== sampleProduct.slug));
  }
});

test('main site logo plate remains scoped away from brand logos', () => {
  assert.match(headerSource, /logo--velvet-badge/);
  assert.match(headerSource, /!contextBrand \? ' logo--velvet-badge'/);
  assert.match(css, /\.logo--velvet-badge/);
  assert.match(css, /\.logo--velvet-badge[\s\S]{0,420}?place-items:\s*center/);
  assert.match(css, /\.logo--velvet-badge \.logo__badge[\s\S]{0,280}?grid-area:\s*1\s*\/\s*1/);
  assert.match(css, /\.logo--velvet-badge[\s\S]{0,500}?logo__img--managed-site[\s\S]{0,220}?transform:\s*translate\(1px,\s*-1px\)/);
  assert.doesNotMatch(css, /\.logo--velvet-badge \.logo__img--managed-site[\s\S]{0,180}?left:\s*50%/);
});

test('technical Default labels are hidden while real sizes stay dynamic', () => {
  const product = {
    options: [
      { name: 'Default', nameAr: 'افتراضي', values: [{ label: 'Default', labelAr: 'افتراضي' }] },
      { name: 'Size', nameAr: 'الحجم', values: [{ label: '500ml', labelAr: '500 مل' }] },
    ],
    variants: [{ id: 'v1', colorName: 'Default', size: '500ml', stock: 2 }],
  };
  assert.equal(isTechnicalOptionLabel('Default'), true);
  assert.equal(isTechnicalOptionLabel('500ml'), false);
  const facing = getCustomerFacingOptions(product);
  assert.equal(facing.length, 1);
  assert.equal(facing[0].name, 'Size');
  assert.deepEqual(
    getCustomerFacingSelectionLabels(product, { Default: 'Default', Size: '500ml' }, 'en'),
    ['500ml'],
  );
  assert.deepEqual(getCustomerFacingVariantLabels(product.variants[0], 'en'), ['500ml']);
  assert.doesNotMatch(slideSource, /product\.options\.map\(/);
  assert.match(slideSource, /facingOptions\.map/);
});

test('buildInitialSelections still seeds first option values', () => {
  const withOptions = velvetProducts.find((item) => item.options?.length);
  if (!withOptions) return;
  const selections = buildInitialSelections(withOptions);
  assert.equal(selections[withOptions.options[0].name], withOptions.options[0].values[0]?.label);
});

test('storefront pages expose sticky VELVET Home context navigation', () => {
  const navSource = fs.readFileSync(new URL('../src/components/PageNavigation.jsx', import.meta.url), 'utf8');
  const translations = fs.readFileSync(new URL('../src/i18n/translations.js', import.meta.url), 'utf8');
  const brandCategory = fs.readFileSync(new URL('../src/pages/BrandCategoryPage.jsx', import.meta.url), 'utf8');
  assert.match(navSource, /page-nav--sticky/);
  assert.match(navSource, /copy\.meta\.velvetHome/);
  assert.match(navSource, /to="\/"/);
  assert.doesNotMatch(navSource, /history\.back/);
  assert.match(translations, /velvetHome:\s*'VELVET Home'/);
  assert.match(css, /\.page-nav--sticky[\s\S]*position:\s*sticky/);
  assert.match(css, /\.page-nav--sticky[\s\S]*top:\s*var\(--header-height\)/);
  assert.match(css, /\.product-detail-page\s*\{[^}]*overflow:\s*visible/);
  assert.doesNotMatch(css, /\.product-detail-page\s*\{[^}]*overflow-x:\s*hidden/);
  assert.match(css, /\.product-switcher-viewport\s*\{[^}]*overflow:\s*hidden/);
  assert.match(brandPage, /PageNavigation/);
  assert.match(brandCategory, /PageNavigation/);
  assert.match(pageSource, /PageNavigation/);
});
