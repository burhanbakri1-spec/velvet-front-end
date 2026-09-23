/**
 * Customer orders API for the VELVET storefront.
 *
 * Verified staging contract:
 * - POST /api/orders (tenant headers; Bearer optional — guest checkout allowed)
 *   Body: { customer: { name, phone, email?, city, address, notes? },
 *           items: [{ productId, variantId, quantity }] }
 *   → 201 { id, orderNumber (e.g. ORD-…), status (e.g. Pending) }
 * - GET /api/orders/my-orders (Bearer + X-Company-Id/X-Site-Id) → 200 array of
 *   the authenticated customer's orders. A newly created authenticated order
 *   appears there immediately. This is the ONLY list endpoint for customers;
 *   GET /api/orders returns 403 for customer tokens and must not be used for
 *   "My Orders".
 *
 * Order snapshots (persistOrderSnapshot / getOrderSnapshots) are an OPTIONAL
 * short-lived UI cache written right after a successful create. They are never
 * the list shown when server history is available and never a replacement when
 * the server fails — "My Orders" always re-fetches /api/orders/my-orders and
 * shows an error instead of pretending snapshots are history.
 */

import { parseJsonResponse, readErrorDetail, storefrontFetch } from './apiClient.js';

const ORDER_SNAPSHOT_KEY = 'velvet-order-snapshots-v1';

/**
 * Build the exact order payload the staging API accepts. Cart items already
 * carry productId + variantId; variantId is included only when present
 * (products without variants must not send an empty variant id).
 */
export function buildOrderPayload({ customer = {}, items = [] } = {}) {
  return {
    customer: {
      name: String(customer.name || '').trim(),
      phone: String(customer.phone || '').trim(),
      email: String(customer.email || '').trim() || undefined,
      city: String(customer.city || '').trim(),
      address: String(customer.address || '').trim(),
      notes: String(customer.notes || '').trim() || undefined,
    },
    items: (Array.isArray(items) ? items : [])
      .map((item) => ({
        productId: String(item.productId ?? ''),
        variantId: item.variantId ? String(item.variantId) : undefined,
        quantity: Math.max(1, Number(item.quantity) || 1),
      }))
      .filter((item) => item.productId),
  };
}

/** Create a real order. Guest checkout is allowed (no token). */
export async function createOrder(payload, { token } = {}) {
  const response = await storefrontFetch('/api/orders', { method: 'POST', body: payload, token });
  if (!response.ok) {
    const detail = await readErrorDetail(response);
    return {
      ok: false,
      status: response.status,
      message: detail || 'Unable to place your order.',
    };
  }
  const order = await parseJsonResponse(response);
  return { ok: true, order: order || null };
}

function readSnapshots() {
  try {
    if (typeof window === 'undefined') return [];
    const value = JSON.parse(window.localStorage.getItem(ORDER_SNAPSHOT_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeSnapshots(snapshots) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ORDER_SNAPSHOT_KEY, JSON.stringify(snapshots));
  } catch {
    /* Storage may be unavailable. */
  }
}

/**
 * Optional short-lived UI cache: persist a successful order snapshot for a
 * logged-in customer right after create so the UI can show it until the next
 * /api/orders/my-orders fetch completes. Snapshots are keyed by customer id,
 * are NOT server history, and must never be presented as such.
 */
export function persistOrderSnapshot(order, customer) {
  const customerId = String(customer?.id || customer?.email || '');
  if (!customerId || !order) return;
  const snapshots = readSnapshots();
  const entry = {
    id: String(order.id || order.orderNumber || ''),
    orderNumber: String(order.orderNumber || order.id || ''),
    status: String(order.status || 'Pending'),
    createdAt: order.createdAt || new Date().toISOString(),
    customerId,
    items: Array.isArray(order.items) ? order.items : [],
    total: order.total ?? order.subtotal ?? null,
  };
  const next = [entry, ...snapshots.filter((item) => item.id !== entry.id)];
  writeSnapshots(next.slice(0, 50));
}

/**
 * Read the optional short-lived UI cache for a customer (see
 * persistOrderSnapshot). Not server history — callers must prefer
 * fetchMyOrders and only use this as a transient cache until the fetch lands.
 */
export function getOrderSnapshots(customer) {
  const customerId = String(customer?.id || customer?.email || '');
  if (!customerId) return [];
  return readSnapshots().filter((item) => item.customerId === customerId);
}

/**
 * Server-side order history for the authenticated customer.
 * Verified on staging: GET /api/orders/my-orders (Bearer + tenant headers)
 * returns 200 with an array of the customer's orders. GET /api/orders is 403
 * for customers and is NOT used here. On failure callers should show an error,
 * not fall back to local snapshots.
 */
export async function fetchMyOrders(token) {
  const response = await storefrontFetch('/api/orders/my-orders', { token });
  if (!response.ok) {
    const detail = await readErrorDetail(response);
    return {
      ok: false,
      status: response.status,
      message: detail || 'Unable to load your orders.',
    };
  }
  const payload = await parseJsonResponse(response);
  const orders = Array.isArray(payload) ? payload : (Array.isArray(payload?.orders) ? payload.orders : []);
  return { ok: true, orders };
}