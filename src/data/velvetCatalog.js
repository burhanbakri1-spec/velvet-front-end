// ===========================================================================
// VELVET catalog — centralized temporary data layer.
//
// VELVET is a GROUP / parent company. Under VELVET there are internal brands
// (VELVET BABY, VELVET KIDS, …). Each brand owns a category tree:
//
//   VELVET Group
//   → Brand            (internal VELVET family / play experience)
//   → Main Category
//   → Subcategory
//   → Products
//
// A product may additionally carry an external Product Brand / Manufacturer
// (Fisher-Price, Mattel, Hasbro, Disney, …). That dimension is kept separate
// from the internal VELVET brand — never mix the two.
//
// Taxonomy hierarchy and product_id classification come from
// velvetTaxonomy.js (generated from velvet_product_taxonomy.xlsx). Presentation
// metadata (kickers, accents, manufacturer lists) stays local. Live commerce
// fields (price, stock, images, variants) continue to come from products.js /
// the platform catalog — never from the workbook.
//
// Filter logic (documented): selections inside one group are OR; groups are
// ANDed. Category path (brand + category + subcategory + manufacturer) is ANDed
// with every selected filter group. Resolve hierarchy with brandSlug +
// mainSlug + leafSlug — leaf slugs alone are not globally unique.
// ===========================================================================

import { artwork, products } from './products.js';
import { getPlatformBrandAbout, getPlatformMedia } from './platformContent.js';
import {
  outsideTaxonomyProductIds,
  productTaxonomyById,
  velvetTaxonomyBrands,
  velvetTaxonomyStats,
} from './velvetTaxonomy.js';

export { outsideTaxonomyProductIds, productTaxonomyById, velvetTaxonomyBrands, velvetTaxonomyStats };

const slugify = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

// ---------------------------------------------------------------------------
// Brand presentation metadata (not taxonomy). Taxonomy comes from velvetTaxonomy.js.
const BRAND_META = {
  baby: { short: { ar: 'بيبي', en: 'Baby' }, tagline: { ar: 'ألعاب الرضع والأطفال الصغار', en: 'Baby & Toddler' }, color: '#7ec8a3', productBrands: ['Fisher-Price', 'VTech', 'Chicco', 'Infantino', 'Other'] },
  kids: { short: { ar: 'كيدز', en: 'Kids' }, tagline: { ar: 'ألعاب الأطفال العامة', en: 'Kids Toys' }, color: '#f0b27a', productBrands: ['Hasbro', 'Mattel', 'Disney', 'Spin Master', 'Other'] },
  play: { short: { ar: 'بلاي', en: 'Play' }, tagline: { ar: 'التمثيل والخيال', en: 'Pretend Play & Imagination' }, color: '#e8a0bf', productBrands: ['Barbie', 'Baby Born', 'Our Generation', 'Disney', 'Playmobil', 'Other'] },
  build: { short: { ar: 'بيلد', en: 'Build' }, tagline: { ar: 'البناء والتركيب', en: 'Construction & Building' }, color: '#7eb6d9', productBrands: ['LEGO', 'Playmobil', 'MEGA', 'Magna-Tiles', 'Plus-Plus', 'Other'] },
  learn: { short: { ar: 'ليرن', en: 'Learn' }, tagline: { ar: 'التعليم والذكاء', en: 'Educational, STEM & Montessori' }, color: '#a8d08d', productBrands: ['Montessori', 'Learning Resources', 'Thames & Kosmos', 'Osmo', 'Other'] },
  create: { short: { ar: 'كريت', en: 'Create' }, tagline: { ar: 'الفن والإبداع', en: 'Arts, Crafts & DIY' }, color: '#f2c14e', productBrands: ['Crayola', 'Play-Doh', 'Klutz', 'Make It Real', 'Other'] },
  games: { short: { ar: 'جيمز', en: 'Games' }, tagline: { ar: 'الألعاب والبازل', en: 'Games, Puzzles & Family' }, color: '#c9a0dc', productBrands: ['Ravensburger', 'Hasbro', 'Mattel Games', 'Exploding Kittens', 'Other'] },
  move: { short: { ar: 'موف', en: 'Move' }, tagline: { ar: 'الحركة والرياضة', en: 'Outdoor, Sports & Active Play' }, color: '#6ec6c0', productBrands: ['Razor', 'Little Tikes', 'Intex', 'Sports Brands', 'Other'] },
  collect: { short: { ar: 'كولكت', en: 'Collect' }, tagline: { ar: 'المقتنيات وهواة الألعاب', en: 'Collectibles & Kidults' }, color: '#d4a574', productBrands: ['Pokémon', 'Funko', 'Marvel', 'DC', 'Disney', 'Bandai', 'Other'] },
  plush: { short: { ar: 'بلاش', en: 'Plush' }, tagline: { ar: 'الألعاب الناعمة', en: 'Soft Toys' }, color: '#f5b5c8', productBrands: ['Disney', 'Steiff', 'GUND', 'Squishmallows', 'Other'] },
  books: { short: { ar: 'بوكس', en: 'Books' }, tagline: { ar: 'الكتب والقصص', en: 'Books & Stories' }, color: '#9bb8d4', productBrands: ['Usborne', 'Scholastic', 'Disney Books', 'Local Publishers', 'Other'] },
  muslim: { short: { ar: 'مسلم', en: 'Muslim' }, tagline: { ar: 'الألعاب والتعليم الإسلامي', en: 'Islamic Toys & Learning' }, color: '#7dcea0', productBrands: ['Desi Dolls', 'Noor Kids', 'Islamic Toys Co', 'Local Islamic', 'Other'] },
};

