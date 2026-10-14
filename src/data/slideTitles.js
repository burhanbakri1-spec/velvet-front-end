import { canonicalProductNames, resolveProductImages } from './products.js';

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

function normalizedTitle(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

/**
 * Ordered title slider, independent of gallery images.
 * Arabic canonical, then English canonical, then slideTitles by sortOrder.
 * Exact normalized text is kept once. galleryImageId is ignored.
 */
export function buildProductTitleSequence(product) {
  const seen = new Set();
  const sequence = [];
  const push = (value) => {
    const title = normalizedTitle(value);
    if (!title || seen.has(title)) return;
    seen.add(title);
    sequence.push(title);
  };
  const names = canonicalProductNames(product);
  push(names.ar);
  push(names.en);
  normalizeEntries(product?.slideTitles).sort(byOrder).forEach((entry) => push(entry.title));
  return sequence;
}

/** Title index wraps on its own length. A single title stays put. */
export function stepTitleIndex(index, count, direction) {
  const total = Number(count) || 0;
  if (total <= 1) return 0;
  const current = ((Number(index) || 0) % total + total) % total;
  const step = direction === 'previous' ? -1 : 1;
  return (current + step + total) % total;
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
