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
