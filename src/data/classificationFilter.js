// Live product classification dimensions from storefront content.filterDefinitions
// and product.filterAttributes. Size/color are variant attributes and stay out.

export const LIVE_CLASSIFICATION_KEYS = [
  'age',
  'gender',
  'skill',
  'occasion',
  'material',
  'productType',
  'theme',
  'collection',
];

export const PRODUCT_IDS_FIELD = {
  age: 'ageIds',
  gender: 'genderIds',
  skill: 'skillIds',
  occasion: 'occasionIds',
  material: 'materialIds',
  productType: 'productTypeIds',
  theme: 'themeIds',
  collection: 'collectionIds',
};

const LEGACY_SINGLE_FIELD = {
  age: 'age',
  gender: 'gender',
  skill: 'skill',
  occasion: 'occasion',
};

export function normalizeFilterDefinitions(raw = []) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const mapped = [];
  raw.forEach((entry) => {
    const id = String(entry?.id || '').trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    const label = entry?.label && typeof entry.label === 'object' ? entry.label : {};
    mapped.push({
      id,
      name: {
        en: String(label.en || id),
        ar: String(label.ar || label.en || id),
      },
    });
  });
  return mapped;
}

export function normalizeAttributeIdsFromRaw(raw, key) {
  const fromAttributes = Array.isArray(raw?.filterAttributes?.[key])
    ? raw.filterAttributes[key]
      .map((entry) => String(typeof entry === 'string' ? entry : entry?.id || '').trim())
      .filter(Boolean)
    : [];
  if (fromAttributes.length) return [...new Set(fromAttributes)];
  const legacyKey = LEGACY_SINGLE_FIELD[key];
  if (!legacyKey) return [];
  const legacy = String(raw?.[legacyKey] || '').trim();
  return legacy ? [legacy] : [];
}

export function getProductAttributeIds(product, key) {
  if (!product) return [];
  const field = PRODUCT_IDS_FIELD[key];
  if (field && Array.isArray(product[field]) && product[field].length) {
    return product[field].map((id) => String(id || '').trim()).filter(Boolean);
  }
  const legacyKey = LEGACY_SINGLE_FIELD[key];
  if (!legacyKey) return [];
  const legacy = String(product[legacyKey] || '').trim();
  return legacy ? [legacy] : [];
}

export function productMatchesAttributeFilter(product, key, selectedIds = []) {
  if (!selectedIds.length) return true;
  const productIds = getProductAttributeIds(product, key);
  return selectedIds.some((id) => productIds.includes(id));
}

export function buildProductClassificationFields(raw) {
  const fields = {};
  LIVE_CLASSIFICATION_KEYS.forEach((key) => {
    const ids = normalizeAttributeIdsFromRaw(raw, key);
    fields[PRODUCT_IDS_FIELD[key]] = ids;
    const legacyKey = LEGACY_SINGLE_FIELD[key];
    if (legacyKey) {
      fields[legacyKey] = ids[0] || String(raw?.[legacyKey] || '');
    }
  });
  return fields;
}

// Age-specific aliases kept for existing imports/tests.
export function normalizeAgeFilterDefinitions(rawAge = []) {
  return normalizeFilterDefinitions(rawAge);
}

export function normalizeAgeIdsFromRaw(raw) {
  return normalizeAttributeIdsFromRaw(raw, 'age');
}

export function getProductAgeIds(product) {
  return getProductAttributeIds(product, 'age');
}

export function productMatchesAgeFilter(product, selectedAgeIds = []) {
  return productMatchesAttributeFilter(product, 'age', selectedAgeIds);
}
