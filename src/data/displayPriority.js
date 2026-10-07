// Saved storefront display priority from platform content.
// Missing config keeps the caller's current order.
// An empty orderedIds list is a saved empty set.

let saved = null;

function slugKeys(slug) {
  const raw = String(slug || '').trim();
  if (!raw) return [];
  const bare = raw.replace(/^velvet-/, '');
  return [...new Set([raw, bare, bare ? `velvet-${bare}` : ''].filter(Boolean))];
}

function readEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  if (!Object.prototype.hasOwnProperty.call(entry, 'orderedIds')) return null;
  if (!Array.isArray(entry.orderedIds)) return null;
  return { orderedIds: entry.orderedIds.map((id) => String(id)) };
}

function writeBrand(brands, slug, home, shop) {
  if (!home && !shop) return;
  for (const key of slugKeys(slug)) {
    const current = brands[key] || { home: null, shop: null };
    brands[key] = {
      home: home || current.home,
      shop: shop || current.shop,
    };
  }
}

export function applyDisplayPriority(payload) {
  const brands = {};
  let shop = null;
  let home = null;
  const root = payload?.displayPriority;
  if (root && typeof root === 'object' && !Array.isArray(root)) {
    shop = readEntry(root.shop);
    home = readEntry(root.home);
    const brandMap = root.brands && typeof root.brands === 'object' ? root.brands : {};
    for (const [slug, config] of Object.entries(brandMap)) {
      writeBrand(brands, slug, readEntry(config?.home), readEntry(config?.shop));
    }
  }
  for (const brand of Array.isArray(payload?.brands) ? payload.brands : []) {
    const config = brand?.displayPriority;
    if (!config) continue;
    writeBrand(brands, brand.slug, readEntry(config.home), readEntry(config.shop));
  }
  saved = shop || home || Object.keys(brands).length ? { shop, home, brands } : null;
}

export function getHomePriority(brandSlug) {
  if (!saved) return null;
  for (const key of slugKeys(brandSlug)) {
    const entry = saved.brands[key]?.home;
    if (entry) return entry;
  }
  return saved.home || null;
}

/** Brand shops do not inherit the general shop list. */
export function getShopPriority(brandSlug = '') {
  if (!saved) return null;
  if (brandSlug) {
    for (const key of slugKeys(brandSlug)) {
      const entry = saved.brands[key]?.shop;
      if (entry) return entry;
    }
    return null;
  }
  return saved.shop;
}

export function isExplicitCustomerSort(sort) {
  return Boolean(sort) && sort !== 'featured';
}

export function orderProductsByIds(products, orderedIds) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return [];
  const byKey = new Map();
  for (const product of Array.isArray(products) ? products : []) {
    const id = product?.id == null ? '' : String(product.id);
    const slug = product?.slug == null ? '' : String(product.slug);
    if (id && !byKey.has(id)) byKey.set(id, product);
    if (slug && !byKey.has(slug)) byKey.set(slug, product);
  }
  const seen = new Set();
  const ordered = [];
  for (const raw of orderedIds) {
    const product = byKey.get(String(raw));
    if (!product) continue;
    const key = String(product.id ?? product.slug);
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(product);
  }
  return ordered;
}
