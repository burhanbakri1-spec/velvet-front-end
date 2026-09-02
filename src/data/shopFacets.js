import { getProductAgeIds } from './ageFilter.js';
import {
  filterProducts,
  findCategoryBySlug,
  getBrand,
  getCategory,
  getFilterGroup,
  velvetBrands,
} from './velvetCatalog.js';

const HIERARCHY_KEYS = ['brand', 'category', 'subcategory'];

export function cloneShopState(state = {}) {
  return {
    brand: state.brand || '',
    category: state.category || '',
    subcategory: state.subcategory || '',
    manufacturer: state.manufacturer || '',
    age: [...(state.age || [])],
    gender: [...(state.gender || [])],
    skill: [...(state.skill || [])],
    occasion: [...(state.occasion || [])],
    shopping: [...(state.shopping || [])],
    search: state.search || '',
    sort: state.sort || '',
  };
}

export function filterProductsForFacet(state, excludeKey) {
  const next = cloneShopState(state);
  if (excludeKey === 'brand') next.brand = '';
  else if (excludeKey === 'category') next.category = '';
  else if (excludeKey === 'subcategory') next.subcategory = '';
  else if (excludeKey === 'manufacturer') next.manufacturer = '';
  else if (excludeKey === 'age') next.age = [];
  else if (excludeKey === 'gender') next.gender = [];
  else if (excludeKey === 'skill') next.skill = [];
  else if (excludeKey === 'occasion') next.occasion = [];
  else if (excludeKey === 'shopping') next.shopping = [];
  return filterProducts(next);
}

export function countFacetValues(pool, facetKey) {
  const counts = {};
  pool.forEach((product) => {
    if (facetKey === 'shopping') {
      (product.shopping || []).forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
      return;
    }
    if (facetKey === 'brand') {
      const id = product.velvetPath?.brandId;
      if (id) counts[id] = (counts[id] || 0) + 1;
      return;
    }
    if (facetKey === 'category') {
      const id = product.velvetPath?.categoryId;
      if (id) counts[id] = (counts[id] || 0) + 1;
      return;
    }
    if (facetKey === 'subcategory') {
      const id = product.velvetPath?.subcategoryId;
      if (id) counts[id] = (counts[id] || 0) + 1;
      return;
    }
    if (facetKey === 'age') {
      getProductAgeIds(product).forEach((id) => {
        counts[id] = (counts[id] || 0) + 1;
      });
      return;
    }
    const value = product[facetKey];
    if (value) counts[value] = (counts[value] || 0) + 1;
  });
  return counts;
}

export function getAvailableFacetValues(state, excludeKey, facetKey) {
  return countFacetValues(filterProductsForFacet(state, excludeKey), facetKey);
}

export function getFacetCount(state, excludeKey, facetKey, valueId) {
  const counts = getAvailableFacetValues(state, excludeKey, facetKey);
  return counts[valueId] || 0;
}

function isFacetVisible(count, selectedIds, valueId) {
  return count > 0 || selectedIds.includes(valueId);
}

export function getAttributeFacetOptions(state, groupKey, locale = 'en') {
  const counts = getAvailableFacetValues(state, groupKey, groupKey);
  const selected = state[groupKey] || [];
  return getFilterGroup(groupKey)
    .filter((item) => isFacetVisible(counts[item.id] || 0, selected, item.id))
    .map((item) => ({
      id: item.id,
      label: item.name[locale],
      count: counts[item.id] || 0,
    }));
}

export function getFacetHierarchyOptions(state = {}) {
  const brandCounts = getAvailableFacetValues(state, 'brand', 'brand');
  const brands = velvetBrands
    .filter((brand) => isFacetVisible(brandCounts[brand.slug] || 0, state.brand ? [state.brand] : [], brand.slug))
    .map((brand) => ({ id: brand.slug, name: brand.name }));

  const categoryCounts = getAvailableFacetValues(state, 'category', 'category');
  const rawCategories = state.brand
    ? (getBrand(state.brand)?.categories || [])
    : velvetBrands.flatMap((brand) => brand.categories || []);
  const seen = new Set();
  const categories = rawCategories
    .filter((category) => {
      if (seen.has(category.slug)) return false;
      seen.add(category.slug);
      if (state.brand && !getCategory(state.brand, category.slug)) return false;
      return isFacetVisible(
        categoryCounts[category.slug] || 0,
        state.category ? [state.category] : [],
        category.slug,
      );
    })
    .map((category) => ({ id: category.slug, name: category.name }));

  const subCounts = getAvailableFacetValues(state, 'subcategory', 'subcategory');
  const parent = state.category
    ? (state.brand ? getCategory(state.brand, state.category) : findCategoryBySlug(state.category))
    : null;
  const subcategories = (parent?.subs || [])
    .filter((sub) => isFacetVisible(
      subCounts[sub.slug] || 0,
      state.subcategory ? [state.subcategory] : [],
      sub.slug,
    ))
    .map((sub) => ({ id: sub.slug, name: sub.name }));

  return { brands, categories, subcategories };
}

export function getFacetOptions(state, facetKey, locale = 'en') {
  if (HIERARCHY_KEYS.includes(facetKey)) {
    const hierarchy = getFacetHierarchyOptions(state);
    if (facetKey === 'brand') {
      return hierarchy.brands.map((item) => ({
        id: item.id,
        label: item.name[locale],
        count: getFacetCount(state, 'brand', 'brand', item.id),
      }));
    }
    if (facetKey === 'category') {
      return hierarchy.categories.map((item) => ({
        id: item.id,
        label: item.name[locale],
        count: getFacetCount(state, 'category', 'category', item.id),
      }));
    }
    return hierarchy.subcategories.map((item) => ({
      id: item.id,
      label: item.name[locale],
      count: getFacetCount(state, 'subcategory', 'subcategory', item.id),
    }));
  }
  return getAttributeFacetOptions(state, facetKey, locale);
}
