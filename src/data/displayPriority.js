// Read-only view of GET /api/storefront/content displayPriority.
// orderedIds is already resolved by the platform. This module does not
// recompute selection, inheritance, or verified sales, and it never writes back.

const EXPLICIT_SHOP_SORTS = new Set(['newest', 'price-asc', 'price-desc', 'name']);

let snapshot = {
  displayPriority: null,
  slugToId: new Map(),
};

export function setDisplayPriority(displayPriority, brands) {
  const slugToId = new Map();
  for (const brand of brands || []) {
    if (brand?.slug && brand?.id != null && brand.id !== '') {
      slugToId.set(String(brand.slug), String(brand.id));
    }
  }
  snapshot = {
    displayPriority: displayPriority && typeof displayPriority === 'object' ? displayPriority : null,
    slugToId,
  };
}

export function isExplicitShopSort(sort) {
  return EXPLICIT_SHOP_SORTS.has(sort);
}

function orderedIdsOf(scope) {
  if (!scope || !Array.isArray(scope.orderedIds)) return null;
  return scope.orderedIds;
}

export function orderedIdsForShop(brandSlug = '') {
  const displayPriority = snapshot.displayPriority;
  if (!displayPriority) return null;
  if (!brandSlug) return orderedIdsOf(displayPriority.shop);
  const brandId = snapshot.slugToId.get(String(brandSlug));
  if (!brandId) return null;
  return orderedIdsOf(displayPriority.brands?.[brandId]?.shop);
}

export function orderedIdsForHome(brandSlug = '') {
  const displayPriority = snapshot.displayPriority;
  if (!displayPriority || !brandSlug) return null;
  const brandId = snapshot.slugToId.get(String(brandSlug));
  if (!brandId) return null;
  return orderedIdsOf(displayPriority.brands?.[brandId]?.home);
}

export function orderProductsByIds(products, orderedIds) {
  const source = Array.isArray(products) ? products : [];
  if (!Array.isArray(orderedIds)) return source.slice();
  const byId = new Map();
  for (const product of source) {
    if (product?.id == null || product.id === '') continue;
    const key = String(product.id);
    if (!byId.has(key)) byId.set(key, product);
  }
  const seen = new Set();
  const ordered = [];
  for (const id of orderedIds) {
    const key = String(id);
    if (seen.has(key)) continue;
    seen.add(key);
    const product = byId.get(key);
    if (product) ordered.push(product);
  }
  return ordered;
}
