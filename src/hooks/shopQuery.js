import { LIVE_CLASSIFICATION_KEYS } from '../data/classificationFilter.js';
import { findCategoryBySlug, findSubcategoryBySlug, getBrand, getManufacturersForPath } from '../data/velvetCatalog.js';

// Shop browsing/filter state is stored in the URL so it is shareable and
// survives refresh. Child selections drop when they no longer fit the parent.

function emptyMultiState() {
  const multi = {};
  LIVE_CLASSIFICATION_KEYS.forEach((key) => { multi[key] = []; });
  multi.shopping = [];
  return multi;
}

export const EMPTY_SHOP_STATE = {
  brand: '',
  category: '',
  subcategory: '',
  manufacturer: '',
  ...emptyMultiState(),
  search: '',
  sort: '',
};

export const SHOP_SORT_OPTIONS = ['featured', 'newest', 'price-asc', 'price-desc', 'name'];

export const MULTI_KEYS = [...LIVE_CLASSIFICATION_KEYS, 'shopping'];
export const PATH_KEYS = ['brand', 'category', 'subcategory', 'manufacturer'];

export function parseShopState(search = '') {
  const params = new URLSearchParams(search);
  const multi = (key) => (params.get(key) || '').split(',').map((value) => value.trim()).filter(Boolean);
  const state = {
    brand: params.get('brand') || '',
    category: params.get('category') || '',
    subcategory: params.get('subcategory') || '',
    manufacturer: params.get('manufacturer') || '',
    search: params.get('search') || '',
    sort: SHOP_SORT_OPTIONS.includes(params.get('sort')) ? params.get('sort') : '',
  };
  LIVE_CLASSIFICATION_KEYS.forEach((key) => {
    state[key] = multi(key);
  });
  state.shopping = multi('shop');
  return state;
}

export function buildShopQuery(state) {
  const params = new URLSearchParams();
  if (state.brand) params.set('brand', state.brand);
  if (state.category) params.set('category', state.category);
  if (state.subcategory) params.set('subcategory', state.subcategory);
  if (state.manufacturer) params.set('manufacturer', state.manufacturer);
  LIVE_CLASSIFICATION_KEYS.forEach((key) => {
    if (state[key]?.length) params.set(key, state[key].join(','));
  });
  if (state.shopping?.length) params.set('shop', state.shopping.join(','));
  if (state.search) params.set('search', state.search);
  if (state.sort && state.sort !== 'featured') params.set('sort', state.sort);
  return params.toString();
}

export function sanitizeShopState(state) {
  const next = { ...state };
  if (next.brand && !getBrand(next.brand)) next.brand = '';
  if (next.category && !findCategoryBySlug(next.category, next.brand)) next.category = '';
  if (!next.category) {
    next.subcategory = '';
    next.manufacturer = '';
    return next;
  }
  if (next.subcategory && !findSubcategoryBySlug(next.category, next.subcategory, next.brand)) next.subcategory = '';
  if (!next.subcategory) {
    next.manufacturer = '';
    return next;
  }
  const manufacturers = getManufacturersForPath(next).map((item) => item.id);
  if (next.manufacturer && !manufacturers.includes(next.manufacturer)) next.manufacturer = '';
  return next;
}

export function selectPathKey(state, key, value) {
  return sanitizeShopState({ ...state, [key]: value });
}

export function toggleMultiKey(state, key, id) {
  const current = state[key] || [];
  return {
    ...state,
    [key]: current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
  };
}