// ---------------------------------------------------------------------------
// Brand showcase metadata: homepage banner, logo slot and media per sub-brand.
// Each VELVET sub-brand owns a landing /{locale}/brands/{slug} page.
// ---------------------------------------------------------------------------
const BRAND_SHOWCASE = {
  baby: { order: 1, kickerEn: 'Soft beginnings', kickerAr: 'بدايات ناعمة', palette: ['#2f7d5e', '#7ec8a3', '#d9f1e3'], scene: 'nursery', logo: { en: 'BABY', ar: 'بيبي' } },
  kids: { order: 2, kickerEn: 'Everyday adventures', kickerAr: 'مغامرات يومية', palette: ['#a5601f', '#f0b27a', '#fdecd6'], scene: 'toybox', logo: { en: 'KIDS', ar: 'كيدز' } },
  play: { order: 3, kickerEn: 'Pretend & imagine', kickerAr: 'تخيّل والعب', palette: ['#9c3f68', '#e8a0bf', '#fce4ee'], scene: 'stage', logo: { en: 'PLAY', ar: 'بلاي' } },
  build: { order: 4, kickerEn: 'Construct & create', kickerAr: 'ابنِ واصنع', palette: ['#2f6ca0', '#7eb6d9', '#e3f0fa'], scene: 'blueprint', logo: { en: 'BUILD', ar: 'بيلد' } },
  learn: { order: 5, kickerEn: 'Discover & grow', kickerAr: 'اكتشف وتعلّم', palette: ['#4c7d34', '#a8d08d', '#e9f5df'], scene: 'classroom', logo: { en: 'LEARN', ar: 'ليرن' } },
  create: { order: 6, kickerEn: 'Make it yours', kickerAr: 'اصنعها بنفسك', palette: ['#b07f13', '#f2c14e', '#fdf2cf'], scene: 'studio', logo: { en: 'CREATE', ar: 'كريت' } },
  games: { order: 7, kickerEn: 'Play together', kickerAr: 'العب معاً', palette: ['#8a4fa8', '#c9a0dc', '#f0e2f8'], scene: 'gamenight', logo: { en: 'GAMES', ar: 'جيمز' } },
  move: { order: 8, kickerEn: 'Get moving', kickerAr: 'تحرّك والعب', palette: ['#2f8a84', '#6ec6c0', '#ddf4f1'], scene: 'sports', logo: { en: 'MOVE', ar: 'موف' } },
  collect: { order: 9, kickerEn: 'Find your favorites', kickerAr: 'اجمع ما تحب', palette: ['#9c5f2e', '#d4a574', '#f6ead8'], scene: 'collection', logo: { en: 'COLLECT', ar: 'كولكت' } },
  plush: { order: 10, kickerEn: 'Soft & cuddly', kickerAr: 'ناعم ورقيق', palette: ['#b34a6f', '#f5b5c8', '#fde3eb'], scene: 'cuddle', logo: { en: 'PLUSH', ar: 'بلاش' } },
  books: { order: 11, kickerEn: 'Stories to explore', kickerAr: 'قصص لاكتشاف', palette: ['#3f6f9b', '#9bb8d4', '#e4eff9'], scene: 'library', logo: { en: 'BOOKS', ar: 'بوكس' } },
  muslim: { order: 12, kickerEn: 'Faith & fun', kickerAr: 'إيمان ومرح', palette: ['#2f7d58', '#7dcea0', '#e2f4ea'], scene: 'muslim', logo: { en: 'MUSLIM', ar: 'مسلم' } },
};

