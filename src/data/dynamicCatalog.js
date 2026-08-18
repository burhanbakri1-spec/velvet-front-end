// ===========================================================================
// Dynamic VELVET catalog — built from the platform `/api/storefront/content`
// entity data when it is available, mirroring the exact shape that
// ./velvetCatalog.js exposes to the storefront.
//
//   Brand            (platform brand entity)
//   → Main Category  (category with brandId, no parent)
//   → Subcategory    (category whose parentId points at a Main Category)
//   → Products       (product grouped by brandId + mainCategoryId + subcategoryId)
//
// Categories and products are placed in the tree only when their declared
// hierarchy resolves, so every rendered product sits in the exact brand →
// main category → subcategory path. A Main Category / Subcategory renders even
// when it has zero products (navigation comes from entities, not products).
//
// Entity media is canonical: brand.heroVideo/heroPoster/logoUrl,
// category.image/heroVideo and product.usageVideo/usageVideoPoster are mapped
// directly and passed through untouched (only made absolute against apiUrl).
// ===========================================================================

import { artwork } from './products.js';

const slugify = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const localized = (value, locale, fallback = '') => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return String(value[locale] ?? value.en ?? fallback);
  return String(value ?? fallback);
};

const absoluteUrl = (value, apiUrl) => {
  if (!value) return '';
  try { return new URL(value, `${apiUrl}/`).toString(); } catch { return ''; }
};

const finiteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const PALETTES = [
  ['#ffad32', '#ff5f45', '#79233b'], ['#d95ad1', '#8af06d', '#4d1760'], ['#ffd0dc', '#fff0c5', '#a63b68'],
  ['#182045', '#1fd8f2', '#ff275f'], ['#f1a1e5', '#9ce6dd', '#ffd056'], ['#25c8e8', '#ffea4a', '#1460aa'],
  ['#ff8349', '#ffd242', '#824229'], ['#819dff', '#ef9fe3', '#473d92'], ['#ffb6c8', '#f6e6ce', '#a73b68'],
  ['#7be6db', '#5986f2', '#13324f'],
];

const SCENES = ['nursery', 'toybox', 'stage', 'blueprint', 'classroom', 'studio', 'gamenight', 'sports', 'collection', 'cuddle', 'library', 'play'];

// Short wordmark fallback: "VELVET BABY" → "BABY" (kept for the text-logo slot).
const wordmark = (value) => String(value || '').replace(/^velvet\s+/i, '').trim() || value || '';

function buildOptions(rawOptions, apiUrl) {
  return (Array.isArray(rawOptions) ? rawOptions : []).map((option) => ({
    name: localized(option.name, 'en', ''),
    nameAr: localized(option.name, 'ar', ''),
    values: (Array.isArray(option.values) ? option.values : []).map((value) => ({
      label: localized(value.label, 'en', ''),
      labelAr: localized(value.label, 'ar', ''),
      color: String(value.color || ''),
      priceDelta: finiteNumber(value.priceDelta, 0),
      image: absoluteUrl(value.image, apiUrl),
    })),
  }));
}

function buildVariants(rawVariants, apiUrl) {
  return (Array.isArray(rawVariants) ? rawVariants : []).map((variant) => ({
    id: String(variant.id || ''),
    colorName: localized(variant.colorName, 'en', ''),
    colorNameAr: localized(variant.colorName, 'ar', ''),
    colorValue: String(variant.colorValue || ''),
    size: localized(variant.size, 'en', ''),
    sizeAr: localized(variant.size, 'ar', ''),
    price: finiteNumber(variant.price, 0),
    stock: Math.max(0, finiteNumber(variant.stock, 0)),
    image: absoluteUrl(variant.image, apiUrl),
  }));
}

// `shopping` tags are not an entity field; derive them deterministically from
// the badge and price so the existing filter groups keep working.
function deriveShopping(badge, price, hasOffer) {
  const tags = [];
  const key = String(badge || '').trim().toLowerCase();
  if (key.includes('offer')) tags.push('offers');
  else if (key.includes('new')) tags.push('new');
  else if (key.includes('best')) tags.push('bestsellers');
  else if (key.includes('exclusive')) tags.push('exclusive');
  else if (key.includes('limited')) tags.push('limited');
  if (hasOffer && !tags.includes('offers')) tags.push('offers');
  if (price > 0 && price < 50) tags.push('u50');
  if (price > 0 && price < 100) tags.push('u100');
  return [...new Set(tags)];
}

