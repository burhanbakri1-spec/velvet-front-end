import { applyPlatformContent } from '../src/data/platformContent.js';
import { getBrand, velvetProducts } from '../src/data/velvetCatalog.js';
import { selectBrandStripProducts } from '../src/data/brandProductStrip.js';
import { getStorefrontCategories } from '../src/data/storefrontVisibility.js';

const apiUrl = 'https://api-staging.igroup.website';
const response = await fetch(`${apiUrl}/api/storefront/content?locale=en`, {
  headers: { 'X-Company-Id': 'kids-velvet', 'X-Site-Id': 'kids-velvet-storefront' },
});
if (!response.ok) throw new Error(`Staging catalog returned ${response.status}`);
const payload = await response.json();
applyPlatformContent(payload, apiUrl);

const brandsById = new Map((payload.brands || []).map((brand) => [String(brand.id), brand]));
const categoryById = new Map((payload.categories || []).map((category) => [String(category.id), category]));
const productsById = new Map((payload.products || []).map((product) => [String(product.id), product]));
const bad = [];
const brandResults = [];
let selectedCount = 0;
let eligibleProductCount = 0;
let excludedUnscopedProductCount = 0;
for (const raw of payload.products || []) {
  if (!raw.brandId || !raw.mainCategoryId) {
    excludedUnscopedProductCount += 1;
    continue;
  }
  const brand = brandsById.get(String(raw.brandId));
  const main = categoryById.get(String(raw.mainCategoryId));
  const sub = raw.subcategoryId ? categoryById.get(String(raw.subcategoryId)) : null;
  eligibleProductCount += 1;
  if (!brand || !main || String(main.brandId) !== String(brand.id)
    || (raw.subcategoryId && (!sub || String(sub.parentId) !== String(main.id) || String(sub.brandId) !== String(brand.id)))) {
    bad.push({ id: raw.id, reason: 'unmapped or cross-brand main category/descendant' });
  }
}

for (const platformBrand of payload.brands || []) {
  const brand = getBrand(platformBrand.slug);
  if (!brand) continue;
  const categories = getStorefrontCategories(brand);
  let matched = 0;
  let selected = 0;
  let mismatches = 0;
  let sourceProducts = 0;
  let omittedByEightItemCap = 0;
  for (const category of categories) {
    const products = selectBrandStripProducts(velvetProducts, brand.slug, { categorySlug: category.slug });
    const categoryId = (payload.categories || []).find((item) => String(item.slug) === String(category.slug) && String(item.brandId) === String(platformBrand.id))?.id;
    const sourceCount = (payload.products || []).filter((item) => String(item.brandId) === String(platformBrand.id) && String(item.mainCategoryId) === String(categoryId)).length;
    sourceProducts += sourceCount;
    if (products.length !== Math.min(8, sourceCount)) mismatches += 1;
    omittedByEightItemCap += Math.max(0, sourceCount - 8);
    selected += products.length;
    for (const product of products) {
      const raw = productsById.get(String(product.id));
      const expectedCategory = (payload.categories || []).find((item) => String(item.slug) === String(category.slug) && String(item.brandId) === String(platformBrand.id));
      const sub = raw?.subcategoryId ? categoryById.get(String(raw.subcategoryId)) : null;
      const valid = raw
        && String(raw.brandId) === String(platformBrand.id)
        && String(raw.mainCategoryId) === String(expectedCategory?.id)
        && (!raw.subcategoryId || (sub && String(sub.parentId) === String(expectedCategory?.id) && String(sub.brandId) === String(platformBrand.id)))
        && String(product.velvetPath?.brandId) === String(brand.slug)
        && String(product.velvetPath?.categoryId) === String(category.slug);
      if (!valid) { mismatches += 1; bad.push({ id: product.id, brand: brand.slug, category: category.slug, reason: 'selector escaped current brand/main category' }); }
      else matched += 1;
    }
  }
  selectedCount += selected;
  brandResults.push({ brand: brand.slug, mainCategories: categories.length, eligibleProducts: sourceProducts, selectedStripProducts: selected, omittedByEightItemCap, matched, mismatches });
}
const viewAll = '/en/products?brand=baby&category=baby-development';
console.log(JSON.stringify({ httpStatus: response.status, catalogProductCount: payload.products?.length || 0, eligibleProductCount, excludedUnscopedProductCount, brandCount: brandResults.length, brandResults, selectedCount, badCount: bad.length, bad: bad.slice(0, 10), viewAllExample: viewAll }, null, 2));
if (bad.length) process.exitCode = 1;