// ---------------------------------------------------------------------------
// Hydrate workbook taxonomy with local presentation metadata.
// Workbook slugs are authoritative and must not be rewritten for uniqueness.
// ---------------------------------------------------------------------------
function hydrateTaxonomyBrands(taxonomyBrands) {
  return taxonomyBrands.map((brand, index) => {
    const meta = BRAND_META[brand.slug] || {};
    const showcase = BRAND_SHOWCASE[brand.slug] || {};
    const short = meta.short || { en: brand.name.en, ar: brand.name.ar };
    const palette = showcase.palette || [meta.color || '#7ec8a3', meta.color || '#7ec8a3', meta.color || '#7ec8a3'];
    const categories = (brand.mainCategories || []).map((category) => ({
      id: category.slug,
      slug: category.slug,
      code: category.code || '',
      name: { en: category.nameEn, ar: category.nameAr },
      subs: (category.subcategories || []).map((sub) => ({
        id: sub.slug,
        slug: sub.slug,
        code: sub.code || '',
        name: { en: sub.nameEn, ar: sub.nameAr },
      })),
    }));
    return {
      id: brand.slug,
      slug: brand.slug,
      code: brand.code || '',
      name: brand.name,
      short,
      tagline: meta.tagline || { en: '', ar: '' },
      color: meta.color || palette[0],
      productBrands: meta.productBrands || [],
      categories,
      accent: palette[0],
      heroVideo: '',
      heroPoster: '',
      logoUrl: '',
      home: {
        order: showcase.order || index + 1,
        kickerEn: showcase.kickerEn || short.en,
        kickerAr: showcase.kickerAr || short.ar,
        palette,
        scene: showcase.scene || 'play',
        logo: showcase.logo || short,
        accent: palette[0],
        heroVideo: '',
        heroPoster: '',
      },
      image: artwork(`${brand.name.en} world`, palette, (index % 6) + 1),
      palette,
      scene: showcase.scene || 'play',
      logo: showcase.logo || short,
    };
  });
}

function cloneBrandTree(brands) {
  return brands.map((brand) => ({
    ...brand,
    name: { ...brand.name },
    short: { ...brand.short },
    tagline: { ...brand.tagline },
    home: { ...brand.home, logo: { ...brand.home.logo }, palette: [...brand.home.palette] },
    palette: [...brand.palette],
    logo: { ...brand.logo },
    categories: brand.categories.map((category) => ({
      ...category,
      name: { ...category.name },
      subs: category.subs.map((sub) => ({ ...sub, name: { ...sub.name } })),
    })),
  }));
}

function matchStaticBrand(platformBrand) {
  if (!platformBrand) return null;
  const slug = String(platformBrand.slug || '');
  return STATIC_BRANDS.find((brand) => brand.slug === slug)
    || STATIC_BRANDS.find((brand) => brand.slug === slug.replace(/^velvet-/, ''))
    || null;
}

function mergePlatformBrandMedia(platformBrands = []) {
  const tree = cloneBrandTree(STATIC_BRANDS);
  for (const platformBrand of platformBrands) {
    const target = matchStaticBrand(platformBrand);
    if (!target) continue;
    const brand = tree.find((item) => item.slug === target.slug);
    if (!brand) continue;
    if (platformBrand.logoUrl) brand.logoUrl = platformBrand.logoUrl;
    if (platformBrand.heroVideo) {
      brand.heroVideo = platformBrand.heroVideo;
      brand.home.heroVideo = platformBrand.heroVideo;
    }
    if (platformBrand.heroPoster) {
      brand.heroPoster = platformBrand.heroPoster;
      brand.home.heroPoster = platformBrand.heroPoster;
      brand.image = platformBrand.heroPoster;
    }
    for (const platformMain of platformBrand.categories || []) {
      const main = brand.categories.find((category) => category.slug === platformMain.slug);
      if (!main) continue;
      if (platformMain.heroImage) main.heroImage = platformMain.heroImage;
      if (platformMain.heroVideo) main.heroVideo = platformMain.heroVideo;
      for (const platformSub of platformMain.subs || []) {
        const sub = main.subs.find((entry) => entry.slug === platformSub.slug);
        if (!sub) continue;
        if (platformSub.image) sub.image = platformSub.image;
        if (platformSub.heroVideo) sub.heroVideo = platformSub.heroVideo;
      }
    }
  }
  return tree;
}

export function getProductTaxonomy(productId) {
  if (productId == null || productId === '') return null;
  return productTaxonomyById[String(productId)] || null;
}