function buildBrand(raw, index, apiUrl) {
  const h = hash(raw.slug || raw.id || `brand-${index}`);
  const palette = PALETTES[h % PALETTES.length];
  const scene = SCENES[h % SCENES.length];
  const nameEn = localized(raw.name, 'en', '');
  const nameAr = localized(raw.name, 'ar', nameEn);
  const heroVideo = absoluteUrl(raw.heroVideo, apiUrl);
  const heroPoster = absoluteUrl(raw.heroPoster, apiUrl);
  const logoUrl = absoluteUrl(raw.logoUrl, apiUrl);
  const short = { en: wordmark(nameEn), ar: wordmark(nameAr) };
  const order = finiteNumber(raw.sortOrder, index + 1);
  return {
    id: String(raw.id || ''),
    slug: String(raw.slug || slugify(nameEn || raw.id || `brand-${index + 1}`)),
    name: { en: nameEn, ar: nameAr },
    short,
    tagline: { en: '', ar: '' },
    color: palette[0],
    productBrands: [],
    accent: palette[0],
    heroVideo,
    heroPoster,
    logoUrl,
    image: heroPoster || artwork(nameEn || raw.slug || 'Brand', palette, index % 6),
    palette,
    scene,
    logo: short,
    home: {
      order,
      kickerEn: short.en,
      kickerAr: short.ar,
      palette,
      scene,
      logo: short,
      accent: palette[0],
      heroVideo,
      heroPoster,
    },
    categories: [],
  };
}

function buildCategory(raw, subs, apiUrl) {
  const nameEn = localized(raw.name, 'en', '');
  const nameAr = localized(raw.name, 'ar', nameEn);
  return {
    id: String(raw.id || ''),
    slug: String(raw.slug || slugify(nameEn || raw.id || 'item')),
    name: { en: nameEn, ar: nameAr },
    description: { en: localized(raw.description, 'en', ''), ar: localized(raw.description, 'ar', '') },
    heroImage: absoluteUrl(raw.image || raw.imageUrl, apiUrl),
    heroVideo: absoluteUrl(raw.heroVideo, apiUrl),
    subs: subs.map((sub) => {
      const subNameEn = localized(sub.name, 'en', '');
      const subNameAr = localized(sub.name, 'ar', subNameEn);
      return {
        id: String(sub.id || ''),
        slug: String(sub.slug || slugify(subNameEn || sub.id || 'sub')),
        name: { en: subNameEn, ar: subNameAr },
      };
    }),
  };
}

function buildProduct(raw, brandSlug, mainCategory, subSlug, index, apiUrl) {
  const nameEn = localized(raw.name, 'en', '');
  const nameAr = localized(raw.name, 'ar', nameEn);
  const h = hash(`${brandSlug}:${mainCategory?.slug || ''}:${subSlug}:${raw.slug || raw.id}`);
  const palette = PALETTES[h % PALETTES.length];
  const gallery = (Array.isArray(raw.gallery) ? raw.gallery.map((url) => absoluteUrl(url, apiUrl)) : []).filter(Boolean);
  const image = absoluteUrl(raw.image || raw.primaryImage, apiUrl) || gallery[0] || artwork(nameEn || raw.slug || 'Toy', palette, h % 6);
  const hoverImage = absoluteUrl(raw.hoverImage || raw.secondaryImage, apiUrl) || gallery[1] || image;
  const badge = localized(raw.badge, 'en', '');
  const badgeAr = localized(raw.badge, 'ar', badge);
  const variants = buildVariants(raw.variants, apiUrl);
  const stock = variants.length ? variants.reduce((sum, variant) => sum + variant.stock, 0) : Math.max(0, finiteNumber(raw.stock, 0));
  const availability = stock <= 0 ? 'Out of stock' : stock <= 5 ? 'Low stock' : 'In stock';
  const availabilityAr = stock <= 0 ? 'غير متوفر' : stock <= 5 ? 'كمية محدودة' : 'متوفر';
  const price = finiteNumber(raw.price ?? raw.basePrice, 0);
  const originalPrice = raw.originalPrice == null ? null : finiteNumber(raw.originalPrice, 0);
  const hasOffer = badge.toLowerCase().includes('offer') || Boolean(originalPrice);
  return {
    id: String(raw.id || `${brandSlug}-${index + 1}`),
    slug: String(raw.slug || ''),
    name: nameEn,
    nameAr,
    category: mainCategory?.name.en || '',
    categoryId: mainCategory?.slug || '',
    categorySlug: mainCategory?.slug || '',
    brandId: brandSlug,
    subcategoryId: subSlug,
    manufacturer: String(raw.manufacturer || ''),
    manufacturerId: slugify(raw.manufacturer || ''),
    price,
    originalPrice,
    badge,
    badgeAr,
    shortDescription: localized(raw.shortDescription, 'en', ''),
    shortDescriptionAr: localized(raw.shortDescription, 'ar', ''),
    description: localized(raw.description, 'en', ''),
    descriptionAr: localized(raw.description, 'ar', ''),
    image,
    hoverImage,
    gallery,
    colors: palette,
    options: buildOptions(raw.options, apiUrl),
    variants,
    stock,
    inventoryManaged: true,
    availability,
    availabilityAr,
    age: String(raw.age || ''),
    gender: String(raw.gender || ''),
    skill: String(raw.skill || ''),
    occasion: String(raw.occasion || ''),
    shopping: deriveShopping(badge, price, hasOffer),
    usageVideo: absoluteUrl(raw.usageVideo, apiUrl),
    usageVideoPoster: absoluteUrl(raw.usageVideoPoster, apiUrl),
    featured: raw.featured === true,
    velvetPath: { brandId: brandSlug, categoryId: mainCategory?.slug || '', subcategoryId: subSlug },
  };
}

