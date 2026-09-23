function localizeProductPath(slug, locale) {
  const base = `/products/${slug}`;
  if (!locale || locale === 'en') return `/en${base}`;
  return `/${locale}${base}`;
}

export function buildProductUrl(slug, locale) {
  if (typeof window === 'undefined' || !slug) return '';
  const path = localizeProductPath(slug, locale || 'ar');
  return `${window.location.origin}${path}`;
}

export function buildQrImageUrl(productUrl) {
  if (!productUrl) return '';
  return `https://api.qrserver.com/v1/create-qr-code/?size=148x148&margin=8&data=${encodeURIComponent(productUrl)}`;
}
