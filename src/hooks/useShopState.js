import { useCallback, useMemo } from 'react';
import { useRouter, localizePath } from '../routing/Router';
import { useI18n } from '../i18n/I18nContext';
import { getBrand, getCategory, getManufacturersForPath, getSubcategory } from '../data/velvetCatalog';

// Shop browsing/filter state is stored in the URL so it is shareable and
// survives refresh. The cascade resets child selections when a parent changes.

export const EMPTY_SHOP_STATE = {
  brand: '',
  category: '',
  subcategory: '',
  manufacturer: '',
  age: [],
  gender: [],
  skill: [],
  occasion: [],
  shopping: [],
  search: '',
};

const MULTI_KEYS = ['age', 'gender', 'skill', 'occasion', 'shopping'];

export function parseShopState(search = '') {
  const params = new URLSearchParams(search);
  const multi = (key) => (params.get(key) || '').split(',').map((value) => value.trim()).filter(Boolean);
  return {
    brand: params.get('brand') || '',
    category: params.get('category') || '',
    subcategory: params.get('subcategory') || '',
    manufacturer: params.get('manufacturer') || '',
    age: multi('age'),
    gender: multi('gender'),
    skill: multi('skill'),
    occasion: multi('occasion'),
    shopping: multi('shop'),
    search: params.get('search') || '',
  };
}

export function buildShopQuery(state) {
  const params = new URLSearchParams();
  if (state.brand) params.set('brand', state.brand);
  if (state.category) params.set('category', state.category);
  if (state.subcategory) params.set('subcategory', state.subcategory);
  if (state.manufacturer) params.set('manufacturer', state.manufacturer);
  MULTI_KEYS.filter((key) => key !== 'shopping').forEach((key) => {
    if (state[key]?.length) params.set(key, state[key].join(','));
  });
  if (state.shopping?.length) params.set('shop', state.shopping.join(','));
  if (state.search) params.set('search', state.search);
  return params.toString();
}

// Drop stale selections that no longer fit the current hierarchy
// (handles hand-edited / bookmarked URLs).
export function sanitizeShopState(state) {
  let next = { ...state };
  const brand = next.brand ? getBrand(next.brand) : null;
  if (!brand) {
    next.category = '';
    next.subcategory = '';
    next.manufacturer = '';
    return next;
  }
  if (next.category && !getCategory(brand.slug, next.category)) next.category = '';
  if (!next.category) {
    next.subcategory = '';
    next.manufacturer = '';
    return next;
  }
  if (next.subcategory && !getSubcategory(brand.slug, next.category, next.subcategory)) next.subcategory = '';
  if (!next.subcategory) {
    next.manufacturer = '';
    return next;
  }
  const manufacturers = getManufacturersForPath(next).map((item) => item.id);
  if (next.manufacturer && !manufacturers.includes(next.manufacturer)) next.manufacturer = '';
  return next;
}

// Cascade reset: changing a parent clears every child selection.
export function selectPathKey(state, key, value) {
  const next = { ...state, [key]: value };
  if (key === 'brand') { next.category = ''; next.subcategory = ''; next.manufacturer = ''; }
  else if (key === 'category') { next.subcategory = ''; next.manufacturer = ''; }
  else if (key === 'subcategory') { next.manufacturer = ''; }
  return next;
}

export function toggleMultiKey(state, key, id) {
  const current = state[key] || [];
  return {
    ...state,
    [key]: current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
  };
}

export function shopHref(state, locale) {
  const query = buildShopQuery(state);
  return localizePath(`/products${query ? `?${query}` : ''}`, locale);
}

export function useShopState() {
  const { location, navigate } = useRouter();
  const { locale } = useI18n();

  const state = useMemo(() => sanitizeShopState(parseShopState(location.search)), [location.search]);

  const go = useCallback((next, { replace = false, scroll = false } = {}) => {
    const query = buildShopQuery(next);
    navigate(localizePath(`/products${query ? `?${query}` : ''}`, locale), { replace, scroll });
  }, [locale, navigate]);

  const select = useCallback((key, value) => go(selectPathKey(state, key, value)), [go, state]);
  const toggle = useCallback((key, id) => go(toggleMultiKey(state, key, id)), [go, state]);
  const removeFilter = useCallback((key, id) => {
    go(key === 'manufacturer' ? selectPathKey(state, 'manufacturer', '') : toggleMultiKey(state, key, id));
  }, [go, state]);
  const clearFilters = useCallback(() => {
    go({ ...state, age: [], gender: [], skill: [], occasion: [], shopping: [], manufacturer: '' });
  }, [go, state]);
  const resetAll = useCallback(() => go(EMPTY_SHOP_STATE), [go]);
  const setSearch = useCallback((value) => {
    go({ ...state, search: value.trim() });
  }, [go, state]);

  const activeFilterCount = useMemo(() => (
    (state.manufacturer ? 1 : 0)
    + state.age.length + state.gender.length + state.skill.length + state.occasion.length + state.shopping.length
  ), [state]);

  return {
    state, go, select, toggle, removeFilter, clearFilters, resetAll, setSearch, activeFilterCount,
  };
}