// Build the dynamic catalog tree. Returns null when the payload carries no
// brands (the storefront then keeps the static VELVET catalog as fallback).
export function buildDynamicCatalog(payload, apiUrl) {
  if (!payload || !Array.isArray(payload.brands) || payload.brands.length === 0) return null;
  const rawCategories = Array.isArray(payload.categories) ? payload.categories : [];
  const rawProducts = Array.isArray(payload.products) ? payload.products : [];

  const categoryIndex = new Map(rawCategories.map((category) => [String(category.id || ''), category]));

  const rootOf = (category) => {
    const seen = new Set();
    let current = category;
    while (current && current.parentId && !seen.has(String(current.parentId))) {
      seen.add(String(current.parentId));
      const parent = categoryIndex.get(String(current.parentId));
      if (!parent) break;
      current = parent;
    }
    return current;
  };

  const brands = payload.brands.map((raw, index) => buildBrand(raw, index, apiUrl));
  const brandByRawId = new Map(brands.map((brand) => [brand.id, brand]));

  // Main Categories are the brandId children with no parent; Subcategories are
  // the direct children of a Main Category. Both are attached to the tree even
  // when they own zero products.
  const mainCategories = rawCategories
    .filter((category) => !category.parentId)
    .sort((a, b) => finiteNumber(a.sortOrder, 0) - finiteNumber(b.sortOrder, 0));

  const mainByRawId = new Map();
  for (const rawMain of mainCategories) {
    const brand = brandByRawId.get(String(rawMain.brandId || ''));
    if (!brand) continue;
    const subs = rawCategories
      .filter((category) => category.parentId && String(category.parentId) === String(rawMain.id))
      .sort((a, b) => finiteNumber(a.sortOrder, 0) - finiteNumber(b.sortOrder, 0));
    const main = buildCategory(rawMain, subs, apiUrl);
    brand.categories.push(main);
    mainByRawId.set(String(rawMain.id || ''), main);
  }

  // Products land in the exact brand → main category → subcategory path. Only
  // products whose declared hierarchy resolves are placed in the catalog.
  const products = [];
  for (const [index, rawProduct] of rawProducts.entries()) {
    const brand = brandByRawId.get(String(rawProduct.brandId || ''));
    if (!brand) continue;
    const rawMain = rawProduct.mainCategoryId
      ? categoryIndex.get(String(rawProduct.mainCategoryId))
      : (rawProduct.categoryId ? categoryIndex.get(String(rawProduct.categoryId)) : null);
    if (!rawMain) continue;
    const root = rootOf(rawMain);
    const main = mainByRawId.get(String(root.id || ''));
    // Only products whose declared hierarchy resolves exactly are placed: the
    // main category must be attached under the product's brand.
    if (!main) continue;
    if (root.brandId && String(root.brandId) !== String(rawProduct.brandId)) continue;
    let subSlug = '';
    if (rawProduct.subcategoryId) {
      const rawSub = categoryIndex.get(String(rawProduct.subcategoryId));
      if (rawSub && String(rawSub.parentId) === String(root.id)) subSlug = String(rawSub.slug || '');
    }
    products.push(buildProduct(rawProduct, brand.slug, main, subSlug, index, apiUrl));
  }

  return { brands, products };
}
