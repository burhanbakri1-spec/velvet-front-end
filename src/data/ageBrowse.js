import { getProductAgeIds } from './ageFilter.js';
import { isStripVisibleProduct } from './brandProductStrip.js';
import { getFilterGroup } from './velvetCatalog.js';

// These ids are the canonical age dimension keys provided by storefront
// filterDefinitions.age. Labels always come from that live definition list.
export const CANONICAL_AGE_IDS = Object.freeze(['0-3y', '3-6y', '6-10y', '10+y']);
const AGE_RANGE_LABELS = Object.freeze({ '0-3y': '0–3', '3-6y': '3–6', '6-10y': '6–10', '10+y': '10+' });

export function formatCanonicalAgeRange(ageId) {
  return AGE_RANGE_LABELS[ageId] || '';
}

export function getCanonicalAgeGroups() {
  const definitions = new Map(getFilterGroup('age').map((item) => [item.id, item]));
  return CANONICAL_AGE_IDS.map((id) => definitions.get(id)).filter(Boolean);
}

function isAgeBrowseEligible(product) {
  if (!isStripVisibleProduct(product)) return false;
  const status = String(product?.status || '').trim().toLowerCase().replace(/[ _]+/g, '-');
  return !['pending-review', 'review-pending', 'identity-pending', 'pending-identity'].includes(status);
}

export function selectAgeBrowseProducts(products, ageId) {
  if (!CANONICAL_AGE_IDS.includes(ageId)) return [];
  const seen = new Set();
  return (Array.isArray(products) ? products : []).filter((product) => {
    if (!isAgeBrowseEligible(product) || !getProductAgeIds(product).includes(ageId)) return false;
    const key = String(product?.id ?? product?.slug ?? '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
