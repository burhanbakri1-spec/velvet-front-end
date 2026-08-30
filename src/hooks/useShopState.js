import { useCallback, useMemo } from 'react';
import { useRouter, localizePath } from '../routing/Router';
import { useI18n } from '../i18n/I18nContext';
import {
  EMPTY_SHOP_STATE,
  PATH_KEYS,
  SHOP_SORT_OPTIONS,
  buildShopQuery,
  parseShopState,
  selectPathKey,
  sanitizeShopState,
  toggleMultiKey,
} from './shopQuery';

export {
  EMPTY_SHOP_STATE,
  SHOP_SORT_OPTIONS,
  parseShopState,
  buildShopQuery,
  sanitizeShopState,
  selectPathKey,
  toggleMultiKey,
};

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
    if (PATH_KEYS.includes(key)) {
      go(selectPathKey(state, key, ''));
      return;
    }
    go(toggleMultiKey(state, key, id));
  }, [go, state]);
  const clearFilters = useCallback(() => {
    go({ ...state, age: [], gender: [], skill: [], occasion: [], shopping: [], manufacturer: '' });
  }, [go, state]);
  const resetAll = useCallback(() => go(EMPTY_SHOP_STATE), [go]);
  const setSearch = useCallback((value) => {
    go({ ...state, search: value.trim() });
  }, [go, state]);
  const setSort = useCallback((value) => {
    go({ ...state, sort: SHOP_SORT_OPTIONS.includes(value) ? value : '' });
  }, [go, state]);
  const clearGroup = useCallback((key) => {
    if (PATH_KEYS.includes(key)) {
      go(selectPathKey(state, key, ''));
      return;
    }
    go({ ...state, [key]: [] });
  }, [go, state]);

  const activeFilterCount = useMemo(() => (
    (state.manufacturer ? 1 : 0)
    + state.age.length + state.gender.length + state.skill.length + state.occasion.length + state.shopping.length
  ), [state]);

  return {
    state, go, select, toggle, removeFilter, clearFilters, resetAll, setSearch, setSort, clearGroup, activeFilterCount,
  };
}
