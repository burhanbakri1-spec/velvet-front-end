export function normalizeAgeFilterDefinitions(rawAge = []) {
  if (!Array.isArray(rawAge)) return [];
  const seen = new Set();
  const mapped = [];
  rawAge.forEach((entry) => {
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

export function normalizeAgeIdsFromRaw(raw) {
  const fromAttributes = Array.isArray(raw?.filterAttributes?.age)
    ? raw.filterAttributes.age
      .map((entry) => String(typeof entry === 'string' ? entry : entry?.id || '').trim())
      .filter(Boolean)
    : [];
  if (fromAttributes.length) return [...new Set(fromAttributes)];
  const legacy = String(raw?.age || '').trim();
  return legacy ? [legacy] : [];
}

export function getProductAgeIds(product) {
  if (!product) return [];
  if (Array.isArray(product.ageIds) && product.ageIds.length) {
    return product.ageIds.map((id) => String(id || '').trim()).filter(Boolean);
  }
  const legacy = String(product.age || '').trim();
  return legacy ? [legacy] : [];
}

export function productMatchesAgeFilter(product, selectedAgeIds = []) {
  if (!selectedAgeIds.length) return true;
  const productAges = getProductAgeIds(product);
  return selectedAgeIds.some((id) => productAges.includes(id));
}
