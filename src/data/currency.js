/** Customer-facing storefront currency symbol (display only — no conversion). */
export const STOREFRONT_CURRENCY_SYMBOL = '₪';

/**
 * Format a numeric price for customer-facing UI and WhatsApp order text.
 * Does not convert or alter the underlying amount — symbol swap only.
 */
export function formatPrice(value) {
  const amount = Number(value);
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${STOREFRONT_CURRENCY_SYMBOL}${safe.toFixed(2)}`;
}
