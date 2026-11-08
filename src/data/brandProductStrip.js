// Isolated product selection for the Home brand product strips.
// A saved home priority replaces the automatic tier order.
// Missing priority keeps featured → bestseller → sales → catalog order.

import { getProductBadgeFields } from './productBadge.js';
import { orderProductsByIds } from './displayPriority.js';

export const BRAND_STRIP_DEFAULT_LIMIT = 8;

const brandPathOf = (product) => product?.velvetPath?.brandId || product?.brandId || '';

export function isStripVisibleProduct(product) {
  if (!product) return false;
  if (product.active === false || product.visible === false || product.published === false || product.available === false) return false;
  const status = String(product.status || '').trim().toLowerCase().replace(/[ _]+/g, '-');
  if (['archived', 'hidden', 'draft', 'unpublished', 'pending', 'identity-pending', 'pending-identity', 'unavailable'].includes(status)) return false;
  return true;
}

export function isFeaturedProduct(product) {
  return getProductBadgeFields(product).featured;
}

export function isBestsellerProduct(product) {
  return getProductBadgeFields(product).bestseller;
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
  const {
    limit = BRAND_STRIP_DEFAULT_LIMIT,
    mode = 'auto',
    priority = null,
    categorySlug = '',
    subcategorySlug = '',
  } = options;
  if (!brandSlug) return [];

  // Subcategory strips require the canonical complete taxonomy path. A
  // brandId/categoryId fallback could leak unclassified or neighboring items.
  if (subcategorySlug && !categorySlug) return [];
  const scopedByTaxonomy = Boolean(categorySlug || subcategorySlug);

  const brandPool = (Array.isArray(products) ? products : []).filter(
    (product) => {
      if (!isStripVisibleProduct(product)) return false;
      if (!scopedByTaxonomy) return brandPathOf(product) === brandSlug;
      const path = product?.velvetPath;
      return path?.brandId === brandSlug
        && (!categorySlug || path.categoryId === categorySlug)
        && (!subcategorySlug || path.subcategoryId === subcategorySlug);
    }
  );
  // An explicit empty orderedIds list owns the strip and stays empty.
  // A list that names other brands does not hide this brand's own products.
  if (priority != null) {
    const orderedIds = Array.isArray(priority.orderedIds) ? priority.orderedIds : [];
    if (orderedIds.length === 0) return [];
    const ordered = orderProductsByIds(brandPool, orderedIds);
    if (ordered.length > 0) return ordered;
  }
  if (!brandPool.length) return [];

  const requestedTier =
    mode === 'featured' ? TIER.featured : mode === 'bestseller' ? TIER.bestseller : null;
  const cap = Math.max(1, limit);

  // Same brand only: featured -> bestseller/sales -> remaining visible,
  // unique by id/slug, never padded or duplicated to reach a target size.
  const seen = new Set();
  return orderPool(brandPool, requestedTier)
    .filter((product) => {
      const key = productKey(product);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, cap);
}
