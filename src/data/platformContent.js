import { aboutSections, newsCategories, newsItems } from './company.js';
import { homeCategories, productCategories, products } from './products.js';
import { buildDynamicCatalog } from './dynamicCatalog.js';
import { applyDynamicCatalog } from './velvetCatalog.js';
import { translations } from '../i18n/translations.js';

const websiteMedia = new Map();
export const getPlatformMedia = (key, fallback = '') => websiteMedia.get(key) || fallback;

export const platformContentConfig = (env = import.meta.env || {}) => ({
  enabled: String(env.VITE_IGROUP_CONTENT_ENABLED || '').toLowerCase() === 'true',
  apiUrl: String(env.VITE_IGROUP_API_URL || '').replace(/\/$/, ''),
  companyId: String(env.VITE_IGROUP_COMPANY_ID || ''),
  siteId: String(env.VITE_IGROUP_SITE_ID || ''),
});

const absoluteUrl = (value, apiUrl) => {
  if (!value) return '';
  try { return new URL(value, `${apiUrl}/`).toString(); } catch { return ''; }
};

const localized = (value, locale, fallback = '') => String(value?.[locale] ?? value?.en ?? fallback);

export function mapPlatformCategory(category, apiUrl, heroVideos = {}) {
  return {
    id: category.id,
    slug: category.slug,
    nameEn: localized(category.name, 'en'),
    nameAr: localized(category.name, 'ar'),
    name: { en: localized(category.name, 'en'), ar: localized(category.name, 'ar') },
    descriptionEn: localized(category.description, 'en'),
    descriptionAr: localized(category.description, 'ar'),
    heroImage: absoluteUrl(category.image, apiUrl),
    heroVideo: absoluteUrl(category.heroVideo || heroVideos[category.slug], apiUrl),
    sortOrder: Number(category.sortOrder || 0),
  };
}

export function mapPlatformProduct(product, categories, apiUrl) {
  const category = categories.find((item) => item.id === product.categoryId);
  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    name: localized(product.name, 'en'),
    nameAr: localized(product.name, 'ar'),
    category: category?.nameEn || '',
    categoryId: product.categoryId,
    categorySlug: category?.slug || '',
    price: Number(product.price || 0),
    originalPrice: product.originalPrice == null ? null : Number(product.originalPrice),
    shortDescription: localized(product.shortDescription, 'en'),
    shortDescriptionAr: localized(product.shortDescription, 'ar'),
    description: localized(product.description, 'en'),
    descriptionAr: localized(product.description, 'ar'),
    badge: localized(product.badge, 'en'),
    badgeAr: localized(product.badge, 'ar'),
    availability: localized(product.availability, 'en', 'In stock'),
    availabilityAr: localized(product.availability, 'ar', 'متوفر'),
    image: absoluteUrl(product.image, apiUrl),
    hoverImage: absoluteUrl(product.hoverImage || product.image, apiUrl),
    gallery: (product.gallery || []).map((url) => absoluteUrl(url, apiUrl)).filter(Boolean),
    usageVideo: absoluteUrl(product.usageVideo, apiUrl),
    usageVideoPoster: absoluteUrl(product.usageVideoPoster, apiUrl),
    options: (product.options || []).map((option) => ({
      name: localized(option.name, 'en'),
      nameAr: localized(option.name, 'ar'),
      values: (option.values || []).map((value) => ({
        label: localized(value.label, 'en'),
        labelAr: localized(value.label, 'ar'),
        color: value.color || '',
        priceDelta: Number(value.priceDelta || 0),
        image: absoluteUrl(value.image, apiUrl),
      })),
    })),
    featured: product.featured === true,
    sortOrder: Number(product.sortOrder || 0),
  };
}

function setTranslation(locale, key, value) {
  const path = key.replace(/^copy\./, '').split('.').filter(Boolean);
  if (!path.length) return;
  let target = translations[locale];
  for (const part of path.slice(0, -1)) {
    if (!target?.[part] || typeof target[part] !== 'object') return;
    target = target[part];
  }
  const leaf = path.at(-1);
  if (Object.prototype.hasOwnProperty.call(target || {}, leaf)) target[leaf] = value;
}

