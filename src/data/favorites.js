/**
 * Customer favorites API for the VELVET storefront.
 *
 * Verified staging contract (Bearer required):
 * - GET    /api/favorites → { productIds, products }
 * - POST   /api/favorites/:productId → add
 * - DELETE /api/favorites/:productId → remove
 *
 * Guest heart clicks never silently fail — the UI routes guests to
 * /login?return=… (see FavoriteButton).
 */

import { parseJsonResponse, readErrorDetail, storefrontFetch } from './apiClient.js';

export async function getFavorites(token) {
  const response = await storefrontFetch('/api/favorites', { token });
  if (!response.ok) {
    const detail = await readErrorDetail(response);
    return { ok: false, status: response.status, message: detail || 'Unable to load favorites.' };
  }
  const payload = await parseJsonResponse(response);
  const productIds = Array.isArray(payload?.productIds) ? payload.productIds : [];
  const products = Array.isArray(payload?.products) ? payload.products : [];
  return { ok: true, productIds, products };
}

export async function addFavorite(productId, token) {
  const response = await storefrontFetch(`/api/favorites/${encodeURIComponent(productId)}`, {
    method: 'POST',
    token,
  });
  if (!response.ok) {
    const detail = await readErrorDetail(response);
    return { ok: false, status: response.status, message: detail || 'Unable to add to favorites.' };
  }
  return { ok: true };
}

export async function removeFavorite(productId, token) {
  const response = await storefrontFetch(`/api/favorites/${encodeURIComponent(productId)}`, {
    method: 'DELETE',
    token,
  });
  if (!response.ok) {
    const detail = await readErrorDetail(response);
    return { ok: false, status: response.status, message: detail || 'Unable to remove from favorites.' };
  }
  return { ok: true };
}

/** Normalize a favorites payload into a Set of product ids (defensive). */
export function normalizeFavoriteIds(payload) {
  const ids = Array.isArray(payload?.productIds) ? payload.productIds : [];
  return new Set(ids.map((id) => String(id)));
}