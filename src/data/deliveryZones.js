/**
 * Tenant delivery zones for the VELVET storefront.
 *
 * Verified staging contract (iGroup API is source of truth):
 * - GET /api/delivery-zones (X-Company-Id / X-Site-Id via storefrontFetch)
 *   → 200 JSON array of enabled zones for the current company.
 * - Zone fields: id, city_key, city_name, region, delivery_price, currency,
 *   enabled, display_order.
 *
 * No hardcoded zone names, fees, or supported areas — empty/error must not
 * fall back to free delivery assumptions.
 */

import { parseJsonResponse, readErrorDetail, storefrontFetch } from './apiClient.js';

/** Normalize one API zone into a stable storefront shape. */
export function normalizeDeliveryZone(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').trim();
  const cityKey = String(raw.city_key || raw.cityKey || '').trim();
  if (!id && !cityKey) return null;
  if (raw.enabled === false) return null;
  if (raw.deleted_at) return null;

  const price = Number(raw.delivery_price ?? raw.deliveryPrice ?? 0);
  const deliveryPrice = Number.isFinite(price) && price >= 0 ? price : 0;
  const displayOrder = Math.max(0, Number(raw.display_order ?? raw.displayOrder ?? 0) || 0);

  return {
    id: id || cityKey,
    cityKey,
    cityName: String(raw.city_name || raw.cityName || '').trim() || cityKey,
    region: String(raw.region || '').trim(),
    deliveryPrice,
    currency: String(raw.currency || 'ILS').trim().toUpperCase() || 'ILS',
    displayOrder,
    enabled: true,
  };
}

/** Sort by display_order then city name (stable, locale-neutral). */
export function sortDeliveryZones(zones) {
  return [...(Array.isArray(zones) ? zones : [])].sort((a, b) => {
    const order = (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
    if (order !== 0) return order;
    return String(a.cityName || '').localeCompare(String(b.cityName || ''), undefined, { sensitivity: 'base' });
  });
}

/**
 * Fetch enabled delivery zones for the current tenant/site.
 * Never invents fallback zones.
 */
export async function fetchDeliveryZones() {
  try {
    const response = await storefrontFetch('/api/delivery-zones');
    if (!response.ok) {
      const detail = await readErrorDetail(response);
      return {
        ok: false,
        status: response.status,
        message: detail || 'Unable to load delivery areas.',
        zones: [],
      };
    }
    const payload = await parseJsonResponse(response);
    const list = Array.isArray(payload)
      ? payload
      : (Array.isArray(payload?.zones) ? payload.zones : []);
    const zones = sortDeliveryZones(
      list.map(normalizeDeliveryZone).filter(Boolean),
    );
    return { ok: true, zones };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message: error?.message || 'Unable to load delivery areas.',
      zones: [],
    };
  }
}

/** Display totals for checkout summary (client preview only). */
export function computeCheckoutTotals(subtotal, deliveryFee) {
  const safeSubtotal = Number(subtotal);
  const safeFee = Number(deliveryFee);
  const sub = Number.isFinite(safeSubtotal) ? safeSubtotal : 0;
  const fee = Number.isFinite(safeFee) && safeFee >= 0 ? safeFee : 0;
  return {
    subtotal: sub,
    deliveryFee: fee,
    finalTotal: sub + fee,
  };
}

/** True when the create-order API rejected the selected zone. */
export function isDeliveryZoneRejected(result) {
  if (!result || result.ok) return false;
  if (result.status !== 400) return false;
  return /delivery (city|zone|area)|not available/i.test(String(result.message || ''));
}