function applyStructuredContent(payload, apiUrl) {
  for (const item of payload.texts || []) {
    if (item.key.startsWith('copy.')) {
      setTranslation('en', item.key, item.values?.en || '');
      setTranslation('ar', item.key, item.values?.ar || item.values?.en || '');
      continue;
    }
    const aboutMatch = item.key.match(/^about\.(\d+)\.(title|eyebrow|paragraph1|paragraph2)$/);
    if (aboutMatch && aboutSections[Number(aboutMatch[1])]) {
      const section = aboutSections[Number(aboutMatch[1])];
      const field = aboutMatch[2];
      if (field.startsWith('paragraph')) {
        const index = Number(field.slice(-1)) - 1;
        section.paragraphs[index] = item.values?.en || '';
        section.paragraphsAr[index] = item.values?.ar || item.values?.en || '';
      } else {
        section[field] = item.values?.en || '';
        section[`${field}Ar`] = item.values?.ar || item.values?.en || '';
      }
    }
  }
  for (const item of payload.media || []) {
    const key = String(item.sectionKey || '');
    const imageUrl = absoluteUrl(item.image || item.fallbackImage, apiUrl);
    const videoUrl = absoluteUrl(item.video, apiUrl);
    if (imageUrl) websiteMedia.set(key, imageUrl);
    if (videoUrl) websiteMedia.set(key.endsWith('.video') ? key : `${key}.video`, videoUrl);
    const productUsageVideo = key.match(/^product\.([^.]+)\.usageVideo$/);
    if (productUsageVideo && videoUrl) websiteMedia.set(`product.${productUsageVideo[1]}.usageVideo`, videoUrl);
    const aboutMatch = key.match(/^about\.(\d+)\.image$/);
    const newsMatch = key.match(/^news\.(\d+)\.image$/);
    if (aboutMatch && aboutSections[Number(aboutMatch[1])] && imageUrl) aboutSections[Number(aboutMatch[1])].image = imageUrl;
    if (newsMatch && newsItems[Number(newsMatch[1])] && imageUrl) newsItems[Number(newsMatch[1])].image = imageUrl;
  }
}

export function applyPlatformContent(payload, apiUrl) {
  if (!payload?.site || !Array.isArray(payload.categories) || !Array.isArray(payload.products)) throw new Error('The platform content response is invalid.');
  websiteMedia.clear();
  const heroVideos = {};
  for (const item of payload.media || []) {
    const match = String(item.sectionKey || '').match(/^category\.([^.]+)\.heroVideo$/);
    if (match && item.video) heroVideos[match[1]] = item.video;
  }
  const categories = payload.categories.map((item) => mapPlatformCategory(item, apiUrl, heroVideos)).sort((a, b) => a.sortOrder - b.sortOrder);
  const all = { id: 'all', slug: 'all', nameEn: 'All Products', nameAr: 'كل المنتجات', name: { en: 'All Products', ar: 'كل المنتجات' } };
  const mappedProducts = payload.products.map((item) => mapPlatformProduct(item, categories, apiUrl)).sort((a, b) => a.sortOrder - b.sortOrder);
  productCategories.splice(0, productCategories.length, all, ...categories);
  products.splice(0, products.length, ...mappedProducts);
  homeCategories.splice(0, homeCategories.length, ...categories.slice(0, 5).map((category, index) => ({
    ...category,
    home: { order: index + 1, kickerEn: category.descriptionEn, kickerAr: category.descriptionAr, palette: ['#ff7c28', '#ffcf45', '#8f281d'], scene: 'mini' },
  })));
  // The dynamic VELVET hierarchy (Brand → Main Category → Subcategory →
  // Products) is the canonical catalog when the payload carries brand entities.
  // Without brands the storefront keeps its static VELVET catalog as fallback.
  const dynamic = buildDynamicCatalog(payload, apiUrl);
  applyDynamicCatalog(dynamic?.brands || null, dynamic?.products || null);
  applyStructuredContent(payload, apiUrl);
  newsCategories.splice(0, newsCategories.length, { id: 'all', en: 'All', ar: 'الكل' }, ...[...new Set(newsItems.map((item) => item.category))].map((category) => {
    const item = newsItems.find((entry) => entry.category === category);
    return { id: category.toLowerCase().replace(/\s+/g, '-'), en: category, ar: item.categoryAr };
  }));
  return payload.site;
}

export async function bootstrapPlatformContent({ env = import.meta.env || {}, locale } = {}) {
  const config = platformContentConfig(env);
  if (!config.enabled) return { enabled: false, site: null };
  if (!config.apiUrl || !config.companyId || !config.siteId) throw new Error('Platform content integration is enabled but its tenant configuration is incomplete.');
  const selectedLocale = locale || window.localStorage.getItem('play-language') || 'ar';
  const response = await fetch(`${config.apiUrl}/api/storefront/content?locale=${encodeURIComponent(selectedLocale)}`, {
    headers: { 'X-Company-Id': config.companyId, 'X-Site-Id': config.siteId },
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.message || `Platform content request failed (${response.status}).`);
  }
  const payload = await response.json();
  if (payload.site?.companyId !== config.companyId || payload.site?.id !== config.siteId) throw new Error('The platform returned content for a different tenant or site.');
  return { enabled: true, site: applyPlatformContent(payload, config.apiUrl) };
}
