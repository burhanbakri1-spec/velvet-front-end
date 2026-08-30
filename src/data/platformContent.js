import { aboutSections, newsCategories, newsItems } from './company.js';
import { homeCategories, productCategories, products } from './products.js';
import { buildDynamicCatalog } from './dynamicCatalog.js';
import { applyDynamicCatalog } from './velvetCatalog.js';
import { applyVlogContent } from './vlogs.js';
import { translations } from '../i18n/translations.js';

const websiteMedia = new Map();
const brandAboutContent = new Map();

export const getPlatformMedia = (key, fallback = '') => websiteMedia.get(key) || fallback;

export function getPlatformBrandAbout(brandSlug) {
  return brandAboutContent.get(brandSlug) || null;
}

function ensureBrandAboutEntry(brandSlug) {
  if (!brandAboutContent.has(brandSlug)) {
    brandAboutContent.set(brandSlug, {
      eyebrow: { en: '', ar: '' },
      title: { en: '', ar: '' },
      description: { en: '', ar: '' },
    });
  }
  return brandAboutContent.get(brandSlug);
}

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

function mapLegacyVlogMediaItem(item, apiUrl) {
  const key = String(item.sectionKey || '');
  const imageUrl = absoluteUrl(item.image || item.fallbackImage, apiUrl);
  const videoUrl = absoluteUrl(item.video, apiUrl);
  const videoMatch = key.match(/^vlog\.video\.(.+)$/);
  const postMatch = key.match(/^vlog\.post\.(.+)$/);
  if (videoMatch && (videoUrl || imageUrl)) {
    return {
      kind: 'video',
      entry: {
        id: videoMatch[1],
        slug: videoMatch[1],
        title: item.title?.en || item.label || '',
        titleAr: item.title?.ar || item.title?.en || item.label || '',
        body: item.description?.en || '',
        bodyAr: item.description?.ar || item.description?.en || '',
        category: item.groupKey || '',
        categoryAr: item.groupKey || '',
        video: videoUrl,
        poster: imageUrl,
      },
    };
  }
  if (postMatch && (imageUrl || item.title)) {
    return {
      kind: 'post',
      entry: {
        id: postMatch[1],
        slug: postMatch[1],
        title: item.title?.en || item.label || '',
        titleAr: item.title?.ar || item.title?.en || item.label || '',
        body: item.description?.en || '',
        bodyAr: item.description?.ar || item.description?.en || '',
        category: item.groupKey || '',
        categoryAr: item.groupKey || '',
        image: imageUrl,
      },
    };
  }
  return null;
}

function mapPlatformVlogItem(item, apiUrl) {
  const titleSource = item.title || item.name || {};
  const descSource = item.description || item.body || item.shortDescription || {};
  const mediaType = String(item.mediaType || item.type || '').toLowerCase();
  const video = absoluteUrl(item.videoUrl || item.video, apiUrl);
  const poster = absoluteUrl(item.posterUrl || item.poster, apiUrl);
  const image = absoluteUrl(item.imageUrl || item.image || item.thumbnail || item.coverImage, apiUrl);
  const linkRaw = item.link || item.url || '';
  const link = linkRaw ? (absoluteUrl(linkRaw, apiUrl) || linkRaw) : '';
  return {
    id: String(item.id || item.slug || ''),
    slug: String(item.slug || item.id || ''),
    mediaType,
    title: localized(titleSource, 'en'),
    titleAr: localized(titleSource, 'ar'),
    body: localized(descSource, 'en'),
    bodyAr: localized(descSource, 'ar'),
    category: localized(item.category, 'en') || String(item.groupKey || item.categoryKey || ''),
    categoryAr: localized(item.category, 'ar') || String(item.groupKey || item.categoryKey || ''),
    video,
    poster: poster || (video ? image : ''),
    image: image || poster,
    link,
  };
}

