/**
 * Authoritative checkout order totals.
 *
 * The storefront renders every line as (unit price × quantity), so the only
 * subtotal allowed to feed the order summary and the WhatsApp message is
 * sum(unitPrice * quantity) over the submitted cart lines.
 *
 * Server-returned money is still preferred when it exists AND agrees with
 * those submitted lines: the backend owns the delivery fee (and may recompute
 * money server-side), so `delivery_price` from the created order is
 * authoritative. A returned subtotal/total that disagrees with the submitted
 * lines is stale (old quantity, old price, or a pre-update cart) and must be
 * rejected — otherwise checkout UI, saved order, and WhatsApp can diverge
 * (e.g. ₪75 instead of ₪90 for 5 × ₪18).
 */

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function toMoney(value) {
  if (value == null || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? roundMoney(amount) : null;
}

function nearlyEqual(a, b) {
  return Math.abs(a - b) < 0.005;
}

function isPricedLine(item) {
  const unitPrice = Number(item?.price);
  const quantity = Number(item?.quantity);
  return Number.isFinite(unitPrice) && unitPrice > 0
    && Number.isFinite(quantity) && quantity > 0;
}

/** One authoritative subtotal: sum(unitPrice * quantity) over cart items. */
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
 * - subtotal: the server subtotal when present and consistent with the
 *   submitted line math, otherwise sum(unitPrice * quantity). Never a stale
 *   value, and never recomputed from pre-update cart state.
 * - deliveryFee: the server-authoritative fee from the created order when
 *   present, otherwise the selected delivery zone fee.
 * - finalTotal: the server total when present and equal to subtotal + fee,
 *   otherwise subtotal + deliveryFee.
 */
export function resolveOrderTotals({ items = [], order = null, fallbackDeliveryFee = 0 } = {}) {
  const list = Array.isArray(items) ? items : [];
  const hasSubmittedLines = list.some(isPricedLine);
  const clientSubtotal = computeOrderSubtotal(list);
  const serverSubtotal = toMoney(order?.subtotal);
  const serverFee = toMoney(order?.delivery_price ?? order?.deliveryFee);
  const serverTotal = toMoney(order?.total);
  const fallbackFee = toMoney(fallbackDeliveryFee);

  const subtotal = serverSubtotal != null
    && (nearlyEqual(serverSubtotal, clientSubtotal) || !hasSubmittedLines)
    ? serverSubtotal
    : clientSubtotal;

  const deliveryFee = serverFee != null && serverFee >= 0
    ? serverFee
    : (fallbackFee != null && fallbackFee >= 0 ? fallbackFee : 0);

  const derivedTotal = roundMoney(subtotal + deliveryFee);
  const finalTotal = serverTotal != null && nearlyEqual(serverTotal, derivedTotal)
    ? serverTotal
    : derivedTotal;

  return { subtotal, deliveryFee, finalTotal };
}
