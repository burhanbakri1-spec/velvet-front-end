const normalized = (value) => String(value || '').trim().toLowerCase();

export function productStock(product) {
  if (!product?.inventoryManaged) return Number.POSITIVE_INFINITY;
  if (Array.isArray(product.variants) && product.variants.length) {
    return product.variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock || 0)), 0);
  }
  return Math.max(0, Number(product.stock || 0));
}

function variantDimensions(variant) {
  return [[variant.colorName, variant.colorNameAr], [variant.size, variant.sizeAr]]
    .map((labels) => labels.map(normalized).filter(Boolean))
    .filter((labels) => labels.length);
}

function variantDescriptors(variant) {
  return variantDimensions(variant).flat();
}

function knownVariantValues(product) {
  const values = new Set();
  (product?.variants || []).forEach((variant) => {
    variantDescriptors(variant).forEach((value) => values.add(value));
  });
  return values;
}

export function selectedVariant(product, selections = {}, variantId) {
  if (!product?.inventoryManaged || !Array.isArray(product.variants) || !product.variants.length) return null;
  if (variantId) return product.variants.find((variant) => variant.id === variantId) || null;
  if (product.variants.length === 1) return product.variants[0];
  const known = knownVariantValues(product);
  const selectedValues = Object.entries(selections).flatMap(([name, value]) => {
    const option = product.options?.find((candidate) => candidate.name === name);
    const isNonVariantOption = option?.values.length && !option.values.some((entry) =>
      known.has(normalized(entry.label)) || known.has(normalized(entry.labelAr)));
    const label = normalized(value);
    return label && !isNonVariantOption ? [label] : [];
  });
  if (!selectedValues.length) return null;
  const matches = product.variants.filter((variant) => {
    const dimensions = variantDimensions(variant);
    return dimensions.length === selectedValues.length
      && selectedValues.every((value) => dimensions.some((labels) => labels.includes(value)))
      && dimensions.every((labels) => selectedValues.some((value) => labels.includes(value)));
  });
  return matches.length === 1 ? matches[0] : null;
}

export function availableStock(product, selections = {}) {
  const variant = selectedVariant(product, selections);
  if (variant) return Math.max(0, Number(variant.stock || 0));
  return productStock(product);
}

export function variantsMatchingSelections(product, selections = {}) {
  if (!Array.isArray(product?.variants) || !product.variants.length) return [];
  const known = knownVariantValues(product);
  const selectedValues = Object.values(selections).map(normalized).filter((value) => known.has(value));
  if (!selectedValues.length) return product.variants;
  return product.variants.filter((variant) => {
    const descriptors = variantDescriptors(variant);
    return selectedValues.every((value) => descriptors.includes(value));
  });
}

export function optionValueUnavailable(product, selections, optionName, optionValue) {
  if (!product?.inventoryManaged || !Array.isArray(product.variants) || product.variants.length <= 1) return false;
  const known = knownVariantValues(product);
  const probe = normalized(optionValue);
  if (!known.has(probe)) return false;
  // A value is purchasable if any variant carries it with stock. Combination
  // conflicts are resolved by coerceSelectionsToValidVariant on selection.
  const matches = product.variants.filter((variant) => variantDescriptors(variant).includes(probe));
  if (!matches.length) return true;
  return matches.every((variant) => Number(variant.stock || 0) <= 0);
}

export function coerceSelectionsToValidVariant(product, selections = {}) {
  if (!product?.inventoryManaged || !Array.isArray(product.variants) || !product.variants.length) {
    return selections;
  }
  if (selectedVariant(product, selections)) return selections;

  const known = knownVariantValues(product);
  const selected = Object.values(selections).map(normalized).filter((value) => known.has(value));
  const ranked = product.variants
    .map((variant) => ({
      variant,
      score: variantDescriptors(variant).filter((descriptor) => selected.includes(descriptor)).length,
      stock: Number(variant.stock || 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return right.stock - left.stock;
    });

  const best = ranked.find((entry) => entry.stock > 0)?.variant || ranked[0]?.variant;
  if (!best) return selections;

  const next = { ...selections };
  (product.options || []).forEach((option) => {
    const match = (option.values || []).find((value) => {
      const label = normalized(value.label);
      return variantDescriptors(best).includes(label);
    });
    if (match) next[option.name] = match.label;
  });
  return next;
}

export function resolveSelectionPrice(product, selections = {}, variant = selectedVariant(product, selections)) {
  const variantPrice = Number(variant?.price);
  const regular = Number(variant?.originalPrice);
  const isExplicitZeroSale = (variant?.price === 0 || variant?.price === '0') && Number.isFinite(regular) && regular > 0;
  if ((Number.isFinite(variantPrice) && variantPrice > 0) || isExplicitZeroSale) {
    return {
      price: variantPrice,
      originalPrice: Number.isFinite(regular) && regular > variantPrice ? regular : null,
    };
  }

  const delta = (product.options || []).reduce((sum, option) => {
    const value = option.values.find((value) => value.label === selections[option.name]);
    return sum + Number(value?.priceDelta || 0);
  }, 0);
  return {
    price: product.price + delta,
    originalPrice: product.originalPrice ? product.originalPrice + delta : null,
  };
}