function partitionPlatformVlogs(items, apiUrl) {
  const videos = [];
  const posts = [];
  for (const item of items) {
    if (item.isActive === false) continue;
    const mapped = mapPlatformVlogItem(item, apiUrl);
    const kind = mapped.mediaType || String(item.type || item.mediaType || '').toLowerCase();
    if (kind === 'image' || kind === 'post' || kind === 'story') posts.push(mapped);
    else if (kind === 'video') videos.push(mapped);
    else if (mapped.video) videos.push(mapped);
    else if (mapped.image || mapped.title) posts.push(mapped);
  }
  return { videos, posts };
}

function resolveVlogPayload(payload) {
  const nested = payload?.content && typeof payload.content === 'object' ? payload.content : null;
  return {
    vlogs: Array.isArray(payload?.vlogs) ? payload.vlogs : (Array.isArray(nested?.vlogs) ? nested.vlogs : null),
    vlogHero: payload?.vlogHero || nested?.vlogHero || null,
  };
}

function applyVlogHero(hero, apiUrl) {
  if (!hero || typeof hero !== 'object') return;
  const video = absoluteUrl(hero.videoUrl || hero.video || hero.heroVideo, apiUrl);
  const poster = absoluteUrl(hero.posterUrl || hero.poster || hero.image || hero.heroPoster, apiUrl);
  if (video) websiteMedia.set('vlogs.hero.video', video);
  if (poster) websiteMedia.set('vlogs.hero.poster', poster);
}

function applyVlogData(payload, apiUrl) {
  const { vlogs, vlogHero } = resolveVlogPayload(payload);
  let videos = [];
  let posts = [];

  if (Array.isArray(vlogs)) {
    ({ videos, posts } = partitionPlatformVlogs(vlogs, apiUrl));
  } else {
    for (const item of payload.media || []) {
      const mapped = mapLegacyVlogMediaItem(item, apiUrl);
      if (mapped?.kind === 'video') videos.push(mapped.entry);
      if (mapped?.kind === 'post') posts.push(mapped.entry);
    }
  }

  applyVlogContent({ videos, posts });
  applyVlogHero(vlogHero, apiUrl);
}

function applyStructuredContent(payload, apiUrl) {
  for (const item of payload.texts || []) {
    if (item.key.startsWith('copy.')) {
      setTranslation('en', item.key, item.values?.en || '');
      setTranslation('ar', item.key, item.values?.ar || item.values?.en || '');
      continue;
    }
    const brandAboutMatch = item.key.match(/^brand\.([^.]+)\.about\.(eyebrow|title|description)$/);
    if (brandAboutMatch) {
      const entry = ensureBrandAboutEntry(brandAboutMatch[1]);
      entry[brandAboutMatch[2]].en = item.values?.en || '';
      entry[brandAboutMatch[2]].ar = item.values?.ar || item.values?.en || '';
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
      continue;
    }
    const newsMatch = item.key.match(/^news\.(\d+)\.(title|category|date)$/);
    if (newsMatch && newsItems[Number(newsMatch[1])]) {
      const itemIndex = Number(newsMatch[1]);
      const field = newsMatch[2];
      const entry = newsItems[itemIndex];
      if (field === 'title') {
        entry.title = item.values?.en || entry.title;
        entry.titleAr = item.values?.ar || item.values?.en || entry.titleAr;
      } else if (field === 'category') {
        entry.category = item.values?.en || entry.category;
        entry.categoryAr = item.values?.ar || item.values?.en || entry.categoryAr;
      } else if (field === 'date' && (item.values?.en || item.values?.ar)) {
        entry.date = item.values?.en || item.values?.ar;
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

  applyVlogData(payload, apiUrl);
}

export function applyPlatformContent(payload, apiUrl) {
  if (!payload?.site || !Array.isArray(payload.categories) || !Array.isArray(payload.products)) throw new Error('The platform content response is invalid.');
  websiteMedia.clear();
  brandAboutContent.clear();
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
