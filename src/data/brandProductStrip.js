// Isolated product selection for the Home brand product strips.
// CPanel/API will later drive this through brand.productShowcaseMode
// (featured | bestseller | manual). Nothing else in the app reads these rules.

export const BRAND_STRIP_DEFAULT_LIMIT = 8;

// The marquee repeats the selected base set in every track group, so the base
// set must hold enough UNIQUE products or one product repeats on screen.
export const BRAND_STRIP_MIN_UNIQUE = 5;

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

function productKey(product) {
  const key = product?.id ?? product?.slug;
  return key == null ? product : String(key);
}

function orderPool(pool, requestedTier) {
  const entries = pool.map((product, index) => ({ product, index, tier: tierOf(product) }));
  const scoped = requestedTier === null ? entries : entries.filter((entry) => entry.tier <= requestedTier);
  const ordered = (scoped.length ? scoped : entries)
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        productSalesCount(b.product) - productSalesCount(a.product) ||
        a.index - b.index
    )
    .map((entry) => entry.product);
  return ordered;
}

export function selectBrandStripProducts(products, brandSlug, options = {}) {
  const { limit = BRAND_STRIP_DEFAULT_LIMIT, mode = 'auto' } = options;
  if (!brandSlug) return [];

  const pool = (Array.isArray(products) ? products : []).filter(isStripVisibleProduct);
  const brandPool = pool.filter((product) => brandPathOf(product) === brandSlug);
  if (!brandPool.length) return [];

  const requestedTier =
    mode === 'featured' ? TIER.featured : mode === 'bestseller' ? TIER.bestseller : null;
  const cap = Math.max(1, limit);
  const target = Math.min(cap, BRAND_STRIP_MIN_UNIQUE);

  const seen = new Set();
  const takeUnique = (list) =>
    list.filter((product) => {
      const key = productKey(product);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  // Priority: featured same brand -> rest of the same brand by existing tiers.
  const selected = takeUnique(orderPool(brandPool, requestedTier)).slice(0, cap);

  // Broader catalog fallback only after the same brand is genuinely exhausted.
  if (selected.length < target) {
    const fallbackPool = pool.filter((product) => brandPathOf(product) !== brandSlug);
    for (const product of takeUnique(orderPool(fallbackPool, requestedTier))) {
      if (selected.length >= target) break;
      selected.push(product);
    }
  }

  return selected;
}
