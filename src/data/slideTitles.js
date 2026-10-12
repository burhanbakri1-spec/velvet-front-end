import { getProductName, resolveProductImages } from './products.js';

function normalizeEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => ({
      title: String(entry?.title || '').trim(),
      language: String(entry?.language || ''),
      galleryImageId: String(entry?.galleryImageId || ''),
      sortOrder: Number(entry?.sortOrder ?? 0) || 0,
    }))
    .filter((entry) => entry.title);
}

function byOrder(left, right) {
  return left.sortOrder - right.sortOrder;
}

/**
 * One title for the active gallery image.
 * Saved slide titles win by galleryImageId, then locale-aware fallbacks,
 * then the localized canonical product name. Titles are never joined.
 */
export function resolveSlideTitle({ product, galleryImageId, locale = 'en' } = {}) {
  const id = String(galleryImageId || '');
  if (id) {
    const explicit = normalizeEntries(product?.slideTitles)
      .filter((entry) => entry.galleryImageId === id)
      .sort(byOrder);
    if (explicit.length) return explicit[0].title;

    const fallbacks = normalizeEntries(product?.slideTitleFallbacks)
      .filter((entry) => entry.galleryImageId === id)
      .sort(byOrder);
    const fallback = fallbacks.find((entry) => entry.language === locale)
      || fallbacks.find((entry) => entry.language === 'en')
      || fallbacks[0];
    if (fallback) return fallback.title;
  }
  return getProductName(product, locale);
}

/** Gallery slides in the same order as the image list, keeping a stable id when the API sent one. */
export function resolveProductSlides(product, selections = {}) {
  const urls = resolveProductImages(product, selections);
  const ids = new Map();
  (Array.isArray(product?.galleryItems) ? product.galleryItems : []).forEach((item) => {
    const url = String(item?.url || '').trim();
    if (url && !ids.has(url)) ids.set(url, String(item.id || ''));
  });
  return urls.map((src) => ({ id: ids.get(src) || '', src }));
}

/** Thumbnail and arrow movement share one direction: later index is next, earlier index is previous. */
export function gallerySlideDirection(fromIndex, toIndex) {
  return Number(toIndex) >= Number(fromIndex) ? 'next' : 'previous';
}
