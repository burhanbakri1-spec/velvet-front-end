// Isolated product selection for the Home brand product strips.
// CPanel/API will later drive this through brand.productShowcaseMode
// (featured | bestseller | manual). Nothing else in the app reads these rules.

export const BRAND_STRIP_DEFAULT_LIMIT = 8;

const brandPathOf = (product) => product?.velvetPath?.brandId || product?.brandId || '';

export function isStripVisibleProduct(product) {
  if (!product) return false;
  if (product.active === false || product.visible === false) return false;
  const status = String(product.status || '').toLowerCase();
  if (status === 'archived' || status === 'hidden' || status === 'draft') return false;
  return true;
}

export function isFeaturedProduct(product) {
  return product?.featured === true;
}

export function isBestsellerProduct(product) {
  const tags = product?.shopping || [];
  if (tags.includes('bestsellers') || tags.includes('bestseller')) return true;
  const badge = `${product?.badge || ''} ${product?.badgeAr || ''}`;
  return /best\s*seller|الأكثر مبيع/i.test(badge);
}

export function productSalesCount(product) {
  const value = Number(product?.salesCount ?? product?.sales ?? product?.ordersCount ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

const TIER = { featured: 0, bestseller: 1, sales: 2, rest: 3 };

function tierOf(product) {
  if (isFeaturedProduct(product)) return TIER.featured;
  if (isBestsellerProduct(product)) return TIER.bestseller;
  if (productSalesCount(product) > 0) return TIER.sales;
  return TIER.rest;
}

export function selectBrandStripProducts(products, brandSlug, options = {}) {
  const { limit = BRAND_STRIP_DEFAULT_LIMIT, mode = 'auto' } = options;
  if (!brandSlug) return [];

  const brandPool = (Array.isArray(products) ? products : []).filter(
    (product) => isStripVisibleProduct(product) && brandPathOf(product) === brandSlug
  );
  if (!brandPool.length) return [];

  const requestedTier =
    mode === 'featured' ? TIER.featured : mode === 'bestseller' ? TIER.bestseller : null;

  const candidates = brandPool
    .map((product, index) => ({ product, index, tier: tierOf(product) }))
    .filter((entry) => (requestedTier === null ? true : entry.tier <= requestedTier));

  const ordered = (candidates.length ? candidates : brandPool.map((product, index) => ({ product, index, tier: tierOf(product) })))
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        productSalesCount(b.product) - productSalesCount(a.product) ||
        a.index - b.index
    )
    .map((entry) => entry.product);

  return ordered.slice(0, Math.max(1, limit));
}
