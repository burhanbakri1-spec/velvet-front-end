export const PRODUCT_SWITCH_DURATION_MS = 500;

export function getSameSubcategoryProducts(product, velvetProducts) {
  if (!product) return [];
  if (!product?.velvetPath?.subcategoryId) {
    if (!product?.velvetPath) return [product];
    return velvetProducts.filter(
      (item) => item.velvetPath?.brandId === product.velvetPath.brandId
        && item.velvetPath?.categoryId === product.velvetPath.categoryId
        && !item.velvetPath?.subcategoryId,
    );
  }
  return velvetProducts.filter(
    (item) => item.velvetPath?.brandId === product.velvetPath.brandId
      && item.velvetPath?.categoryId === product.velvetPath.categoryId
      && item.velvetPath?.subcategoryId === product.velvetPath.subcategoryId,
  );
}

export function getSiblingProduct(product, siblings, direction) {
  if (!product || !siblings?.length) return null;
  const index = siblings.findIndex((item) => item.slug === product.slug);
  if (index < 0) return null;
  const step = direction === 'next' ? 1 : -1;
  const nextIndex = (index + step + siblings.length) % siblings.length;
  return siblings[nextIndex];
}

export function getProductSlidePercent(direction, role, rtl = false) {
  const forward = direction === 'next' ? 1 : -1;
  const sign = rtl ? -forward : forward;
  if (role === 'outgoing') {
    return { start: 0, end: -sign * 100 };
  }
  return { start: sign * 100, end: 0 };
}

export function buildInitialSelections(product) {
  return Object.fromEntries((product?.options || []).map((option) => [option.name, option.values[0]?.label || '']));
}

export function getRelatedProducts(product, velvetProducts) {
  return getSameSubcategoryProducts(product, velvetProducts)
    .filter((item) => item && item.slug && item.slug !== product?.slug);
}

/** Related carousel page size: desktop 4 / tablet 3 / mobile 2. */
export function getRelatedPageSize(viewportWidth = 1280) {
  const width = Number(viewportWidth);
  if (!Number.isFinite(width) || width >= 1100) return 4;
  if (width >= 720) return 3;
  return 2;
}

export function getRelatedPageCount(totalItems, pageSize) {
  const size = Math.max(1, Number(pageSize) || 1);
  const total = Math.max(0, Number(totalItems) || 0);
  return Math.max(1, Math.ceil(total / size));
}

/** Looping page index clamped into a valid page for the current page size. */
export function normalizeRelatedPageIndex(pageIndex, totalItems, pageSize) {
  const pageCount = getRelatedPageCount(totalItems, pageSize);
  const raw = Number(pageIndex) || 0;
  return ((raw % pageCount) + pageCount) % pageCount;
}

/** Returns only the products for the active related page (no hidden extras). */
export function getRelatedPageSlice(products, pageIndex, pageSize) {
  const list = Array.isArray(products) ? products : [];
  if (!list.length) return [];
  const size = Math.max(1, Number(pageSize) || 1);
  const page = normalizeRelatedPageIndex(pageIndex, list.length, size);
  const start = page * size;
  return list.slice(start, start + size);
}
