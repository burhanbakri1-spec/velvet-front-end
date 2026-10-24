// ===========================================================================
// Temporary storefront visibility override.
// To be replaced by CPanel-controlled Brand/Main Category/Subcategory visibility.
//
// Why this module exists
// ----------------------
// A handful of Main Categories are intentionally empty for now. Their catalog
// data, media, taxonomy rows and direct URLs must all stay exactly as they are;
// only *customer discovery* is suppressed. So this is a presentation filter, not
// a data deletion and not a routing change.
//
// Contract
// --------
// - Keys are brand slugs, values are Main Category slugs.
// - Category slugs are NOT globally unique in the VELVET taxonomy (e.g.
//   `accessories`, `cars`, `animals` are reused across branches), so every match
//   is scoped by BOTH brand slug and category slug.
// - Brand entities themselves are never hidden. Only the listed Main Categories
//   disappear; their parent brand and sibling categories keep rendering.
// - Subcategories need no separate entry: they are only surfaced underneath
//   their Main Category, so hiding the parent removes them from discovery too.
// - Direct URLs keep working because velvetCatalog keeps the full tree; see
//   getStorefrontCategories() being applied at presentation surfaces only.
//
// CPanel migration path
// ---------------------
// When the platform exposes per-entity `showOnStorefront` flags, delete
// TEMPORARILY_HIDDEN_STOREFRONT_CATEGORY_SLUGS and source the same predicate from
// the API payload (brand / main category / subcategory). Consumers call
// isStorefrontCategoryHidden() / getStorefrontCategories() and should not need
// structural changes.
// ===========================================================================
export const TEMPORARILY_HIDDEN_STOREFRONT_CATEGORY_SLUGS = Object.freeze({
  // VELVET COLLECT
  collect: Object.freeze(['anime-and-manga']),
  // VELVET MOVE
  move: Object.freeze(['climbing', 'bikes', 'beach-toys', 'swimming']),
  // VELVET MUSLIM
  muslim: Object.freeze(['islamic-stories', 'muslim-dolls']),
  // VELVET BOOKS
  books: Object.freeze(['islamic-books']),
});

const hiddenCategorySlugsForBrand = (brandSlug) => (
  TEMPORARILY_HIDDEN_STOREFRONT_CATEGORY_SLUGS[brandSlug] || null
);

/** True when this brand + Main Category pair must stay out of storefront discovery. */
export function isStorefrontCategoryHidden(brandSlug, categorySlug) {
  const hidden = hiddenCategorySlugsForBrand(brandSlug);
  return Boolean(hidden && hidden.includes(categorySlug));
}

/**
 * Storefront-visible Main Categories for a hydrated brand.
 * Returns the brand's own array reference when the brand has no overrides so
 * unaffected brands behave exactly as before.
 */
export function getStorefrontCategories(brand) {
  const categories = Array.isArray(brand?.categories) ? brand.categories : [];
  const hidden = hiddenCategorySlugsForBrand(brand?.slug);
  if (!hidden) return categories;
  return categories.filter((category) => !hidden.includes(category?.slug));
}
