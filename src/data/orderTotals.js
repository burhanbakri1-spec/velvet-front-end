/**
 * Authoritative checkout order totals.
 *
 * POST /api/orders owns the money. The created order response is the single
 * source of truth for `subtotal`, `delivery_price`, and `total`: the backend
 * re-prices cart lines against the live catalog and applies the delivery fee
 * itself (e.g. velvet-src-104 at ₪15 × 5 → 75 + 20 → 95).
 *
 * Client cart lines are only a fallback used when no order was returned
 * (API not configured / local preview). They are never allowed to override a
 * returned server value — a cart snapshot can carry stale unit prices and
 * would silently rewrite the saved order's totals in the WhatsApp message.
 */

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function toMoney(value) {
  if (value == null || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? roundMoney(amount) : null;
}

/** Fallback subtotal: sum(unitPrice * quantity) over the cart lines. */
export function computeOrderSubtotal(items = []) {
  const list = Array.isArray(items) ? items : [];
  const subtotal = list.reduce((sum, item) => {
    const unitPrice = Number(item?.price);
    const quantity = Number(item?.quantity);
    const safePrice = Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0;
    const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
    return sum + safePrice * safeQuantity;
  }, 0);
  return roundMoney(subtotal);
}

/**
 * Resolve the totals used by the order success state and the WhatsApp message.
 *
 * - subtotal: `order.subtotal` from the created order when present, otherwise
 *   sum(unitPrice * quantity) over the submitted cart lines.
 * - deliveryFee: `order.delivery_price` from the created order when present,
 *   otherwise the selected delivery zone fee.
 * - finalTotal: `order.total` from the created order when present, otherwise
 *   subtotal + deliveryFee.
 *
 * Server values are used verbatim — they are never re-derived from, or
 * rejected against, client cart math.
 */
export function resolveOrderTotals({ items = [], order = null, fallbackDeliveryFee = 0 } = {}) {
  const serverSubtotal = toMoney(order?.subtotal);
  const serverFee = toMoney(order?.delivery_price ?? order?.deliveryFee);
  const serverTotal = toMoney(order?.total);
  const fallbackFee = toMoney(fallbackDeliveryFee);

  const subtotal = serverSubtotal ?? computeOrderSubtotal(items);
  const deliveryFee = serverFee != null && serverFee >= 0
    ? serverFee
    : (fallbackFee != null && fallbackFee >= 0 ? fallbackFee : 0);
  const finalTotal = serverTotal ?? roundMoney(subtotal + deliveryFee);

  return { subtotal, deliveryFee, finalTotal };
}
