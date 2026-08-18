const normalized = (value) => String(value || '').trim().toLowerCase();

export function productStock(product) {
  if (!product?.inventoryManaged) return Number.POSITIVE_INFINITY;
  if (Array.isArray(product.variants) && product.variants.length) {
    return product.variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock || 0)), 0);
  }
  return Math.max(0, Number(product.stock || 0));
}

export function selectedVariant(product, selections = {}) {
  if (!product?.inventoryManaged || !Array.isArray(product.variants) || !product.variants.length) return null;
  if (product.variants.length === 1) return product.variants[0];
  const selectedValues = Object.values(selections).map(normalized).filter(Boolean);
  return product.variants.find((variant) => {
    const descriptors = [variant.colorName, variant.colorNameAr, variant.size, variant.sizeAr].map(normalized).filter(Boolean);
    return descriptors.length > 0 && descriptors.every((descriptor) => selectedValues.includes(descriptor));
  }) || null;
}

export function availableStock(product, selections = {}) {
  const variant = selectedVariant(product, selections);
  if (variant) return Math.max(0, Number(variant.stock || 0));
  return productStock(product);
}

export function optionValueUnavailable(product, selections, optionName, optionValue) {
  if (!product?.inventoryManaged || !Array.isArray(product.variants) || product.variants.length <= 1) return false;
  const variant = selectedVariant(product, { ...selections, [optionName]: optionValue });
  return Boolean(variant) && Number(variant.stock || 0) <= 0;
}