export function applyTaxonomyToProduct(product) {
  if (!product) return product;
  const taxonomy = getProductTaxonomy(product.id);
  if (!taxonomy) return product;
  const brandSlug = taxonomy.brandSlug || '';
  const categoryId = taxonomy.mainSlug || '';
  const subcategoryId = taxonomy.subcategorySlug || '';
  const category = categoryId ? getCategory(brandSlug, categoryId) : null;
  return {
    ...product,
    brandId: brandSlug || product.brandId || '',
    categoryId: categoryId || '',
    categorySlug: categoryId || '',
    category: category?.name?.en || (categoryId ? product.category : ''),
    subcategoryId,
    velvetPath: {
      brandId: brandSlug || '',
      categoryId,
      subcategoryId,
    },
    taxonomyStatus: taxonomy.classificationStatus || '',
  };
}

const STATIC_BRANDS = hydrateTaxonomyBrands(velvetTaxonomyBrands);
export let velvetBrands = STATIC_BRANDS;
let dynamicCatalogMode = false;

// Swap runtime products to the platform catalog when brand entities exist.
// Storefront taxonomy/navigation stays workbook-backed; platform brand media is
// merged onto matching taxonomy brands. Product taxonomy is applied by product_id.
export function applyDynamicCatalog(brands = null, products = null) {
  if (!Array.isArray(brands) || brands.length === 0) {
    dynamicCatalogMode = false;
    velvetBrands = STATIC_BRANDS;
    velvetProducts = STATIC_PRODUCTS;
    return;
  }
  dynamicCatalogMode = true;
  velvetBrands = mergePlatformBrandMedia(brands);
  velvetProducts = (Array.isArray(products) ? products : []).map((product) => {
    const withTaxonomy = applyTaxonomyToProduct(product);
    if (getProductTaxonomy(product.id)) return withTaxonomy;
    const matched = matchStaticBrand({ slug: withTaxonomy.velvetPath?.brandId || withTaxonomy.brandId });
    if (!matched) return withTaxonomy;
    const categoryId = withTaxonomy.velvetPath?.categoryId || '';
    const subcategoryId = withTaxonomy.velvetPath?.subcategoryId || '';
    const category = categoryId ? getCategory(matched.slug, categoryId) : null;
    const sub = category && subcategoryId ? getSubcategory(matched.slug, categoryId, subcategoryId) : null;
    return {
      ...withTaxonomy,
      brandId: matched.slug,
      categoryId: category ? category.slug : '',
      categorySlug: category ? category.slug : '',
      category: category?.name?.en || '',
      subcategoryId: sub ? sub.slug : '',
      velvetPath: {
        brandId: matched.slug,
        categoryId: category ? category.slug : '',
        subcategoryId: sub ? sub.slug : '',
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Filter dictionary (independent of the category tree).
// ---------------------------------------------------------------------------
const filterItem = (id, en, ar) => ({ id, name: { en, ar } });

export const filterGroups = {
  age: [
    filterItem('0-12m', '0–12 Months', '0–12 شهر'),
    filterItem('1-2y', '1–2 Years', '1–2 سنة'),
    filterItem('3-4y', '3–4 Years', '3–4 سنوات'),
    filterItem('5-6y', '5–6 Years', '5–6 سنوات'),
    filterItem('7-9y', '7–9 Years', '7–9 سنوات'),
    filterItem('10-12y', '10–12 Years', '10–12 سنة'),
    filterItem('13+', '13+', '13+'),
    filterItem('adults', 'Adults', 'البالغون'),
  ],
  gender: [
    filterItem('boys', 'Boys', 'أولاد'),
    filterItem('girls', 'Girls', 'بنات'),
    filterItem('unisex', 'Unisex', 'للجميع'),
  ],
  skill: [
    filterItem('creativity', 'Creativity', 'الإبداع'),
    filterItem('imagination', 'Imagination', 'الخيال'),
    filterItem('fine-motor', 'Fine Motor', 'مهارات دقيقة'),
    filterItem('gross-motor', 'Gross Motor', 'مهارات كبرى'),
    filterItem('problem', 'Problem Solving', 'حل المشكلات'),
    filterItem('logic', 'Logic', 'المنطق'),
    filterItem('memory', 'Memory', 'الذاكرة'),
    filterItem('stem', 'STEM', 'STEM'),
    filterItem('social', 'Social Skills', 'اجتماعية'),
    filterItem('language', 'Language', 'اللغة'),
    filterItem('emotional', 'Emotional', 'عاطفي'),
  ],
  occasion: [
    filterItem('birthday', 'Birthday', 'عيد ميلاد'),
    filterItem('eid', 'Eid', 'عيد'),
    filterItem('ramadan', 'Ramadan', 'رمضان'),
    filterItem('christmas', 'Christmas', 'كريسماس'),
    filterItem('school', 'Back to School', 'عودة للمدرسة'),
    filterItem('newbaby', 'New Baby', 'مولود جديد'),
    filterItem('gift', 'Gift', 'هدية'),
  ],
  shopping: [
    filterItem('new', 'New Arrivals', 'وصل حديثًا'),
    filterItem('bestsellers', 'Best Sellers', 'الأكثر مبيعًا'),
    filterItem('offers', 'Offers', 'العروض'),
    filterItem('exclusive', 'Exclusive', 'حصري'),
    filterItem('limited', 'Limited Edition', 'إصدار محدود'),
    filterItem('gifts', 'Gift Ideas', 'أفكار هدايا'),
    filterItem('u50', 'Under 50', 'أقل من 50'),
    filterItem('u100', 'Under 100', 'أقل من 100'),
  ],
};

export const quickShopGroups = ['age', 'gender', 'skill', 'occasion', 'shopping'];

export function getActiveFilterTags(state, locale = 'en') {
  const tags = [];
  if (state.brand) {
    const brand = getBrand(state.brand);
    tags.push({ groupKey: 'brand', id: state.brand, label: brand ? brand.name[locale] : state.brand });
  }
  if (state.category) {
    const category = findCategoryBySlug(state.category, state.brand);
    tags.push({ groupKey: 'category', id: state.category, label: category ? category.name[locale] : state.category });
  }
  if (state.subcategory) {
    const sub = findSubcategoryBySlug(state.category, state.subcategory, state.brand);
    tags.push({ groupKey: 'subcategory', id: state.subcategory, label: sub ? sub.name[locale] : state.subcategory });
  }
  [
    { key: 'age', group: 'age' },
    { key: 'gender', group: 'gender' },
    { key: 'skill', group: 'skill' },
    { key: 'occasion', group: 'occasion' },
    { key: 'shopping', group: 'shopping' },
  ].forEach(({ key, group }) => {
    (state[key] || []).forEach((id) => {
      const item = filterGroups[group].find((entry) => entry.id === id);
      tags.push({ groupKey: key, id, label: item ? item.name[locale] : id });
    });
  });
  if (state.manufacturer) {
    tags.push({
      groupKey: 'manufacturer',
      id: state.manufacturer,
      label: getManufacturerName(state.manufacturer) || state.manufacturer,
    });
  }
  return tags;
}

// ---------------------------------------------------------------------------
// Deterministic product catalog.
// ---------------------------------------------------------------------------
// Existing real products → VELVET placement. Every slug below exists in ./products.js.
const REAL_PRODUCT_ATTRIBUTES = {
  'pocket-worlds-starter-set': { brandId: 'collect', categoryId: 'blind-boxes', subId: 'mini-figures', manufacturer: 'Other', age: '5-6y', gender: 'unisex', skill: 'creativity', occasion: 'gift', shopping: ['new', 'gifts', 'u50'] },
  'odd-pals-plush': { brandId: 'plush', categoryId: 'collectible-plush', subId: 'mini-plush', manufacturer: 'Other', age: '3-4y', gender: 'unisex', skill: 'emotional', occasion: 'birthday', shopping: ['new', 'gifts', 'bestsellers'] },
  'tiny-table-bake-studio': { brandId: 'create', categoryId: 'kids-cooking', subId: 'baking-kits', manufacturer: 'Other', age: '7-9y', gender: 'girls', skill: 'creativity', occasion: 'birthday', shopping: ['new', 'gifts'] },
  'neon-racers-twin-pack': { brandId: 'move', categoryId: 'ride-ons', subId: 'push-cars', manufacturer: 'Other', age: '5-6y', gender: 'boys', skill: 'gross-motor', occasion: 'birthday', shopping: ['new', 'gifts', 'u50'] },
  'bloom-pets-surprise-pod': { brandId: 'collect', categoryId: 'blind-boxes', subId: 'mystery-boxes', manufacturer: 'Other', age: '3-4y', gender: 'unisex', skill: 'creativity', occasion: 'birthday', shopping: ['new', 'u50'] },
  'splash-lab-water-blaster': { brandId: 'move', categoryId: 'water-play', subId: 'water-guns', manufacturer: 'Other', age: '7-9y', gender: 'unisex', skill: 'gross-motor', occasion: 'gift', shopping: ['new', 'u50'] },
  'build-club-maker-kit': { brandId: 'build', categoryId: 'building-blocks', subId: 'classic-blocks', manufacturer: 'Other', age: '7-9y', gender: 'unisex', skill: 'stem', occasion: 'gift', shopping: ['new', 'bestsellers', 'u50'] },
  'cloud-dough-color-pack': { brandId: 'create', categoryId: 'clay-and-modeling', subId: 'play-dough', manufacturer: 'Other', age: '3-4y', gender: 'unisex', skill: 'fine-motor', occasion: 'school', shopping: ['new', 'u50'] },
};

function buildShopping(base, price, hasOffer) {
  const tags = [...(base || [])];
  if (price < 50) tags.push('u50');
  if (price < 100) tags.push('u100');
  if (hasOffer && !tags.includes('offers')) tags.push('offers');
  return [...new Set(tags)];
}

function buildCatalog() {
  // Static fallback keeps only real demo products from products.js.
  // Taxonomy paths come from product_id mapping when present, otherwise from
  // REAL_PRODUCT_ATTRIBUTES. No synthetic/fake products are generated.
  const list = [];
  products.forEach((product) => {
    const attrs = REAL_PRODUCT_ATTRIBUTES[product.slug];
    if (!attrs) return;
    const brand = getBrand(attrs.brandId);
    const category = getCategory(brand?.slug, attrs.categoryId);
    const sub = category?.subs.find((item) => item.slug === attrs.subId);
    if (!brand || !category || !sub) return;
    const shopping = buildShopping(attrs.shopping, product.price, Boolean(product.originalPrice));
    list.push(applyTaxonomyToProduct({
      ...product,
      brandId: brand.slug,
      categoryId: category.slug,
      categorySlug: category.slug,
      subcategoryId: sub.slug,
      manufacturer: attrs.manufacturer,
      manufacturerId: slugify(attrs.manufacturer),
      age: attrs.age,
      gender: attrs.gender,
      skill: attrs.skill,
      occasion: attrs.occasion,
      shopping,
      velvetPath: { brandId: brand.slug, categoryId: category.slug, subcategoryId: sub.slug },
    }));
  });
  return list;
}

export let velvetProducts = buildCatalog();
const STATIC_PRODUCTS = velvetProducts;

// ---------------------------------------------------------------------------
// Lookup helpers.
// ---------------------------------------------------------------------------
export function getBrand(brandSlug) {
  return velvetBrands.find((brand) => brand.slug === brandSlug) || null;
}

// Resolve a brand's hero media. Entity-owned fields (brand.heroVideo /
// brand.heroPoster) are canonical; the legacy `brand.{slug}.video` /
// `brand.{slug}.poster` platform slots and the static config are fallbacks
// only, so the storefront consumes the brand's own media directly.
export function getBrandMedia(brandSlug) {
  const brand = getBrand(brandSlug);
  if (!brand) return { video: '', poster: '' };
  const video = brand.heroVideo || getPlatformMedia(`brand.${brandSlug}.video`, brand.home.heroVideo || '');
  const poster = brand.heroPoster || getPlatformMedia(`brand.${brandSlug}.poster`, brand.home.heroPoster || brand.image || '');
  return { video, poster };
}

function branchLogoArtwork(brand, locale = 'en') {
  const branch = brand.home?.logo?.[locale] || brand.short?.[locale] || '';
  const safeVelvet = 'VELVET'.replace(/&/g, '&amp;');
  const safeBranch = String(branch).replace(/&/g, '&amp;');
  const rtl = locale === 'ar';
  const anchor = rtl ? 'end' : 'start';
  const x = rtl ? 396 : 24;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 88" role="img"><text x="${x}" y="28" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" letter-spacing="0.12em" text-anchor="${anchor}">${safeVelvet}</text><text x="${x}" y="72" fill="#ffffff" font-family="Impact, 'Arial Narrow', sans-serif" font-size="48" font-weight="900" letter-spacing="-0.02em" text-anchor="${anchor}">${safeBranch}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

// Resolve a brand's managed logo image. Entity-owned brand.logoUrl is
// canonical; the legacy `brand.{slug}.logo` platform slot is next; the static
// branch wordmark artwork is the final fallback so logo slots always render an
// image instead of plain text overlays.
export function getBrandLogo(brandSlug, locale = 'en') {
  if (!brandSlug) return '';
  const brand = getBrand(brandSlug);
  if (!brand) return '';
  const managed = brand.logoUrl || getPlatformMedia(`brand.${brandSlug}.logo`, '');
  if (managed) return managed;
  return branchLogoArtwork(brand, locale);
}

function localizedBrandField(value, locale) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  return String(value[locale] || value.en || '').trim();
}

// Brand information for the BrandPage about section. Platform keys
// `brand.{slug}.about.*` override catalog tagline/kicker fallbacks.
export function getBrandAbout(brandSlug, locale = 'en') {
  const brand = getBrand(brandSlug);
  if (!brand) return null;

  const platform = getPlatformBrandAbout(brandSlug);
  const eyebrow = localizedBrandField(platform?.eyebrow, locale);
  const title = localizedBrandField(platform?.title, locale);
  const platformDescription = localizedBrandField(platform?.description, locale);
  const catalogDescription = localizedBrandField(brand.about, locale)
    || localizedBrandField(brand.description, locale);
  const kicker = localizedBrandField(
    locale === 'ar' ? brand.home?.kickerAr : brand.home?.kickerEn,
    locale,
  );
  const tagline = localizedBrandField(brand.tagline, locale);
  const description = platformDescription
    || catalogDescription
    || [tagline, kicker].filter(Boolean).join(' — ')
    || tagline
    || kicker;

  if (!description && !title) return null;

  const defaultTitle = locale === 'ar'
    ? `عن ${brand.name[locale]}`
    : `About ${brand.name[locale]}`;

  return {
    eyebrow,
    title: title || defaultTitle,
    description,
  };
}

export function getCategory(brandSlug, categorySlug) {
  return getBrand(brandSlug)?.categories.find((category) => category.slug === categorySlug) || null;
}

export function getSubcategory(brandSlug, categorySlug, subSlug) {
  return getCategory(brandSlug, categorySlug)?.subs.find((sub) => sub.slug === subSlug) || null;
}

export function findCategoryBySlug(categorySlug, brandSlug = '') {
  if (brandSlug) return getCategory(brandSlug, categorySlug);
  for (const brand of velvetBrands) {
    const category = getCategory(brand.slug, categorySlug);
    if (category) return category;
  }
  return null;
}

export function findSubcategoryBySlug(categorySlug, subSlug, brandSlug = '') {
  if (brandSlug) return getSubcategory(brandSlug, categorySlug, subSlug);
  const category = findCategoryBySlug(categorySlug);
  return category?.subs.find((sub) => sub.slug === subSlug) || null;
}

export function getShopHierarchyOptions(state = {}) {
  const brands = velvetBrands.map((brand) => ({ id: brand.slug, name: brand.name }));
  const rawCategories = state.brand
    ? (getBrand(state.brand)?.categories || [])
    : velvetBrands.flatMap((brand) => brand.categories || []);
  const seen = new Set();
  const categories = rawCategories.filter((category) => {
    if (seen.has(category.slug)) return false;
    seen.add(category.slug);
    return true;
  }).map((category) => ({ id: category.slug, name: category.name }));
  const parent = state.category
    ? (state.brand ? getCategory(state.brand, state.category) : findCategoryBySlug(state.category))
    : null;
  const subcategories = (parent?.subs || []).map((sub) => ({ id: sub.slug, name: sub.name }));
  return { brands, categories, subcategories };
}

export function resolvePath(state) {
  const brand = state.brand ? getBrand(state.brand) : null;
  const category = brand && state.category ? getCategory(brand.slug, state.category) : null;
  const sub = category && state.subcategory ? getSubcategory(brand.slug, category.slug, state.subcategory) : null;
  return { brand, category, sub };
}

export function getManufacturerName(manufacturerId) {
  return velvetProducts.find((product) => product.manufacturerId === manufacturerId)?.manufacturer || '';
}

export function getVelvetPathLabel(product, locale = 'en') {
  const path = product?.velvetPath;
  if (!path) return '';
  const sub = getSubcategory(path.brandId, path.categoryId, path.subcategoryId);
  if (sub) return sub.name[locale];
  const category = getCategory(path.brandId, path.categoryId);
  if (category) return category.name[locale];
  return getBrand(path.brandId)?.name[locale] || '';
}

export function getProductBySlug(slug) {
  const catalogProduct = velvetProducts.find((product) => product.slug === slug) || null;
  if (dynamicCatalogMode) return catalogProduct;
  return catalogProduct || products.find((product) => product.slug === slug) || null;
}

// Resolve a product's "how to use" media. The product's entity-owned
// usageVideo / usageVideoPoster fields are canonical; the legacy
// `product.{slug}.usageVideo(/Poster)` platform slots are a fallback only
// (empty → section hidden).
export function getProductMedia(product) {
  const slug = product?.slug || '';
  const usageVideo = product?.usageVideo || getPlatformMedia(`product.${slug}.usageVideo`, '');
  const usageVideoPoster = product?.usageVideoPoster || getPlatformMedia(`product.${slug}.usageVideoPoster`, product?.gallery?.[0] || product?.image || '');
  return { usageVideo, usageVideoPoster };
}

/**
 * Resolve ProductDetails hero media from the product's browsing context.
 * Priority: Subcategory media → Main Category media → clean empty fallback.
 * Title follows whichever media source is used.
 */
export function getPathHeroMedia(product) {
  const path = product?.velvetPath;
  if (!path?.brandId || !path?.categoryId) {
    return { image: '', video: '', name: null, source: null };
  }
  const category = getCategory(path.brandId, path.categoryId);
  const subcategory = path.subcategoryId ? getSubcategory(path.brandId, path.categoryId, path.subcategoryId) : null;

  const subImage = subcategory?.image || '';
  const subVideo = subcategory?.heroVideo || '';
  if (subImage || subVideo) {
    return { image: subImage, video: subVideo, name: subcategory.name, source: 'subcategory' };
  }

  const categoryImage = category?.heroImage || '';
  const categoryVideo = category?.heroVideo || '';
  if (categoryImage || categoryVideo) {
    return { image: categoryImage, video: categoryVideo, name: category.name, source: 'category' };
  }

  return {
    image: '',
    video: '',
    name: subcategory?.name || category?.name || null,
    source: null,
  };
}

// ---------------------------------------------------------------------------
// Filtering (deterministic).
// Path (brand + category + subcategory) is ANDed with every filter group.
// Within a group selections behave as OR.
// ---------------------------------------------------------------------------
export function getPathProducts(state) {
  return velvetProducts.filter((product) => {
    if (state.brand && product.velvetPath?.brandId !== state.brand) return false;
    if (state.category && product.velvetPath?.categoryId !== state.category) return false;
    if (state.subcategory && product.velvetPath?.subcategoryId !== state.subcategory) return false;
    return true;
  });
}

export function sortProducts(products, sort = '', locale = 'en') {
  const list = [...(products || [])];
  if (sort === 'price-asc') return list.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  if (sort === 'price-desc') return list.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
  if (sort === 'newest') return list.sort((a, b) => Number(b.sortOrder || 0) - Number(a.sortOrder || 0));
  if (sort === 'name') {
    return list.sort((a, b) => {
      const left = locale === 'ar' ? (a.nameAr || a.name || '') : (a.name || '');
      const right = locale === 'ar' ? (b.nameAr || b.name || '') : (b.name || '');
      return String(left).localeCompare(String(right), locale === 'ar' ? 'ar' : 'en');
    });
  }
  return list;
}

export function filterProducts(state) {
  const normalized = String(state.search || '').trim().toLowerCase();
  return velvetProducts.filter((product) => {
    if (state.brand && product.velvetPath?.brandId !== state.brand) return false;
    if (state.category && product.velvetPath?.categoryId !== state.category) return false;
    if (state.subcategory && product.velvetPath?.subcategoryId !== state.subcategory) return false;
    if (state.manufacturer && product.manufacturerId !== state.manufacturer) return false;
    if (state.age.length && !state.age.includes(product.age)) return false;
    if (state.gender.length && !state.gender.includes(product.gender)) return false;
    if (state.skill.length && !state.skill.includes(product.skill)) return false;
    if (state.occasion.length && !state.occasion.includes(product.occasion)) return false;
    if (state.shopping.length && !state.shopping.some((tag) => product.shopping.includes(tag))) return false;
    if (normalized) {
      const haystack = `${product.name} ${product.nameAr || ''} ${product.description} ${product.descriptionAr || ''} ${product.category || ''}`.toLowerCase();
      if (!haystack.includes(normalized)) return false;
    }
    return true;
  });
}

export function getManufacturersForPath(state) {
  const pathProducts = getPathProducts(state);
  const counts = new Map();
  pathProducts.forEach((product) => {
    if (!product.manufacturer) return;
    counts.set(product.manufacturerId, (counts.get(product.manufacturerId) || 0) + 1);
  });
  return [...counts.entries()].map(([id, count]) => ({
    id,
    name: pathProducts.find((product) => product.manufacturerId === id)?.manufacturer || id,
    count,
  }));
}

export function getFilterCounts(state) {
  const pathProducts = getPathProducts(state);
  const counts = { age: {}, gender: {}, skill: {}, occasion: {}, shopping: {} };
  pathProducts.forEach((product) => {
    if (product.age) counts.age[product.age] = (counts.age[product.age] || 0) + 1;
    if (product.gender) counts.gender[product.gender] = (counts.gender[product.gender] || 0) + 1;
    if (product.skill) counts.skill[product.skill] = (counts.skill[product.skill] || 0) + 1;
    if (product.occasion) counts.occasion[product.occasion] = (counts.occasion[product.occasion] || 0) + 1;
    (product.shopping || []).forEach((tag) => {
      counts.shopping[tag] = (counts.shopping[tag] || 0) + 1;
    });
  });
  return counts;
}
