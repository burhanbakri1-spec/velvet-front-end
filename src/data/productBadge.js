/** Pure badge contract, distributed with both independently built repositories.
 * Legacy products retain manual text; an empty legacy badge uses official flags.
 * Auto/none never discard the stored custom text. quickShop is never a badge.
 */
export const PRODUCT_BADGE_MODES = Object.freeze(['auto', 'custom', 'none']);
const AUTO_LABELS = Object.freeze({
  newArrival: { en: 'New', ar: 'وصل حديثًا' },
  bestseller: { en: 'Best Seller', ar: 'الأكثر مبيعًا' },
  featured: { en: 'Featured', ar: 'مميز' },
});
const text = (value) => typeof value === 'string' ? value.trim() : '';
const flag = (product, key, alias) => Object.hasOwn(product, key) ? product[key] === true : product[alias] === true;

export function getCustomProductBadge(product = {}) {
  product = product || {};
  const value = product.customBadge ?? (product.label || product.badge);
  const localized = value && typeof value === 'object' ? value : { en: value };
  return {
    en: text(localized.en ?? localized.english),
    ar: text(product.customBadge == null ? (product.labelAr || product.badgeAr || localized.ar || localized.arabic) : (localized.ar ?? localized.arabic)),
  };
}

export function resolveProductBadgeMode(product = {}) {
  product = product || {};
  if (PRODUCT_BADGE_MODES.includes(product.badgeMode)) return product.badgeMode;
  const custom = getCustomProductBadge(product);
  return custom.en || custom.ar ? 'custom' : 'auto';
}

export function getProductBadgeFields(product = {}) {
  product = product || {};
  return {
    // Undefined is intentional: public JSON must not invent an explicit legacy mode.
    badgeMode: product.badgeMode,
    customBadge: getCustomProductBadge(product),
    featured: flag(product, 'featured', 'isFeatured'),
    newArrival: flag(product, 'newArrival', 'isNewArrival'),
    bestseller: flag(product, 'bestseller', 'isBestseller'),
    quickShop: product.quickShop === true,
  };
}

export function getCustomerFacingProductBadge(product = {}, locale = 'en') {
  const mode = resolveProductBadgeMode(product);
  if (mode === 'none') return '';
  const language = locale === 'ar' ? 'ar' : 'en';
  if (mode === 'custom') {
    const custom = getCustomProductBadge(product);
    return custom[language] || custom[language === 'ar' ? 'en' : 'ar'] || '';
  }
  const fields = getProductBadgeFields(product);
  const winner = ['newArrival', 'bestseller', 'featured'].find((key) => fields[key]);
  return winner ? AUTO_LABELS[winner][language] : '';
}
